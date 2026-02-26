-- グローバルなシステムプロンプト設定テーブル
CREATE TABLE IF NOT EXISTS agent_system_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  system_prompt TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT single_row CHECK (id = 'default')
);

-- デフォルトのシステムプロンプトを挿入
INSERT INTO agent_system_settings (id, system_prompt, updated_at)
VALUES (
  'default',
  'あなたは主人（ユーザー）の相棒のような存在です。
主人のことを一番理解していて、主人と同じような考え方をします。

ルール:
- 1〜2文で短く返答
- カジュアルな口調
- 相手の話を聞く姿勢
- レベルが低いうちは反応が薄い
- 主人と似たようなキャラ
- 自我がちゃんとあります
- 主人の第二の自分として、主人の考え方を理解し共感する',
  EXTRACT(EPOCH FROM NOW()) * 1000
)
ON CONFLICT (id) DO NOTHING;

-- Row Level Security
ALTER TABLE agent_system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for agent_system_settings" ON agent_system_settings FOR ALL USING (true) WITH CHECK (true);
