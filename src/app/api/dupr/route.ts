import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { computeDuprRatings } from '@/lib/dupr';

export const dynamic = 'force-dynamic';

export async function GET() {
    const [players, matches] = await Promise.all([db.getPlayers(), db.getMatches()]);
    return NextResponse.json(computeDuprRatings(players, matches));
}
