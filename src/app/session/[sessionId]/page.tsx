'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Roster from '@/components/Roster';
import MatchControl from '@/components/MatchControl';
import MatchHistory from '@/components/MatchHistory';
import SessionHeader from '@/components/SessionHeader';
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

  return (
    <>
      <SessionHeader session={session} sessionId={sessionId} activeTab="live" />

      {/* Main content */}
      <main className="min-h-screen bg-gray-50 p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
        <div className="max-w-6xl mx-auto space-y-6">
          {session?.isActive && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Roster */}
              <div className="md:col-span-4 order-2 md:order-1">
                <Roster onUpdate={handleUpdate} sessionId={sessionId} />
              </div>

              {/* Active Match */}
              <div className="md:col-span-8 order-1 md:order-2">
                <MatchControl onUpdate={handleUpdate} refreshTrigger={refreshTrigger} sessionId={sessionId} />
              </div>
            </div>
          )}

          <MatchHistory onUpdate={handleUpdate} refreshTrigger={refreshTrigger} sessionId={sessionId} defaultExpanded />
        </div>
      </main>
    </>
  );
}
