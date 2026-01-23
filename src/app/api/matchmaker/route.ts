
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { Matchmaker } from '@/lib/matchmaker';
import { Match, Player } from '@/lib/types';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'rotation'; // 'rotation', 'strict-partners', or 'playoff'

    const session = await db.getActiveSession();
    if (!session) return NextResponse.json({ error: 'No session' }, { status: 400 });

    // Get all matches for current session
    const sessionMatches = await db.getMatchesBySessionId(session.id);

    // Get all players to create name map
    const allPlayers = await db.getPlayers();
    const playerNames = new Map(allPlayers.map(p => [p.id, p.name]));

    // Filter out players currently in an active match
    const activeMatches = sessionMatches.filter(m => !m.isFinished);
    const busyPlayerIds = new Set<string>();
    activeMatches.forEach(m => {
        m.team1.forEach(id => busyPlayerIds.add(id));
        m.team2.forEach(id => busyPlayerIds.add(id));
    });

    const availablePlayers = session.playerIds.filter(id => !busyPlayerIds.has(id));

    let proposal;
    
    if (mode === 'playoff') {
        // Calculate stats for playoff seeding
        const finishedMatches = sessionMatches.filter(m => m.isFinished);
        const statsMap = new Map<string, Player>();

        // Initialize stats for all players in session
        allPlayers.forEach(p => {
            if (session.playerIds.includes(p.id)) {
                statsMap.set(p.id, {
                    ...p,
                    matchesPlayed: 0,
                    matchesWon: 0,
                    pointsScored: 0,
                    pointsAllowed: 0
                });
            }
        });

        // Calculate stats from finished matches
        finishedMatches.forEach(m => {
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

        const playerStats = Array.from(statsMap.values());
        proposal = Matchmaker.proposePlayoffMatch(availablePlayers, sessionMatches, playerStats, playerNames);
    } else {
        // Rotation or strict-partners mode
        proposal = Matchmaker.proposeMatch(availablePlayers, sessionMatches, playerNames, mode as 'rotation' | 'strict-partners');
    }

    return NextResponse.json(proposal);
}
