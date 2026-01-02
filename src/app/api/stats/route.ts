
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { Player, Match } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'today';

    const [players, matches] = await Promise.all([
        db.getPlayers(),
        db.getMatches()
    ]);

    // Filter matches
    let filteredMatches = matches.filter(m => m.isFinished);

    if (range === 'today') {
        // Get start of today (local time effectively, but using server time)
        // Since we store timestamps, we can approximate "today" by 
        // getting 00:00:00 of the current date.
        // Note: Ideally we'd use the client's timezone, but server-time is acceptable for now.
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        filteredMatches = filteredMatches.filter(m => m.timestamp >= todayStart.getTime());
    }

    // Calculate stats
    const statsMap = new Map<string, Player>();

    // Initialize map with base player info but 0 stats
    players.forEach(p => {
        statsMap.set(p.id, {
            ...p,
            matchesPlayed: 0,
            matchesWon: 0,
            pointsScored: 0,
            pointsAllowed: 0
        });
    });

    filteredMatches.forEach(m => {
        const updateStats = (playerId: string, isWinner: boolean, scored: number, allowed: number) => {
            const p = statsMap.get(playerId);
            if (p) {
                p.matchesPlayed += 1;
                if (isWinner) p.matchesWon += 1;
                p.pointsScored += scored;
                p.pointsAllowed += allowed;
            }
        };

        const s1 = m.score1 || 0;
        const s2 = m.score2 || 0;
        const win1 = m.winnerTeam === 1;

        m.team1.forEach(id => updateStats(id, win1, s1, s2));
        m.team2.forEach(id => updateStats(id, !win1, s2, s1));
    });

    const results = Array.from(statsMap.values());

    return NextResponse.json(results);
}
