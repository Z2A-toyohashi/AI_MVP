'use client';

import AdminHeader from '@/components/admin/AdminHeader';
import AISettings from '@/components/admin/AISettings';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AISettings />
      </main>
    </div>
  );
}
