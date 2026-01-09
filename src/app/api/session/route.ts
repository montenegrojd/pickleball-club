
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    
    if (sessionId) {
        // Get specific session by ID
        const session = await db.getSession(sessionId);
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }
        return NextResponse.json(session);
    }
    
    // Get active session
    let session = await db.getActiveSession();
    if (!session) {
        session = await db.createSession();
    }
    return NextResponse.json(session);
}
