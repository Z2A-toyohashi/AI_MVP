'use client';

import { formatTime, getUserColor } from '@/lib/utils';

interface ChatMessage {
  id: string;
  user_id: string;
  role: string;
  content: string;
  media_url?: string;
  media_type?: string;
  created_at: number;
}

interface ChatLogProps {
  messages: ChatMessage[];
}

export default function ChatLog({ messages }: ChatLogProps) {
  // ユーザーごとにグループ化
  const groupedByUser = messages.reduce((acc, msg) => {
    if (!acc[msg.user_id]) {
      acc[msg.user_id] = [];
    }
    acc[msg.user_id].push(msg);
    return acc;
  }, {} as Record<string, ChatMessage[]>);

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 shadow-lg p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
        <span>💬</span> 1on1チャットログ
      </h2>

      {messages.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          チャットログがまだありません
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByUser).map(([userId, userMessages]) => (
            <div
              key={userId}
              className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-blue-300">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: getUserColor(userId) }}
                >
                  {userId.slice(-2)}
                </div>
                <span className="font-bold text-gray-800">ID: {userId}</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {userMessages.length}件のメッセージ
                </span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {userMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-800 border border-gray-200'
                      }`}
                    >
                      {msg.media_url && msg.media_type === 'image' && (
                        <img
                          src={msg.media_url}
                          alt="送信画像"
                          className="max-w-full rounded mb-2 max-h-32 object-contain"
                        />
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
