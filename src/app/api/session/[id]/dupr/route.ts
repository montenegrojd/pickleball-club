import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { computeSessionDuprMovement } from '@/lib/dupr';

export const dynamic = 'force-dynamic';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: sessionId } = await params;
    const [players, matches] = await Promise.all([db.getPlayers(), db.getMatches()]);
    return NextResponse.json(computeSessionDuprMovement(players, matches, sessionId));
}
