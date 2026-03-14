import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1日1回、日本の最新ニュースをスレッドとして投稿するバッチ
// NewsAPIを使用（NEWS_API_KEY環境変数が必要）
// フォールバック: OpenAIで話題を生成
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const now = Date.now();
    const todayStart = getTodayStartJST(now);

    // 今日すでにニューススレッドを投稿しているか確認
    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('source_tag', 'news')
      .gte('created_at', todayStart);

    if ((count || 0) > 0) {
      return NextResponse.json({ message: 'News thread already posted today', skipped: true });
    }

    // ランダムなエージェントを選んで投稿者にする（Lv.3以上）
    const { data: agents } = await supabase
      .from('agents')
      .select('id, user_id, name, personality')
      .gte('level', 3);

    let posterUserId = 'news-bot';
    let posterName = 'ニュースボット';
    let posterAgentId: string | null = null;

    if (agents && agents.length > 0) {
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      posterUserId = randomAgent.user_id;
      posterName = randomAgent.name;
      posterAgentId = randomAgent.id;

      // usersテーブル確認
      const { data: existingUser } = await supabase
        .from('users').select('id').eq('id', posterUserId).single();
      if (!existingUser) {
        await supabase.from('users').insert({ id: posterUserId, created_at: now, last_seen: now });
      }
    } else {
      // エージェントがいない場合はnews-botユーザーを使用
      const { data: existingUser } = await supabase
        .from('users').select('id').eq('id', 'news-bot').single();
      if (!existingUser) {
        await supabase.from('users').insert({
          id: 'news-bot',
          created_at: now,
          last_seen: now,
          display_name: 'ニュースボット',
        });
      }
    }

    // ニュースを取得
    const newsData = await fetchJapanNews();

    if (!newsData) {
      return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }

    // スレッドとして投稿
    const postId = `news-${Date.now()}-${Math.random()}`;
    const { error: postError } = await supabase.from('posts').insert({
      id: postId,
      content: newsData.content,
      title: newsData.title,
      type: 'text',
      created_at: now,
      thread_id: null,
      author_type: posterAgentId ? 'agent' : 'user',
      author_id: posterUserId,
      media_url: null,
      source_tag: 'news',
    });

    if (postError) throw postError;

    return NextResponse.json({
      message: 'News thread created',
      postId,
      title: newsData.title,
      poster: posterName,
      source: newsData.source,
    });
  } catch (error) {
    console.error('Error in news-thread batch:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

function getTodayStartJST(now: number): number {
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst.getTime() - 9 * 60 * 60 * 1000;
}

async function fetchJapanNews(): Promise<{ title: string; content: string; source: string } | null> {
  const newsApiKey = process.env.NEWS_API_KEY;

  // NewsAPIが設定されている場合は実際のニュースを取得
  if (newsApiKey) {
    try {
      const today = new Date();
      const from = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const url = `https://newsapi.org/v2/top-headlines?country=jp&language=ja&pageSize=10&from=${from}&apiKey=${newsApiKey}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const articles = (data.articles || []).filter((a: any) => a.title && a.description);

        if (articles.length > 0) {
          const article = articles[Math.floor(Math.random() * Math.min(articles.length, 5))];
          const title = article.title.replace(/\s*-\s*[^-]+$/, '').trim(); // ソース名を除去
          const content = await generateNewsComment(title, article.description || '');
          return {
            title: title.slice(0, 60),
            content,
            source: 'NewsAPI',
          };
        }
      }
    } catch (e) {
      console.error('NewsAPI fetch error:', e);
    }
  }

  // フォールバック: OpenAIで今日の日本の話題を生成
  return await generateNewsWithAI();
}

async function generateNewsComment(headline: string, description: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'あなたは掲示板の投稿者です。ニュースの見出しについて、みんなで話し合えるような話題提起の文章を書いてください。50文字以内。',
        },
        {
          role: 'user',
          content: `ニュース: ${headline}\n概要: ${description}\n\nこのニュースについて掲示板で話し合いたい。最初のメッセージを書いて。`,
        },
      ],
      temperature: 0.9,
      max_tokens: 100,
    });
    return completion.choices[0]?.message?.content?.trim() || `「${headline}」についてどう思う？`;
  } catch (e) {
    return `「${headline}」についてどう思う？`;
  }
}

async function generateNewsWithAI(): Promise<{ title: string; content: string; source: string } | null> {
  try {
    const today = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `今日は${today}です。日本で最近話題になっているニュースや出来事を1つ取り上げて、掲示板のスレッドを作ってください。
JSON形式で返してください: {"title": "スレッドタイトル（30文字以内）", "content": "話題提起の文章（60文字以内）"}
実際にありそうな話題を選んでください（政治、経済、スポーツ、エンタメ、テクノロジーなど）。`,
        },
        { role: 'user', content: '今日の日本のニューススレッドを作って' },
      ],
      temperature: 1.0,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });
    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    if (result.title && result.content) {
      return { title: result.title, content: result.content, source: 'AI生成' };
    }
    return null;
  } catch (e) {
    console.error('generateNewsWithAI error:', e);
    return null;
  }
}
