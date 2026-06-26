
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit  = parseInt(searchParams.get('limit')  ?? '10');
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const sessions = await db.getSessions();
    const allMatches = await db.getMatches();

    const sessionsWithStats = sessions.map((session) => {
        const sessionMatches = allMatches.filter(m => m.sessionId === session.id);
        const playerCount = session.playerIds.length > 0
            ? session.playerIds.length
            : new Set(sessionMatches.flatMap(m => [...m.team1, ...m.team2])).size;
        return {
            ...session,
            matchCount: sessionMatches.length,
            playerCount,
        };
    });

    sessionsWithStats.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    return NextResponse.json({
        sessions: sessionsWithStats.slice(offset, offset + limit),
        total: sessionsWithStats.length,
    });
}
