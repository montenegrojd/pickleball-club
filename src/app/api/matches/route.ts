
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { Match } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const showAllTime = searchParams.get('range') === 'all';

    let matches: Match[];
    
    if (sessionId) {
        // Get matches for specific session
        matches = await db.getMatchesBySessionId(sessionId);
    } else if (showAllTime) {
        // Get all matches across all sessions
        matches = await db.getMatches();
    } else {
        // Get matches for active session
        const activeSession = await db.getActiveSession();
        if (activeSession) {
            matches = await db.getMatchesBySessionId(activeSession.id);
        } else {
            matches = [];
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

    const team1 = Array.isArray(body.team1) ? body.team1 as string[] : [];
    const team2 = Array.isArray(body.team2) ? body.team2 as string[] : [];

    if (team1.length !== 2 || team2.length !== 2) {
        return NextResponse.json({ error: 'Matches must have exactly 2 players per team.' }, { status: 400 });
    }

    const allSelectedIds = [...team1, ...team2];
    if (new Set(allSelectedIds).size !== 4) {
        return NextResponse.json({ error: 'Each selected player must be unique across both teams.' }, { status: 400 });
    }

    const rosterSet = new Set(activeSession.playerIds);
    const outOfRoster = allSelectedIds.filter(playerId => !rosterSet.has(playerId));
    if (outOfRoster.length > 0) {
        return NextResponse.json({ error: 'All selected players must be checked in for the active session.' }, { status: 400 });
    }

    const existingMatches = await db.getMatchesBySessionId(activeSession.id);
    const activeMatches = existingMatches.filter(match => !match.isFinished);
    const busyPlayers = new Set(activeMatches.flatMap(match => [...match.team1, ...match.team2]));
    const alreadyBusy = allSelectedIds.filter(playerId => busyPlayers.has(playerId));

    if (alreadyBusy.length > 0) {
        return NextResponse.json({ error: 'One or more selected players are already in an active match.' }, { status: 400 });
    }
    
    // Create new match with sessionId
    const newMatch: Match = {
        ...body,
        id: uuidv4(),
        sessionId: activeSession.id,
        team1,
        team2,
        isFinished: false,
        timestamp: Date.now(),
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
