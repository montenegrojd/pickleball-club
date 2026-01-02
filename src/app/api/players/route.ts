
import { NextResponse } from 'next/server';
import { db } from '@/lib/storage';

export async function GET() {
    const players = await db.getPlayers();
    return NextResponse.json(players);
}

export async function POST(request: Request) {
    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const player = await db.addPlayer(name);
    return NextResponse.json(player);
}
