import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { buildSessionMatchHistoryExport } from '@/lib/session-match-history-export';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: sessionId } = await params;
    const session = await db.getSession(sessionId);

    if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const [matches, players] = await Promise.all([
        db.getMatchesBySessionId(sessionId),
        db.getPlayers()
    ]);

    const { csv, filename } = buildSessionMatchHistoryExport(sessionId, session.startDate, matches, players);

    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`
        }
    });
}