
import fs from 'fs/promises';
import path from 'path';
import { Match, Player, RosterSession, StorageAdapter } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

interface DBSchema {
    players: Player[];
    matches: Match[];
    sessions: RosterSession[];
}

const INITIAL_DB: DBSchema = {
    players: [],
    matches: [],
    sessions: [],
};

export class JsonFileAdapter implements StorageAdapter {
    private async readDB(): Promise<DBSchema> {
        try {
            const data = await fs.readFile(DB_PATH, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            // If file doesn't exist, create it
            await this.writeDB(INITIAL_DB);
            return INITIAL_DB;
        }
    }

    private async writeDB(data: DBSchema): Promise<void> {
        await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
    }

    // --- Players ---

    async getPlayers(): Promise<Player[]> {
        const db = await this.readDB();
        return db.players;
    }

    async addPlayer(name: string): Promise<Player> {
        const db = await this.readDB();
        // Check if player exists (case insensitive for simplicity)
        const existing = db.players.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing;

        const newPlayer: Player = {
            id: uuidv4(),
            name,
            matchesPlayed: 0,
            matchesWon: 0,
            pointsScored: 0,
            pointsAllowed: 0,
        };

        db.players.push(newPlayer);
        await this.writeDB(db);
        return newPlayer;
    }

    async updatePlayer(player: Player): Promise<void> {
        const db = await this.readDB();
        const index = db.players.findIndex(p => p.id === player.id);
        if (index !== -1) {
            db.players[index] = player;
            await this.writeDB(db);
        }
    }

    // --- Roster ---

    async getActiveSession(): Promise<RosterSession | null> {
        const db = await this.readDB();
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
        return db.sessions.find(s => s.id === today) || null;
    }

    async getSession(id: string): Promise<RosterSession | null> {
        const db = await this.readDB();
        return db.sessions.find(s => s.id === id) || null;
    }

    async getSessions(): Promise<RosterSession[]> {
        const db = await this.readDB();
        return db.sessions;
    }

    async createSession(): Promise<RosterSession> {
        const db = await this.readDB();
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone

        // Return existing if found
        const existing = db.sessions.find(s => s.id === today);
        if (existing) return existing;

        const newSession: RosterSession = {
            id: today,
            playerIds: [],
        };
        db.sessions.push(newSession);
        await this.writeDB(db);
        return newSession;
    }

    async checkInPlayer(playerId: string): Promise<void> {
        const db = await this.readDB();
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
        let session = db.sessions.find(s => s.id === today);

        if (!session) {
            session = { id: today, playerIds: [] };
            db.sessions.push(session);
        }

        if (!session.playerIds.includes(playerId)) {
            session.playerIds.push(playerId);
            await this.writeDB(db);
        }
    }

    async checkOutPlayer(playerId: string): Promise<void> {
        const db = await this.readDB();
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
        const session = db.sessions.find(s => s.id === today);

        if (session) {
            session.playerIds = session.playerIds.filter(id => id !== playerId);
            await this.writeDB(db);
        }
    }

    async closeSession(sessionId: string): Promise<void> {
        const db = await this.readDB();
        const session = db.sessions.find(s => s.id === sessionId);
        if (session) {
            session.playerIds = [];
            session.isClosed = true;
            await this.writeDB(db);
        }
    }

    // --- Matches ---

    async getMatches(): Promise<Match[]> {
        const db = await this.readDB();
        return db.matches;
    }

    async addMatch(match: Match): Promise<void> {
        const db = await this.readDB();
        db.matches.push(match);
        await this.writeDB(db);
    }

    async updateMatch(match: Match): Promise<void> {
        const db = await this.readDB();
        const index = db.matches.findIndex(m => m.id === match.id);
        if (index !== -1) {
            db.matches[index] = match;
            await this.writeDB(db);
        }
    }

    async deleteMatch(matchId: string): Promise<void> {
        const db = await this.readDB();
        db.matches = db.matches.filter(m => m.id !== matchId);
        await this.writeDB(db);
    }
}
