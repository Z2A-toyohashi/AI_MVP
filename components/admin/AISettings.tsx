'use client';

import { useState, useEffect } from 'react';

interface AISettingsProps {
  currentAIDensity: number;
}

export default function AISettings({ currentAIDensity }: AISettingsProps) {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  const [checkInterval, setCheckInterval] = useState(30000);
  const [cooldownMin, setCooldownMin] = useState(300000);
  const [cooldownMax, setCooldownMax] = useState(900000);
  const [maxAIDensity, setMaxAIDensity] = useState(0.2);
  const [delayMin, setDelayMin] = useState(5000);
  const [delayMax, setDelayMax] = useState(20000);
  const [probFlow, setProbFlow] = useState(0.0);
  const [probSilence, setProbSilence] = useState(0.35);
  const [probFragile, setProbFragile] = useState(0.15);
  const [probSolo, setProbSolo] = useState(0.5);
  const [maxResponseLength, setMaxResponseLength] = useState(10);
  const [gptTemperature, setGptTemperature] = useState(1.0);
  const [gptPresencePenalty, setGptPresencePenalty] = useState(0.6);
  const [gptFrequencyPenalty, setGptFrequencyPenalty] = useState(0.6);

  useEffect(() => {
    loadAISettings();
  }, []);

  const loadAISettings = async () => {
    try {
      const res = await fetch('/api/ai-settings');
      const data = await res.json();
      if (data.settings) {
        setSystemPrompt(data.settings.system_prompt);
        setCheckInterval(data.settings.check_interval || 30000);
        setCooldownMin(data.settings.cooldown_min || 300000);
        setCooldownMax(data.settings.cooldown_max || 900000);
        setMaxAIDensity(data.settings.max_ai_density || 0.2);
        setDelayMin(data.settings.delay_min || 5000);
        setDelayMax(data.settings.delay_max || 20000);
        setProbFlow(data.settings.prob_flow || 0.0);
        setProbSilence(data.settings.prob_silence || 0.35);
        setProbFragile(data.settings.prob_fragile || 0.15);
        setProbSolo(data.settings.prob_solo || 0.5);
        setMaxResponseLength(data.settings.max_response_length || 10);
        setGptTemperature(data.settings.gpt_temperature || 1.0);
        setGptPresencePenalty(data.settings.gpt_presence_penalty || 0.6);
        setGptFrequencyPenalty(data.settings.gpt_frequency_penalty || 0.6);
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error);
    }
  };

  const saveAISettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          check_interval: checkInterval,
          cooldown_min: cooldownMin,
          cooldown_max: cooldownMax,
          max_ai_density: maxAIDensity,
          delay_min: delayMin,
          delay_max: delayMax,
          prob_flow: probFlow,
          prob_silence: probSilence,
          prob_fragile: probFragile,
          prob_solo: probSolo,
          max_response_length: maxResponseLength,
          gpt_temperature: gptTemperature,
          gpt_presence_penalty: gptPresencePenalty,
          gpt_frequency_penalty: gptFrequencyPenalty,
        }),
      });

      if (res.ok) {
        alert('設定を保存しました');
      } else {
        alert('保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save AI settings:', error);
      alert('保存に失敗しました');
    }
    setIsSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 shadow-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
            🤖 AI設定
          </h2>
          <p className="text-xs text-gray-500 mt-1">AIの振る舞いとパラメータを調整</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPromptEditor(!showPromptEditor)}
            className={`px-4 py-2 rounded-lg transition-all text-sm font-semibold flex-1 sm:flex-none shadow-md ${
              showPromptEditor
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            📝 プロンプト
          </button>
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className={`px-4 py-2 rounded-lg transition-all text-sm font-semibold flex-1 sm:flex-none shadow-md ${
              showAdvancedSettings
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
            }`}
          >
            ⚙️ 詳細設定
          </button>
        </div>
      </div>

      {showPromptEditor && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-300 p-4 sm:p-6 mb-4">
          <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-lg">💬</span>
            システムプロンプト
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full h-48 sm:h-64 px-3 sm:px-4 py-2 sm:py-3 border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm font-mono shadow-inner bg-white"
            placeholder="AIの振る舞いを定義するプロンプトを入力..."
          />
          <p className="text-xs text-gray-600 mt-2">💡 短く簡潔な応答を促すプロンプトを設定してください</p>
        </div>
      )}

      {showAdvancedSettings && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border-2 border-indigo-300 p-4 sm:p-6 mb-4">
          <h3 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            詳細パラメータ
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* タイミング設定 */}
            <div className="bg-white rounded-xl p-5 shadow-md border-2 border-blue-200">
              <h4 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b-2 border-blue-300 flex items-center gap-2">
                <span>⏱️</span> タイミング制御
              </h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">チェック間隔（ms）</label>
                  <input type="number" value={checkInterval} onChange={(e) => setCheckInterval(Number(e.target.value))} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-blue-600 font-medium mt-1 bg-blue-50 px-2 py-1 rounded">⏰ {(checkInterval / 1000).toFixed(0)}秒ごと</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">クールダウン最小（ms）</label>
                  <input type="number" value={cooldownMin} onChange={(e) => setCooldownMin(Number(e.target.value))} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-blue-600 font-medium mt-1 bg-blue-50 px-2 py-1 rounded">⏰ 最短 {(cooldownMin / 60000).toFixed(1)}分</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">クールダウン最大（ms）</label>
                  <input type="number" value={cooldownMax} onChange={(e) => setCooldownMax(Number(e.target.value))} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-blue-600 font-medium mt-1 bg-blue-50 px-2 py-1 rounded">⏰ 最長 {(cooldownMax / 60000).toFixed(1)}分</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">投稿遅延最小（ms）</label>
                  <input type="number" value={delayMin} onChange={(e) => setDelayMin(Number(e.target.value))} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-blue-600 font-medium mt-1 bg-blue-50 px-2 py-1 rounded">⏰ 最短 {(delayMin / 1000).toFixed(0)}秒</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">投稿遅延最大（ms）</label>
                  <input type="number" value={delayMax} onChange={(e) => setDelayMax(Number(e.target.value))} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-blue-600 font-medium mt-1 bg-blue-50 px-2 py-1 rounded">⏰ 最長 {(delayMax / 1000).toFixed(0)}秒</p>
                </div>
              </div>
            </div>

            {/* 介入確率設定 - 簡略化 */}
            <div className="bg-white rounded-xl p-5 shadow-md border-2 border-purple-200">
              <h4 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b-2 border-purple-300 flex items-center gap-2">
                <span>🎲</span> AI介入確率（簡易設定）
              </h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">全体的な介入頻度</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    value={probSolo} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setProbSolo(val);
                      setProbSilence(val * 0.7);
                      setProbFragile(val * 0.3);
                      setProbFlow(val * 0.1);
                    }}
                    className="w-full h-3 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-2">
                    <span>低頻度</span>
                    <span className="font-bold text-purple-600">{(probSolo * 100).toFixed(0)}%</span>
                    <span>高頻度</span>
                  </div>
                  <div className="mt-3 bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <p className="text-xs text-gray-700 mb-2 font-semibold">📊 自動調整される確率:</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>SOLO（独り言）:</span><span className="font-mono">{(probSolo * 100).toFixed(0)}%</span></div>
                      <div className="flex justify-between"><span>SILENCE（静寂）:</span><span className="font-mono">{(probSilence * 100).toFixed(0)}%</span></div>
                      <div className="flex justify-between"><span>FRAGILE（不安定）:</span><span className="font-mono">{(probFragile * 100).toFixed(0)}%</span></div>
                      <div className="flex justify-between"><span>FLOW（会話活発）:</span><span className="font-mono">{(probFlow * 100).toFixed(0)}%</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* GPTパラメータ設定 */}
            <div className="bg-white rounded-xl p-5 shadow-md border-2 border-indigo-200">
              <h4 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b-2 border-indigo-300 flex items-center gap-2">
                <span>🧠</span> GPT応答パラメータ
              </h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Temperature（創造性）</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="2" 
                    step="0.1" 
                    value={gptTemperature} 
                    onChange={(e) => setGptTemperature(Number(e.target.value))}
                    className="w-full h-3 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-2">
                    <span>保守的</span>
                    <span className="font-bold text-indigo-600">{gptTemperature.toFixed(1)}</span>
                    <span>創造的</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 bg-gray-50 px-2 py-1 rounded">💡 高いほど多様な応答、低いほど一貫した応答</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Presence Penalty（話題の多様性）</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="2" 
                    step="0.1" 
                    value={gptPresencePenalty} 
                    onChange={(e) => setGptPresencePenalty(Number(e.target.value))}
                    className="w-full h-3 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-2">
                    <span>同じ話題</span>
                    <span className="font-bold text-indigo-600">{gptPresencePenalty.toFixed(1)}</span>
                    <span>新しい話題</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 bg-gray-50 px-2 py-1 rounded">💡 高いほど新しい話題を導入しやすい</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Frequency Penalty（繰り返し抑制）</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="2" 
                    step="0.1" 
                    value={gptFrequencyPenalty} 
                    onChange={(e) => setGptFrequencyPenalty(Number(e.target.value))}
                    className="w-full h-3 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-2">
                    <span>繰り返しOK</span>
                    <span className="font-bold text-indigo-600">{gptFrequencyPenalty.toFixed(1)}</span>
                    <span>繰り返し回避</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 bg-gray-50 px-2 py-1 rounded">💡 高いほど同じ単語の繰り返しを避ける</p>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200 mt-4">
                  <h5 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1"><span>💡</span> 推奨設定</h5>
                  <ul className="text-xs text-gray-600 space-y-1.5">
                    {['Temperature: 0.8-1.2', 'Presence: 0.5-0.8', 'Frequency: 0.5-0.8'].map((tip) => (
                      <li key={tip} className="flex items-start gap-2"><span className="text-green-500">✓</span><span>{tip}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* その他設定 */}
            <div className="bg-white rounded-xl p-5 shadow-md border-2 border-green-200">
              <h4 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b-2 border-green-300 flex items-center gap-2">
                <span>🎚️</span> その他の制限
              </h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">最大AI密度</label>
                  <input type="number" step="0.05" min="0" max="1" value={maxAIDensity} onChange={(e) => setMaxAIDensity(Number(e.target.value))} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <div className="mt-2 bg-green-100 rounded-full h-3 overflow-hidden shadow-inner">
                    <div className="bg-gradient-to-r from-green-400 to-green-600 h-full transition-all" style={{ width: `${maxAIDensity * 100}%` }}></div>
                  </div>
                  <p className="text-xs text-green-600 font-medium mt-1 bg-green-50 px-2 py-1 rounded">📊 最大 {(maxAIDensity * 100).toFixed(0)}%</p>
                  <p className="text-xs text-gray-500 mt-1 bg-gray-50 px-2 py-1 rounded">現在: {(currentAIDensity * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">最大応答文字数</label>
                  <input type="number" value={maxResponseLength} onChange={(e) => setMaxResponseLength(Number(e.target.value))} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <p className="text-xs text-green-600 font-medium mt-1 bg-green-50 px-2 py-1 rounded">📝 最大 {maxResponseLength}文字</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-200 mt-6">
                  <h5 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1"><span>💡</span> 推奨設定</h5>
                  <ul className="text-xs text-gray-600 space-y-1.5">
                    {['AI密度: 10-20%', 'クールダウン: 5-15分', '応答文字数: 5-15文字', 'SOLO確率: 40-60%'].map((tip) => (
                      <li key={tip} className="flex items-start gap-2"><span className="text-green-500">✓</span><span>{tip}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(showPromptEditor || showAdvancedSettings) && (
        <div className="flex justify-end pt-4 border-t-2 border-gray-200 mt-4">
          <button onClick={saveAISettings} disabled={isSaving} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 transition-all font-bold text-sm w-full sm:w-auto shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none">
            {isSaving ? '💾 保存中...' : '💾 すべて保存'}
          </button>
        </div>
      )}
    </div>
  );
}
