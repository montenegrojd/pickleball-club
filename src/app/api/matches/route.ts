
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';
import { Match } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range');

    let matches = await db.getMatches();
    const sessions = await db.getSessions();
    const closedSessionIds = new Set(sessions.filter(s => s.isClosed).map(s => s.id));

    // Filter by date range if requested
    if (range === 'today') {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        matches = matches.filter(m => m.timestamp >= todayStart.getTime());
    }

    const enrichedMatches = matches.map(m => {
        const matchDate = new Date(m.timestamp).toLocaleDateString('en-CA');
        return {
            ...m,
            isLocked: closedSessionIds.has(matchDate)
        };
    });

    return NextResponse.json(enrichedMatches);
}

export async function POST(request: Request) {
    const body = await request.json();
    // We expect a partial match object (team1, team2) or a full result
    // If it's a new match being started:
    const newMatch: Match = {
        id: uuidv4(),
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
    // If match finished, update player stats?
    // Case A: Match WAS finished, and is STILL finished (Editing a score)
    // We need to revert the OLD stats first, then apply NEW stats.
    // Check for "Closed Session" lock
    if (body.timestamp) {
        // Find session for this match
        // Assuming session ID is YYYY-MM-DD
        const matchDate = new Date(body.timestamp).toLocaleDateString('en-CA');

        const session = await db.getSession(matchDate);
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
