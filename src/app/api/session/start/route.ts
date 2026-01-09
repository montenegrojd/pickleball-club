
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export async function POST() {
    const newSession = await db.startNewSession();
    return NextResponse.json(newSession);
}
