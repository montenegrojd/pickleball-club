'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Home as HomeIcon, AlertCircle } from 'lucide-react';
import Roster from '@/components/Roster';
import MatchControl from '@/components/MatchControl';
import Leaderboard from '@/components/Leaderboard';
import MatchHistory from '@/components/MatchHistory';
import SessionStats from '@/components/SessionStats';
import MatchmakingRules from '@/components/MatchmakingRules';
import { RosterSession } from '@/lib/types';

export default function SessionDashboard() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [session, setSession] = useState<RosterSession | null>(null);

  const handleUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    const fetchSession = async () => {
      const res = await fetch(`/api/session?id=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data);
      }
    };
    fetchSession();
  }, [sessionId, refreshTrigger]);

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
            <Link 
              href="/"
              className="flex items-center gap-2 text-white hover:text-emerald-100 transition-colors"
            >
              <HomeIcon className="w-5 h-5" />
              <span className="font-semibold">Home</span>
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

      {/* Main content */}
      <main className="min-h-screen bg-gray-50 p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Roster & Stats */}
            <div className="md:col-span-4 space-y-6 order-2 md:order-1">
              {session?.isActive && (
                <Roster onUpdate={handleUpdate} sessionId={sessionId} />
              )}
              <Leaderboard refreshTrigger={refreshTrigger} sessionId={sessionId} />
              {/* Match History - shows below leaderboard on mobile, stays in left column on desktop */}
              <div className="md:hidden">
                <SessionStats refreshTrigger={refreshTrigger} sessionId={sessionId} />
                <MatchHistory onUpdate={handleUpdate} refreshTrigger={refreshTrigger} sessionId={sessionId} />
                <MatchmakingRules />
              </div>
            </div>

            {/* Right Column: Active Match Area */}
            <div className="md:col-span-8 order-1 md:order-2">
              {session?.isActive && (
                <MatchControl onUpdate={handleUpdate} refreshTrigger={refreshTrigger} sessionId={sessionId} />
              )}
              {/* Match History - hidden on mobile, shows on desktop */}
              <div className="hidden md:block">
                <SessionStats refreshTrigger={refreshTrigger} sessionId={sessionId} />
                <MatchHistory onUpdate={handleUpdate} refreshTrigger={refreshTrigger} sessionId={sessionId} />
                <MatchmakingRules />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
