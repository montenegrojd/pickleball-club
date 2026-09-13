
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { Player, Match } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const showAllTime = searchParams.get('range') === 'all';

    const players = await db.getPlayers();
    let matches: Match[];
    let recentSessionCount = 0;

    if (sessionId) {
        matches = await db.getMatchesBySessionId(sessionId);
    } else if (showAllTime) {
        matches = await db.getMatches();
    } else if (searchParams.get('range') === 'recent') {
        // Last 3 closed sessions
        const allSessions = await db.getSessions();
        const recentSessions = allSessions
            .filter(s => s.isClosed)
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
            .slice(0, 3);
        recentSessionCount = recentSessions.length;
        const sessionIds = new Set(recentSessions.map(s => s.id));
        const allMatches = await db.getMatches();
        matches = allMatches.filter(m => sessionIds.has(m.sessionId ?? ''));
    } else {
        const activeSession = await db.getActiveSession();
        if (activeSession) {
            matches = await db.getMatchesBySessionId(activeSession.id);
        } else {
            matches = [];
        }
    }

    // Filter to finished matches only
    const filteredMatches = matches.filter(m => m.isFinished);

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

    let results = Array.from(statsMap.values());

    // Filter to players who actually played in this session
    if (sessionId) {
        // Show all players who participated in matches during this session
        results = results.filter(p => p.matchesPlayed > 0);
    }

    if (searchParams.get('range') === 'recent') {
        return NextResponse.json({ players: results, sessionCount: recentSessionCount });
    }

    return NextResponse.json(results);
}
