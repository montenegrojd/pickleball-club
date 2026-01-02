
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export async function GET() {
    let session = await db.getActiveSession();
    if (!session) {
        session = await db.createSession();
    }
    return NextResponse.json(session);
}
