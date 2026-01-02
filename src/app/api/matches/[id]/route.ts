import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: matchId } = await params;
    await db.deleteMatch(matchId);
    return NextResponse.json({ success: true });
}
