'use client';

import { useEffect, useState } from 'react';
import AdminHeader from '@/components/admin/AdminHeader';
import AISettings from '@/components/admin/AISettings';

export default function AdminPage() {
  const [currentAIDensity, setCurrentAIDensity] = useState(0);

  useEffect(() => {
    loadAIDensity();
  }, []);

  const loadAIDensity = async () => {
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      if (data.posts) {
        const recentPosts = data.posts.slice(0, 20);
        const agentPosts = recentPosts.filter((p: any) => p.author_type === 'ai' || p.author_type === 'agent');
        setCurrentAIDensity(agentPosts.length / recentPosts.length);
      }
    } catch (error) {
      console.error('Failed to load density:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AISettings currentAIDensity={currentAIDensity} />
      </main>
    </div>
  );
}
