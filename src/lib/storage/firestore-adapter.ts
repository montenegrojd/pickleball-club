import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { Match, Player, RosterSession, StorageAdapter } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export class FirestoreAdapter implements StorageAdapter {
    private db: Firestore;

    constructor() {
        // Initialize Firebase Admin if not already initialized
        if (!getApps().length) {
            // In Cloud Run, this will use Application Default Credentials automatically
            // For local dev, set GOOGLE_APPLICATION_CREDENTIALS or use emulator
            initializeApp();
        }
        this.db = getFirestore();
    }

    // --- Players ---

    async getPlayers(): Promise<Player[]> {
        const snapshot = await this.db.collection('players').get();
        return snapshot.docs.map(doc => doc.data() as Player);
    }

    async addPlayer(name: string): Promise<Player> {
        // Check if player exists (case insensitive)
        const snapshot = await this.db.collection('players').get();
        const existing = snapshot.docs
            .map(doc => doc.data() as Player)
            .find(p => p.name.toLowerCase() === name.toLowerCase());
        
        if (existing) return existing;

        const newPlayer: Player = {
            id: uuidv4(),
            name,
            matchesPlayed: 0,
            matchesWon: 0,
            pointsScored: 0,
            pointsAllowed: 0,
        };

        await this.db.collection('players').doc(newPlayer.id).set(newPlayer);
        return newPlayer;
    }

    async updatePlayer(player: Player): Promise<void> {
        await this.db.collection('players').doc(player.id).set(player);
    }

    // --- Roster ---

    async getActiveSession(): Promise<RosterSession | null> {
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        const doc = await this.db.collection('sessions').doc(today).get();
        
        if (!doc.exists) return null;
        return doc.data() as RosterSession;
    }

    async getSession(id: string): Promise<RosterSession | null> {
        const doc = await this.db.collection('sessions').doc(id).get();
        
        if (!doc.exists) return null;
        return doc.data() as RosterSession;
    }

    async getSessions(): Promise<RosterSession[]> {
        const snapshot = await this.db.collection('sessions').get();
        return snapshot.docs.map(doc => doc.data() as RosterSession);
    }

    async createSession(): Promise<RosterSession> {
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        
        // Check if session exists
        const existing = await this.getSession(today);
        if (existing) return existing;

        const newSession: RosterSession = {
            id: today,
            playerIds: [],
        };

        await this.db.collection('sessions').doc(today).set(newSession);
        return newSession;
    }

    async checkInPlayer(playerId: string): Promise<void> {
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        const sessionRef = this.db.collection('sessions').doc(today);
        
        await this.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(sessionRef);
            
            let session: RosterSession;
            if (!doc.exists) {
                session = { id: today, playerIds: [playerId] };
            } else {
                session = doc.data() as RosterSession;
                if (!session.playerIds.includes(playerId)) {
                    session.playerIds.push(playerId);
                }
            }
            
            transaction.set(sessionRef, session);
        });
    }

    async checkOutPlayer(playerId: string): Promise<void> {
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        const sessionRef = this.db.collection('sessions').doc(today);
        
        await this.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(sessionRef);
            
            if (doc.exists) {
                const session = doc.data() as RosterSession;
                session.playerIds = session.playerIds.filter(id => id !== playerId);
                transaction.set(sessionRef, session);
            }
        });
    }

    async closeSession(sessionId: string): Promise<void> {
        const sessionRef = this.db.collection('sessions').doc(sessionId);
        
        await this.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(sessionRef);
            
            if (doc.exists) {
                const session = doc.data() as RosterSession;
                session.playerIds = [];
                session.isClosed = true;
                transaction.set(sessionRef, session);
            }
        });
    }

    // --- Matches ---

    async getMatches(): Promise<Match[]> {
        const snapshot = await this.db.collection('matches').orderBy('timestamp', 'desc').get();
        return snapshot.docs.map(doc => doc.data() as Match);
    }

    async addMatch(match: Match): Promise<void> {
        await this.db.collection('matches').doc(match.id).set(match);
    }

    async updateMatch(match: Match): Promise<void> {
        await this.db.collection('matches').doc(match.id).set(match);
    }

    async deleteMatch(matchId: string): Promise<void> {
        await this.db.collection('matches').doc(matchId).delete();
    }
}
