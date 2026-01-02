
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export async function POST(request: Request) {
    const { playerId } = await request.json();
    if (!playerId) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await db.checkInPlayer(playerId);
    return NextResponse.json({ success: true });
}
