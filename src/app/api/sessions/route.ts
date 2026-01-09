
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export async function GET() {
    const sessions = await db.getSessions();
    
    // Calculate stats for each session
    const allMatches = await db.getMatches();
    
    const sessionsWithStats = await Promise.all(sessions.map(async (session) => {
        const sessionMatches = allMatches.filter(m => m.sessionId === session.id);
        
        return {
            ...session,
            matchCount: sessionMatches.length,
            playerCount: session.playerIds.length,
        };
    }));
    
    // Sort by startDate descending (newest first)
    sessionsWithStats.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    
    return NextResponse.json(sessionsWithStats);
}
