
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export async function DELETE(request: Request) {
    const { playerId } = await request.json();
    if (!playerId) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await db.checkOutPlayer(playerId);
    return NextResponse.json({ success: true });
}
