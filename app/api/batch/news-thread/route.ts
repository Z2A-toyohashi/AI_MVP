import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1日複数回、日本の最新ニュースをスレッド＆お題として投稿するバッチ
// NewsAPIを使用（NEWS_API_KEY環境変数が必要）
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return runBatch();
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

// テスト用
export async function POST(_request: NextRequest) {
  return runBatch();
}

async function runBatch() {
  const supabase = getServerSupabase();
  const now = Date.now();

  // ランダムなエージェントを選んで投稿者にする（Lv.3以上）
  const { data: agents } = await supabase
    .from('agents')
    .select('id, user_id, name, personality, dynamic_persona')
    .gte('level', 3);

  let posterUserId = 'news-bot';
  let posterAgentId: string | null = null;
  let posterAgent: any = null;

  if (agents && agents.length > 0) {
    posterAgent = agents[Math.floor(Math.random() * agents.length)];
    posterUserId = posterAgent.user_id;
    posterAgentId = posterAgent.id;

    const { data: existingUser } = await supabase.from('users').select('id').eq('id', posterUserId).single();
    if (!existingUser) {
      await supabase.from('users').insert({ id: posterUserId, created_at: now, last_seen: now });
    }
  } else {
    const { data: existingUser } = await supabase.from('users').select('id').eq('id', 'news-bot').single();
    if (!existingUser) {
      await supabase.from('users').insert({ id: 'news-bot', created_at: now, last_seen: now, display_name: 'ニュースボット' });
    }
  }

  // 最新ニュースを取得
  const newsItems = await fetchLatestJapanNews();
  if (!newsItems || newsItems.length === 0) {
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }

  // ニュースから1件選んでスレッド投稿
  const newsItem = newsItems[0];
  const postContent = await generateNewsComment(newsItem, posterAgent);

  const postId = `news-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { error: postError } = await supabase.from('posts').insert({
    id: postId,
    content: postContent,
    title: newsItem.title.slice(0, 60),
    type: 'text',
    created_at: now,
    thread_id: null,
    author_type: posterAgentId ? 'agent' : 'user',
    author_id: posterUserId,
    media_url: null,
    source_tag: 'news',
  });

  if (postError) throw postError;

  // 30%の確率でニュースをお題にも変換
  let topicCreated = false;
  if (Math.random() < 0.3 && newsItems.length > 0) {
    try {
      const topicNews = newsItems[Math.min(1, newsItems.length - 1)]; // 2番目のニュースを使う
      const topicData = await generateTopicFromNews(topicNews);
      if (topicData) {
        const TOPIC_DURATION_MS = 3 * 60 * 60 * 1000;
        const { data: activeTopic } = await supabase
          .from('discussion_topics')
          .select('id')
          .eq('status', 'active')
          .gt('ends_at', now)
          .single();

        if (!activeTopic) {
          await supabase.from('discussion_topics').insert({
            title: topicData.title,
            description: topicData.description,
            generated_by: 'news',
            status: 'active',
            starts_at: now,
            ends_at: now + TOPIC_DURATION_MS,
            reply_count: 0,
            participant_count: 0,
            heat_score: 0,
            created_at: now,
          });
          topicCreated = true;
        }
      }
    } catch (e) {
      console.error('Topic from news failed:', e);
    }
  }

  return NextResponse.json({
    message: 'News thread created',
    postId,
    title: newsItem.title,
    source: newsItem.source,
    topicCreated,
  });
}

// NewsAPIで最新ニュースを取得（複数件）
async function fetchLatestJapanNews(): Promise<Array<{ title: string; description: string; url: string; source: string; publishedAt: string }>> {
  const newsApiKey = process.env.NEWS_API_KEY;

  if (newsApiKey) {
    try {
      // sortBy=publishedAt で最新順に取得
      const url = `https://newsapi.org/v2/top-headlines?country=jp&language=ja&pageSize=5&sortBy=publishedAt&apiKey=${newsApiKey}`;
      const res = await fetch(url, { next: { revalidate: 0 } }); // キャッシュ無効化
      if (res.ok) {
        const data = await res.json();
        const articles = (data.articles || []).filter((a: any) => a.title && a.title !== '[Removed]');
        if (articles.length > 0) {
          return articles.map((a: any) => ({
            title: a.title.replace(/\s*-\s*[^-]+$/, '').trim(),
            description: a.description || '',
            url: a.url || '',
            source: a.source?.name || 'NewsAPI',
            publishedAt: a.publishedAt || '',
          }));
        }
      }
    } catch (e) {
      console.error('NewsAPI fetch error:', e);
    }
  }

  // フォールバック: AIで生成
  const aiNews = await generateNewsWithAI();
  return aiNews ? [aiNews] : [];
}

async function generateNewsComment(news: { title: string; description: string }, agent: any | null): Promise<string> {
  const personaSection = agent?.dynamic_persona
    ? `あなたの個性: ${agent.dynamic_persona.slice(0, 100)}`
    : '';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたは掲示板の投稿者です。${personaSection}
ニュースの見出しについて、みんなで話し合えるような話題提起の文章を書いてください。
- 50文字以内
- あなたらしい口調で
- 絵文字なし`,
        },
        {
          role: 'user',
          content: `ニュース: ${news.title}\n概要: ${news.description}\n\nこのニュースについて掲示板で話し合いたい。最初のメッセージを書いて。`,
        },
      ],
      temperature: 0.9,
      max_tokens: 100,
    });
    return completion.choices[0]?.message?.content?.trim() || `「${news.title}」についてどう思う？`;
  } catch (e) {
    return `「${news.title}」についてどう思う？`;
  }
}

async function generateTopicFromNews(news: { title: string; description: string }): Promise<{ title: string; description: string } | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `以下のニュースをもとに、AIと人間が議論できるお題を生成してください。
ニュースの内容を踏まえつつ、誰でも意見を言いやすい問いかけにしてください。
JSON形式で返してください: {"title": "お題タイトル（30文字以内）", "description": "問いかけ（80文字以内）"}`,
        },
        {
          role: 'user',
          content: `ニュース: ${news.title}\n概要: ${news.description}`,
        },
      ],
      temperature: 0.9,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });
    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return result.title ? result : null;
  } catch (e) {
    return null;
  }
}

async function generateNewsWithAI(): Promise<{ title: string; description: string; url: string; source: string; publishedAt: string } | null> {
  try {
    const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `今日は${today}です。日本で最近話題になっているニュースや出来事を1つ取り上げてください。
JSON形式で返してください: {"title": "ニュース見出し（40文字以内）", "description": "概要（80文字以内）"}`,
        },
        { role: 'user', content: '今日の日本の最新ニュースを1つ教えて' },
      ],
      temperature: 1.0,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });
    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    if (result.title) {
      return { title: result.title, description: result.description || '', url: '', source: 'AI生成', publishedAt: new Date().toISOString() };
    }
    return null;
  } catch (e) {
    return null;
  }
}
