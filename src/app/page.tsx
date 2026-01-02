
'use client';

import { useState } from 'react';
import Roster from '@/components/Roster';
import MatchControl from '@/components/MatchControl';
import Leaderboard from '@/components/Leaderboard';
import MatchHistory from '@/components/MatchHistory';
import MatchmakingRules from '@/components/MatchmakingRules';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <>
      {/* Full-width header */}
      <header className="bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-md">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Pickleball Club</h1>
              <p className="text-emerald-100">Tuesday Night League</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="min-h-screen bg-gray-50 p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Roster & Stats */}
            <div className="md:col-span-4 space-y-6 order-2 md:order-1">
              <Roster onUpdate={handleUpdate} />
              <Leaderboard refreshTrigger={refreshTrigger} range="today" />
              <div className="text-center">
                <a href="/hall-of-fame" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline">
                  View Hall of Fame (All Time) &rarr;
                </a>
              </div>
              {/* Match History - shows below leaderboard on mobile, stays in left column on desktop */}
              <div className="md:hidden">
                <MatchHistory onUpdate={handleUpdate} refreshTrigger={refreshTrigger} />
                <MatchmakingRules />
              </div>
            </div>

            {/* Right Column: Active Match Area */}
            <div className="md:col-span-8 order-1 md:order-2">
              <MatchControl onUpdate={handleUpdate} refreshTrigger={refreshTrigger} />
              {/* Match History - hidden on mobile, shows on desktop */}
              <div className="hidden md:block">
                <MatchHistory onUpdate={handleUpdate} refreshTrigger={refreshTrigger} />
                <MatchmakingRules />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
