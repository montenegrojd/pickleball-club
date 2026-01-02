
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export async function POST() {
    const session = await db.getActiveSession();

    if (session) {
        await db.closeSession(session.id);
    }

    return NextResponse.json({ success: true });
}
