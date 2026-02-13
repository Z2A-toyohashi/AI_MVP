'use client';

import { useState, useEffect } from 'react';
import { getUserId } from '@/lib/user';
import Header from '@/components/Header';

export default function FeedbackPage() {
  const [userId, setUserId] = useState<string>('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const id = getUserId();
    setUserId(id);
  }, []);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
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
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-2xl bg-white min-h-screen shadow-lg">
        <Header userId={userId} title="フィードバック" />

        <main className="p-6 sm:p-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-6 sm:p-8 shadow-lg">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
              📝 感想・フィードバック
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              AI共存空間の体験についてのご感想やフィードバックをお聞かせください。
            </p>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="感想やフィードバックを入力してください..."
              className="w-full h-64 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none shadow-inner"
            />

            <div className="flex justify-end mt-4">
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || isSubmitting}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 transition-all font-bold text-sm shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
              >
                {isSubmitting ? '送信中...' : '送信'}
              </button>
            </div>

            {submitted && (
              <div className="mt-4 bg-blue-50 border-2 border-blue-300 text-blue-700 px-4 py-3 rounded-xl text-sm font-medium">
                ✓ フィードバックを送信しました。ありがとうございます！
              </div>
            )}
          </div>

          <div className="mt-8 bg-gray-50 rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">💡 フィードバックのヒント</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>AIの投稿は自然に感じましたか？</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>空間の雰囲気はどうでしたか？</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>改善してほしい点はありますか？</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>追加してほしい機能はありますか？</span>
              </li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
