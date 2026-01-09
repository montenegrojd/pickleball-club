
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { Match, Player } from '@/lib/types';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: sessionId } = await params;

    // Check if session exists and is closed
    const session = await db.getSession(sessionId);
    if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.isActive) {
        return NextResponse.json({ error: 'Cannot delete active session' }, { status: 400 });
    }

    // Delete the session and its matches
    await db.deleteSession(sessionId);

    // Recalculate all player stats from remaining matches
    await recalculateAllPlayerStats();

    return NextResponse.json({ success: true });
}

async function recalculateAllPlayerStats() {
    const [players, matches] = await Promise.all([
        db.getPlayers(),
        db.getMatches()
    ]);

    // Reset all player stats to zero
    const statsMap = new Map<string, Player>();
    players.forEach(p => {
        statsMap.set(p.id, {
            ...p,
            matchesPlayed: 0,
            matchesWon: 0,
            pointsScored: 0,
            pointsAllowed: 0
        });
    });

    // Recalculate from all finished matches
    const finishedMatches = matches.filter(m => m.isFinished);
    
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

    // Update all players in database
    await Promise.all(
        Array.from(statsMap.values()).map(player => db.updatePlayer(player))
    );
}
