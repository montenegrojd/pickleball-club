
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { Player, Match } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const range = searchParams.get('range') || 'today';

    const players = await db.getPlayers();
    let matches: Match[];

    if (sessionId) {
        // Get matches for specific session
        matches = await db.getMatchesBySessionId(sessionId);
    } else if (range === 'today') {
        // Get matches for active session
        const activeSession = await db.getActiveSession();
        if (activeSession) {
            matches = await db.getMatchesBySessionId(activeSession.id);
        } else {
            matches = [];
        }
    } else {
        // Get all matches
        matches = await db.getMatches();
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

    // Filter by session playerIds if sessionId is provided
    if (sessionId) {
        const session = await db.getSession(sessionId);
        if (session) {
            results = results.filter(p => session.playerIds.includes(p.id));
        } else {
            // Session not found, return empty array
            results = [];
        }
    }

    return NextResponse.json(results);
}
