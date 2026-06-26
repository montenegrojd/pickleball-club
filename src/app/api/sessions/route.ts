
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit  = parseInt(searchParams.get('limit')  ?? '10');
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const sessions = await db.getSessions();
    const allMatches = await db.getMatches();

    const sessionsWithStats = sessions.map((session) => ({
        ...session,
        matchCount: allMatches.filter(m => m.sessionId === session.id).length,
        playerCount: session.playerIds.length,
    }));

    sessionsWithStats.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    return NextResponse.json({
        sessions: sessionsWithStats.slice(offset, offset + limit),
        total: sessionsWithStats.length,
    });
}
