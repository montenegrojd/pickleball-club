
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { Match } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const range = searchParams.get('range');

    let matches: Match[];
    
    if (sessionId) {
        // Get matches for specific session
        matches = await db.getMatchesBySessionId(sessionId);
    } else {
        // Get all matches or filter by range
        matches = await db.getMatches();
        
        // Filter by active session if range is 'today'
        if (range === 'today') {
            const activeSession = await db.getActiveSession();
            if (activeSession) {
                matches = matches.filter(m => m.sessionId === activeSession.id);
            } else {
                matches = [];
            }
        }
    }

    const sessions = await db.getSessions();
    const closedSessionIds = new Set(sessions.filter(s => s.isClosed).map(s => s.id));

    const enrichedMatches = matches.map(m => ({
        ...m,
        isLocked: closedSessionIds.has(m.sessionId)
    }));

    return NextResponse.json(enrichedMatches);
}

export async function POST(request: Request) {
    const body = await request.json();
    
    // Get active session
    const activeSession = await db.getActiveSession();
    if (!activeSession) {
        return NextResponse.json({ error: "No active session. Please start a session first." }, { status: 400 });
    }
    
    // Create new match with sessionId
    const newMatch: Match = {
        id: uuidv4(),
        sessionId: activeSession.id,
        team1: body.team1,
        team2: body.team2,
        isFinished: false,
        timestamp: Date.now(),
        ...body
    };

    await db.addMatch(newMatch);
    return NextResponse.json(newMatch);
}

export async function PUT(request: Request) {
    const body = await request.json();
    
    // Check if match belongs to a closed session
    if (body.sessionId) {
        const session = await db.getSession(body.sessionId);
        if (session && session.isClosed) {
            return NextResponse.json({ error: "Session is closed. Scores are locked." }, { status: 403 });
        }
    }

    if (body.isFinished) {
        const players = await db.getPlayers();
        const matches = await db.getMatches();
        const oldMatchVersion = matches.find(m => m.id === body.id);

        const updateStats = async (ids: string[], isWin: boolean, pointsFor: number, pointsAgainst: number, multiplier: 1 | -1) => {
            for (const id of ids) {
                const p = players.find(x => x.id === id);
                if (p) {
                    p.matchesPlayed += (1 * multiplier);
                    if (isWin) p.matchesWon += (1 * multiplier);
                    p.pointsScored = (p.pointsScored || 0) + (pointsFor * multiplier);
                    p.pointsAllowed = (p.pointsAllowed || 0) + (pointsAgainst * multiplier);
                    await db.updatePlayer(p);
                }
            }
        };

        // 1. Revert Old Stats if it was previously finished
        if (oldMatchVersion && oldMatchVersion.isFinished && oldMatchVersion.winnerTeam) {
            if (oldMatchVersion.winnerTeam === 1) {
                await updateStats(oldMatchVersion.team1, true, oldMatchVersion.score1 || 0, oldMatchVersion.score2 || 0, -1);
                await updateStats(oldMatchVersion.team2, false, oldMatchVersion.score2 || 0, oldMatchVersion.score1 || 0, -1);
            } else {
                await updateStats(oldMatchVersion.team1, false, oldMatchVersion.score1 || 0, oldMatchVersion.score2 || 0, -1);
                await updateStats(oldMatchVersion.team2, true, oldMatchVersion.score2 || 0, oldMatchVersion.score1 || 0, -1);
            }
        }

        // 2. Apply New Stats
        const s1 = body.score1 || 0;
        const s2 = body.score2 || 0;
        const winnerTeam = s1 > s2 ? 1 : 2;
        body.winnerTeam = winnerTeam;

        if (winnerTeam === 1) {
            await updateStats(body.team1, true, s1, s2, 1);
            await updateStats(body.team2, false, s2, s1, 1);
        } else {
            await updateStats(body.team1, false, s1, s2, 1);
            await updateStats(body.team2, true, s2, s1, 1);
        }
    }

    // Save the match *after* we use old info
    await db.updateMatch(body);

    return NextResponse.json({ success: true });
}
