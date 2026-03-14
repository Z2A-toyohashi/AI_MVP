'use client';

import { useRouter } from 'next/navigation';

interface HeaderProps {
  agent?: { name?: string };
  title?: string;
  showBack?: boolean;
  onAgentUpdate?: (updated: any) => void;
}

export default function Header({ title = 'Symbio', showBack = false }: HeaderProps) {
  const router = useRouter();

  return (
    <header className="flex-shrink-0 bg-white border-b border-gray-100 px-4 flex items-center justify-between sticky top-0 z-40 min-h-[64px]">
      {showBack ? (
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      ) : (
        <span className="text-xl font-black text-[#58cc02] tracking-tight">Symbio</span>
      )}

      <h1 className="text-base font-black text-gray-800 absolute left-1/2 -translate-x-1/2">{title}</h1>

      <div className="w-10" />
    </header>
  );
}
