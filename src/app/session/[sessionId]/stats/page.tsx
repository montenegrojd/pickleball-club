'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import PlayerInsights from '@/components/PlayerInsights';
import SessionStats from '@/components/SessionStats';
import PlayerMatchups from '@/components/PlayerMatchups';
import SessionHeader from '@/components/SessionHeader';
import { RosterSession } from '@/lib/types';

export default function SessionStatsPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<RosterSession | null>(null);
  const refreshTrigger = 0;

  useEffect(() => {
    const fetchSession = async () => {
      const res = await fetch(`/api/session?id=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data);
      }
    };
    fetchSession();
  }, [sessionId]);

  return (
    <>
      <SessionHeader session={session} sessionId={sessionId} activeTab="stats" />

      {/* Main content */}
      <main className="min-h-screen bg-gray-50 p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
        <div className="max-w-4xl mx-auto space-y-6">
          <PlayerInsights refreshTrigger={refreshTrigger} sessionId={sessionId} />
          <SessionStats refreshTrigger={refreshTrigger} sessionId={sessionId} defaultExpanded />
          <PlayerMatchups refreshTrigger={refreshTrigger} sessionId={sessionId} defaultExpanded />
        </div>
      </main>
    </>
  );
}
