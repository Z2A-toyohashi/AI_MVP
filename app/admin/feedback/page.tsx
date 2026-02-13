'use client';

import { useEffect, useState } from 'react';
import FeedbackLog from '@/components/admin/FeedbackLog';
import AdminHeader from '@/components/admin/AdminHeader';

interface Feedback {
  id: string;
  user_id: string;
  content: string;
  created_at: number;
}

export default function FeedbackPage() {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback[]>([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const feedbackRes = await fetch('/api/feedback');
      const feedbackData = await feedbackRes.json();
      setFeedback(feedbackData.feedback || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 mt-4 sm:mt-6 mb-8">
        <FeedbackLog feedback={feedback} />
      </main>
    </div>
  );
}
