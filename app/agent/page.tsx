'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getUserId } from '@/lib/user';
import FooterNav from '@/components/FooterNav';
import Header from '@/components/Header';

interface Agent {
  id: string;
  user_id: string;
  name: string;
  personality: { positive: number; talkative: number; curious: number; creative?: number };
  level: number;
  experience: number;
  appearance_stage: number;
  character_image_url?: string;
  can_post_to_sns?: boolean;
  dynamic_persona?: string;
  persona_updated_at?: number;
}

interface EvolutionEntry {
  id: string;
  level: number;
  appearance_stage: number;
  stage_label: string;
  evolved: boolean;
  character_image_url?: string;
  created_at: number;
}

interface MindNode {
  id: string;
  label: string;
  category: string;
  weight: number;
  x: number;
  y: number;
  z: number;
}

function MindMapCanvas({ nodes }: { nodes: MindNode[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef({ x: 0.3, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const animRef = useRef<number>(0);

  const COLORS: Record<string, string> = {
    感情: '#ff9600', 趣味: '#58cc02', 人物: '#1cb0f6',
    出来事: '#ce82ff', 価値観: '#ff4b4b', その他: '#afafaf',
  };

  const project = useCallback((x: number, y: number, z: number, rx: number, ry: number, w: number, h: number) => {
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    const cosY = Math.cos(ry), sinY = Math.sin(ry);
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    const x2 = x * cosY + z1 * sinY;
    const z2 = -x * sinY + z1 * cosY;
    const fov = 400;
    const scale = fov / (fov + z2 + 200);
    return { sx: x2 * scale + w / 2, sy: y1 * scale + h / 2, scale, z: z2 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width, h = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const rx = rotRef.current.x, ry = rotRef.current.y;
      const projected = nodes.map(n => ({ ...n, ...project(n.x, n.y, n.z, rx, ry, w, h) }));
      projected.sort((a, b) => a.z - b.z);
      const cx = w / 2, cy = h / 2;
      projected.forEach(n => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(n.sx, n.sy);
        ctx.strokeStyle = `${COLORS[n.category] || '#afafaf'}44`;
        ctx.lineWidth = Math.max(0.5, n.scale * 1.5);
        ctx.stroke();
      });
      projected.forEach(n => {
        const r = Math.max(4, n.weight * 8 * n.scale);
        const color = COLORS[n.category] || '#afafaf';
        ctx.beginPath();
        ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = color + 'cc';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (n.scale > 0.6) {
          ctx.fillStyle = '#eee';
          ctx.font = `bold ${Math.max(9, 11 * n.scale)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(n.label.length > 8 ? n.label.slice(0, 8) + '…' : n.label, n.sx, n.sy - r - 3);
        }
      });
      rotRef.current.y += 0.003;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, project]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    rotRef.current.y += dx * 0.008;
    rotRef.current.x += dy * 0.008;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = () => { dragging.current = false; };

  return (
    <canvas ref={canvasRef} width={340} height={260}
      className="w-full rounded-2xl touch-none cursor-grab active:cursor-grabbing"
      style={{ background: 'linear-gradient(135deg, #0f0f1a, #1a1a2e)' }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
  );
}

export default function AgentPage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [evolutionHistory, setEvolutionHistory] = useState<EvolutionEntry[]>([]);
  const [showEvolution, setShowEvolution] = useState(false);
  const [mindNodes, setMindNodes] = useState<MindNode[]>([]);
  const [loadingMind, setLoadingMind] = useState(false);
  const [showMind, setShowMind] = useState(false);
  const [updatingPersona, setUpdatingPersona] = useState(false);

  useEffect(() => { initAgent(); }, []);

  const initAgent = async () => {
    try {
      const userId = getUserId();
      await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
      const res = await fetch(`/api/agents?userId=${userId}`);
      const data = await res.json();
      if (data?.id) setAgent(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleUpdatePersona = async () => {
    if (!agent) return;
    setUpdatingPersona(true);
    try {
      const res = await fetch('/api/batch/update-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setAgent(prev => prev ? { ...prev, dynamic_persona: data.persona, persona_updated_at: Date.now() } : prev);
      }
    } catch (e) { console.error(e); }
    finally { setUpdatingPersona(false); }
  };

  const handleSaveName = async () => {
    if (!agent || !nameInput.trim() || nameInput.trim() === agent.name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      const res = await fetch('/api/agents', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: agent.id, name: nameInput.trim() }) });
      if (res.ok) { const u = await res.json(); setAgent(prev => prev ? { ...prev, ...u } : prev); }
    } catch (e) { console.error(e); }
    finally { setSavingName(false); setEditingName(false); }
  };

  const handleOpenEvolution = async () => {
    if (!agent) return;
    setShowEvolution(true);
    try {
      const res = await fetch(`/api/evolution-history?agentId=${agent.id}`);
      const data = await res.json();
      setEvolutionHistory(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };

  const handleOpenMind = async () => {
    if (!agent) return;
    setShowMind(true);
    if (mindNodes.length > 0) return;
    setLoadingMind(true);
    try {
      const res = await fetch(`/api/conversations?agentId=${agent.id}`);
      const convs = await res.json();
      if (!Array.isArray(convs) || convs.length === 0) { setLoadingMind(false); return; }
      const text = convs.slice(-40).map((c: any) => `${c.role === 'user' ? 'U' : 'A'}: ${c.content}`).join('\n');
      const aiRes = await fetch('/api/multimodal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `以下の会話から、AIキャラクターの「頭の中」を表すキーワードを20個抽出してください。各キーワードに category（感情/趣味/人物/出来事/価値観/その他）と weight（0.3〜1.0）を付けてください。JSON配列のみ返してください: [{"label":"キーワード","category":"カテゴリ","weight":0.8}]\n\n会話:\n${text}`,
          type: 'text',
        }),
      });
      const aiData = await aiRes.json();
      const raw = aiData.result || aiData.content || '';
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed: Array<{ label: string; category: string; weight: number }> = JSON.parse(match[0]);
        const nodes: MindNode[] = parsed.slice(0, 20).map((item, i) => {
          const theta = (i / parsed.length) * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const r = 80 + Math.random() * 60;
          return {
            id: String(i), label: item.label, category: item.category, weight: item.weight,
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta),
            z: r * Math.cos(phi),
          };
        });
        setMindNodes(nodes);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingMind(false); }
  };

  const getNextMilestone = (level: number) => {
    if (level < 3) return { level: 3, label: '見た目が変わる', icon: '🐣' };
    if (level < 5) return { level: 5, label: '掲示板に投稿できる', icon: '📋' };
    if (level < 7) return { level: 7, label: 'さらに見た目が変わる', icon: '🐥' };
    if (level < 9) return { level: 9, label: '最終形態に進化', icon: '🦜' };
    return null;
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
      <div className="text-5xl animate-bounce">🐣</div>
      <p className="text-gray-400 font-black text-sm tracking-widest uppercase">Loading...</p>
    </div>
  );

  if (!agent) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
      <div className="text-5xl">😢</div>
      <p className="text-gray-500 font-black text-sm">キャラクターの読み込みに失敗しました</p>
    </div>
  );

  const stageEmoji = ['🥚', '🐣', '🐥', '🐤', '🦜'][Math.min(agent.appearance_stage - 1, 4)];
  const milestone = getNextMilestone(agent.level);

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <div className="w-full max-w-lg mx-auto flex flex-col h-full">
        <Header title="キャラクター" showBack={false} />
        <main className="flex-1 overflow-y-auto pb-20">

          <div className="mx-4 mt-4 rounded-2xl bg-[#fff9e6] border-2 border-[#ffd900] p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-16 h-16 rounded-2xl bg-white border-2 border-[#ffd900] flex items-center justify-center overflow-hidden flex-shrink-0">
                {agent.character_image_url ? <img src={agent.character_image_url} alt={agent.name} className="w-full h-full object-contain" /> : <span className="text-3xl">{stageEmoji}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  {editingName ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                        className="flex-1 text-sm font-black text-gray-800 border-b-2 border-[#58cc02] bg-transparent focus:outline-none min-w-0" maxLength={20} />
                      <button onClick={handleSaveName} disabled={savingName} className="text-[#58cc02] font-black text-xs px-2 py-1 rounded-lg bg-[#f0fce4] flex-shrink-0">{savingName ? '...' : '保存'}</button>
                      <button onClick={() => setEditingName(false)} className="text-gray-400 font-black text-xs px-1 flex-shrink-0">✕</button>
                    </div>
                  ) : (
                    <>
                      <p className="font-black text-gray-800 text-base truncate">{agent.name}</p>
                      <button onClick={() => { setNameInput(agent.name); setEditingName(true); }} className="flex-shrink-0 text-gray-400 hover:text-[#58cc02] transition-colors ml-1" aria-label="名前を編集">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs font-bold text-[#ff9600] bg-white px-2 py-0.5 rounded-full border border-[#ffd900]">理解度 {agent.level}</span>
                  {agent.can_post_to_sns && <span className="text-xs font-bold text-[#58cc02] bg-white px-2 py-0.5 rounded-full border border-[#58cc02]">掲示板解放済</span>}
                </div>
              </div>
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                <span>あなたへの理解度</span><span>{agent.experience} / 50 XP</span>
              </div>
              <div className="xp-bar"><div className="xp-fill" style={{ width: `${Math.min((agent.experience / 50) * 100, 100)}%` }} /></div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'ポジティブ', val: agent.personality?.positive ?? 0, color: '#58cc02' },
                { label: 'おしゃべり', val: agent.personality?.talkative ?? 0, color: '#1cb0f6' },
                { label: '好奇心', val: agent.personality?.curious ?? 0, color: '#ff9600' },
                { label: '創造性', val: agent.personality?.creative ?? 0, color: '#ce82ff' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-white rounded-xl p-2 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 mb-1">{label}</p>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, (val + 10) * 5))}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {milestone && (
            <div className="mx-4 mt-3 rounded-2xl bg-[#f0f9ff] border-2 border-[#84d8ff] p-3 flex items-center gap-3">
              <span className="text-2xl flex-shrink-0">{milestone.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[#1cb0f6] mb-0.5">次のマイルストーン</p>
                <p className="text-sm font-black text-gray-700">理解度{milestone.level}で{milestone.label}</p>
              </div>
            </div>
          )}

          <div className="mx-4 mt-3 grid grid-cols-2 gap-2 mb-4">
            <button onClick={handleOpenMind}
              className="py-3.5 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #ce82ff, #a855f7)', boxShadow: '0 4px 0 #7c3aed' }}>
              <span>🧠</span><span>頭の中を見る</span>
            </button>
            <button onClick={handleOpenEvolution}
              className="py-3.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #ffd900, #ffb800)', boxShadow: '0 4px 0 #d97706', color: '#78350f' }}>
              <span>✨</span><span>進化の軌跡</span>
            </button>
          </div>

          {/* キャラの個性セクション */}
          <div className="mx-4 mb-3 rounded-2xl border-2 border-[#ce82ff] bg-[#faf0ff] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-[#a855f7] uppercase tracking-wider">🧬 キャラの個性</p>
              <button
                onClick={handleUpdatePersona}
                disabled={updatingPersona}
                className="text-[10px] font-black text-[#a855f7] bg-white border border-[#ce82ff] px-2 py-1 rounded-lg disabled:opacity-50 transition-opacity"
              >
                {updatingPersona ? '更新中...' : '↻ 更新'}
              </button>
            </div>
            {agent.dynamic_persona ? (
              <>
                <p className="text-xs font-bold text-gray-700 leading-relaxed">{agent.dynamic_persona}</p>
                {agent.persona_updated_at && (
                  <p className="text-[10px] text-gray-400 font-bold mt-2">
                    最終更新: {new Date(agent.persona_updated_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-3">
                <p className="text-xs font-bold text-gray-400">まだ個性が形成されていません</p>
                <p className="text-[10px] text-gray-300 font-bold mt-1">もっと話しかけると個性が育ちます</p>
              </div>
            )}
          </div>

          <div className="mx-4 mb-4 rounded-2xl bg-gray-50 border-2 border-gray-100 p-4">
            <p className="text-xs font-black text-gray-500 mb-2 uppercase tracking-wider">このアプリについて</p>
            <div className="space-y-2">
              {[{ icon: '💬', text: '毎日話しかけるとXPが貯まる' }, { icon: '🌱', text: '会話でキャラの性格が変わる' }, { icon: '🎨', text: 'レベルアップで見た目が進化' }, { icon: '📋', text: 'Lv.5で掲示板に投稿できる' }].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <span className="text-base flex-shrink-0">{icon}</span>
                  <span className="text-xs font-bold text-gray-600">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
        <FooterNav />
      </div>

      {showMind && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setShowMind(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white z-[60] rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <div>
                <span className="text-base font-black text-gray-800">🧠 {agent.name}の頭の中</span>
                <p className="text-xs text-gray-400 font-bold mt-0.5">ドラッグで回転できます</p>
              </div>
              <button onClick={() => setShowMind(false)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {loadingMind ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="text-3xl animate-spin">🧠</div>
                  <p className="text-sm font-bold text-gray-400">会話を分析中...</p>
                </div>
              ) : mindNodes.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-gray-400 font-bold text-sm">まだ会話が少なすぎます</p>
                  <p className="text-gray-300 font-bold text-xs mt-1">もっと話しかけると頭の中が見えてきます</p>
                </div>
              ) : (
                <>
                  <MindMapCanvas nodes={mindNodes} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries({ 感情: '#ff9600', 趣味: '#58cc02', 人物: '#1cb0f6', 出来事: '#ce82ff', 価値観: '#ff4b4b', その他: '#afafaf' }).map(([cat, color]) => (
                      <div key={cat} className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                        <span className="text-[10px] font-bold text-gray-500">{cat}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {showEvolution && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowEvolution(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white z-[60] rounded-3xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <span className="text-base font-black text-gray-800">✨ 進化の軌跡</span>
              <button onClick={() => setShowEvolution(false)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              <div className="flex items-center gap-3 bg-[#fff9e6] border-2 border-[#ffd900] rounded-2xl p-3">
                <div className="w-14 h-14 rounded-2xl bg-white border-2 border-[#ffd900] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {agent.character_image_url ? <img src={agent.character_image_url} alt={agent.name} className="w-full h-full object-contain" /> : <span className="text-3xl">{stageEmoji}</span>}
                </div>
                <div>
                  <p className="font-black text-gray-800">{agent.name}</p>
                  <p className="text-xs font-bold text-[#ff9600]">現在 理解度 {agent.level}</p>
                </div>
              </div>
              {evolutionHistory.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-gray-400 font-bold text-sm">まだ記録がありません</p>
                  <p className="text-gray-300 font-bold text-xs mt-1">会話してレベルアップすると記録されます</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-100" />
                  {evolutionHistory.map((entry, i) => (
                    <div key={entry.id || i} className="flex items-start gap-3 relative pl-2 pb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 overflow-hidden ${entry.evolved ? 'border-2 border-[#ffb800]' : 'border-2 border-gray-200'}`}>
                        {entry.character_image_url ? (
                          <img src={entry.character_image_url} alt={`理解度${entry.level}`} className="w-full h-full object-contain bg-[#fff9e6]" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center text-base ${entry.evolved ? 'bg-[#ffd900]' : 'bg-gray-100'}`}>
                            {entry.stage_label}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-2xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-gray-800 text-sm">理解度 {entry.level}</span>
                          {entry.evolved && <span className="text-[10px] font-black text-[#ff9600] bg-[#fff9e6] px-2 py-0.5 rounded-full border border-[#ffd900]">進化！</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                          {new Date(entry.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
