'use client';

import Link from 'next/link';
import { Home as HomeIcon, AlertCircle, Activity, BarChart3, HelpCircle } from 'lucide-react';
import { RosterSession } from '@/lib/types';

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export default function SessionHeader({
  session,
  sessionId,
  activeTab
}: {
  session: RosterSession | null;
  sessionId: string;
  activeTab: 'live' | 'stats';
}) {
  return (
    <>
      {/* Full-width header */}
      <header className="bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-md">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Pickleball Club</h1>
              <p className="text-emerald-100">Tuesday Night League</p>
              {session && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-emerald-200">
                    Session: {formatDate(session.startDate)}
                  </span>
                  {session.isActive && (
                    <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-semibold rounded-full">
                      Active
                    </span>
                  )}
                  {session.isClosed && !session.isActive && (
                    <span className="px-2 py-0.5 bg-gray-500 text-white text-xs font-semibold rounded-full">
                      Closed
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/help"
                className="flex items-center gap-2 text-white hover:text-emerald-100 transition-colors"
              >
                <HelpCircle className="w-5 h-5" />
                <span className="font-semibold">Help</span>
              </Link>
              <Link
                href="/"
                className="flex items-center gap-2 text-white hover:text-emerald-100 transition-colors"
              >
                <HomeIcon className="w-5 h-5" />
                <span className="font-semibold">Home</span>
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-2">
            <Link
              href={`/session/${sessionId}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'live'
                  ? 'bg-white text-emerald-700'
                  : 'text-emerald-100 hover:bg-white/10'
              }`}
            >
              <Activity className="w-4 h-4" />
              Live
            </Link>
            <Link
              href={`/session/${sessionId}/stats`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'stats'
                  ? 'bg-white text-emerald-700'
                  : 'text-emerald-100 hover:bg-white/10'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Stats
            </Link>
          </div>
        </div>
      </header>

      {/* Historical Session Warning */}
      {session && !session.isActive && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-3">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">Viewing Historical Session</span>
              <span className="text-amber-700">- Read-only</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
