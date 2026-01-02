
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { Matchmaker } from '@/lib/matchmaker';

export async function GET() {
    const session = await db.getActiveSession();
    if (!session) return NextResponse.json({ error: 'No session' }, { status: 400 });

    const matches = await db.getMatches();
    // Filter matches to only today's for context? Or all time?
    // Algorithm usually cares about "just now" (today).
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todaysMatches = matches.filter(m => m.timestamp >= todayStart);

    // Filter out players currently in an active match
    const activeMatches = todaysMatches.filter(m => !m.isFinished);
    const busyPlayerIds = new Set<string>();
    activeMatches.forEach(m => {
        m.team1.forEach(id => busyPlayerIds.add(id));
        m.team2.forEach(id => busyPlayerIds.add(id));
    });

    const availablePlayers = session.playerIds.filter(id => !busyPlayerIds.has(id));

    const proposal = Matchmaker.proposeMatch(availablePlayers, todaysMatches);

    return NextResponse.json(proposal);
}
