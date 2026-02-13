'use client';

import { formatTime } from '@/lib/utils';

interface Feedback {
  id: string;
  user_id: string;
  content: string;
  created_at: number;
}

interface FeedbackLogProps {
  feedback: Feedback[];
}

export default function FeedbackLog({ feedback }: FeedbackLogProps) {
  return (
    <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-lg p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
        <span>💬</span> フィードバック一覧
      </h2>

      <div className="space-y-4">
        {feedback.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            フィードバックがまだありません
          </div>
        ) : (
          feedback.map((item) => (
            <div
              key={item.id}
              className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border-2 border-indigo-200 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-indigo-600">
                  ID: {item.user_id}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(item.created_at)}
                </span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                {item.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
