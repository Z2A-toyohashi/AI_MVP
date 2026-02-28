'use client';

import { useState } from 'react';
import Header from '@/components/Header';

export default function FeedbackPage() {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'anonymous',
          content: content.trim(),
          created_at: Date.now(),
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setContent('');
        setTimeout(() => setSubmitted(false), 3000);
      } else {
        alert('送信に失敗しました');
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('送信に失敗しました');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <Header title="フィードバック" />

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">✉️</div>
          <h2 className="font-black text-gray-800 text-2xl mb-2">ご意見をください</h2>
          <p className="text-gray-500 font-bold text-sm">アプリをよりよくするために</p>
        </div>

        <div className="bg-gray-50 rounded-3xl border-2 border-gray-100 p-4 mb-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="感想やフィードバックを入力してください..."
            className="w-full h-48 bg-transparent border-0 focus:outline-none text-gray-800 font-semibold placeholder-gray-400 resize-none"
            style={{ fontSize: '16px' }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          className="btn-duo w-full py-4 text-base"
          style={{
            background: content.trim() && !isSubmitting ? '#58cc02' : '#e5e5e5',
            color: content.trim() && !isSubmitting ? '#fff' : '#afafaf',
            boxShadow: content.trim() && !isSubmitting ? '0 4px 0 #46a302' : '0 4px 0 #c4c4c4',
            borderRadius: '16px',
            fontWeight: 800,
            fontSize: '15px',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            cursor: content.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
          }}
        >
          {isSubmitting ? '送信中...' : '送信する'}
        </button>

        {submitted && (
          <div className="mt-4 bg-[#f0fce4] border-2 border-[#58cc02] rounded-2xl px-4 py-3 text-center">
            <p className="text-[#58cc02] font-black">ありがとうございます！🎉</p>
          </div>
        )}

        <div className="mt-8 space-y-3">
          {['AIとの会話は自然でしたか？', 'アプリは使いやすかったですか？', '改善してほしい点はありますか？', '追加してほしい機能はありますか？'].map((hint) => (
            <button
              key={hint}
              onClick={() => setContent((prev) => prev ? prev + '\n' + hint : hint)}
              className="w-full text-left px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-bold text-gray-600 hover:border-[#84d8ff] hover:bg-[#f0f9ff] transition-colors"
            >
              + {hint}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
