
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { Matchmaker } from '@/lib/matchmaker';

export async function GET() {
    const session = await db.getActiveSession();
    if (!session) return NextResponse.json({ error: 'No session' }, { status: 400 });

    // Get all matches for current session
    const sessionMatches = await db.getMatchesBySessionId(session.id);

    // Filter out players currently in an active match
    const activeMatches = sessionMatches.filter(m => !m.isFinished);
    const busyPlayerIds = new Set<string>();
    activeMatches.forEach(m => {
        m.team1.forEach(id => busyPlayerIds.add(id));
        m.team2.forEach(id => busyPlayerIds.add(id));
    });

    const availablePlayers = session.playerIds.filter(id => !busyPlayerIds.has(id));

    const proposal = Matchmaker.proposeMatch(availablePlayers, sessionMatches);

    return NextResponse.json(proposal);
}
