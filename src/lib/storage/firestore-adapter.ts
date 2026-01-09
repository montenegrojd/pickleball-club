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
        const snapshot = await this.db.collection('sessions')
            .where('isActive', '==', true)
            .limit(1)
            .get();
        
        if (snapshot.empty) return null;
        return snapshot.docs[0].data() as RosterSession;
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
        // Check if an active session already exists
        const existing = await this.getActiveSession();
        if (existing) return existing;

        const sessionId = uuidv4();
        const startDate = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
        
        const newSession: RosterSession = {
            id: sessionId,
            startDate,
            playerIds: [],
            isActive: true,
            isClosed: false,
        };

        await this.db.collection('sessions').doc(sessionId).set(newSession);
        return newSession;
    }

    async startNewSession(): Promise<RosterSession> {
        // Deactivate any currently active session
        const activeSession = await this.getActiveSession();
        if (activeSession) {
            activeSession.isActive = false;
            await this.db.collection('sessions').doc(activeSession.id).set(activeSession);
        }

        // Create new session
        const sessionId = uuidv4();
        const startDate = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
        
        const newSession: RosterSession = {
            id: sessionId,
            startDate,
            playerIds: [],
            isActive: true,
            isClosed: false,
        };

        await this.db.collection('sessions').doc(sessionId).set(newSession);
        return newSession;
    }

    async checkInPlayer(playerId: string): Promise<void> {
        // Get or create active session
        let session = await this.getActiveSession();
        if (!session) {
            session = await this.createSession();
        }
        
        const sessionRef = this.db.collection('sessions').doc(session.id);
        
        await this.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(sessionRef);
            
            if (doc.exists) {
                const currentSession = doc.data() as RosterSession;
                if (!currentSession.playerIds.includes(playerId)) {
                    currentSession.playerIds.push(playerId);
                }
                transaction.set(sessionRef, currentSession);
            }
        });
    }

    async checkOutPlayer(playerId: string): Promise<void> {
        const session = await this.getActiveSession();
        if (!session) return;
        
        const sessionRef = this.db.collection('sessions').doc(session.id);
        
        await this.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(sessionRef);
            
            if (doc.exists) {
                const currentSession = doc.data() as RosterSession;
                currentSession.playerIds = currentSession.playerIds.filter(id => id !== playerId);
                transaction.set(sessionRef, currentSession);
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
                session.isActive = false;
                transaction.set(sessionRef, session);
            }
        });
    }

    async deleteSession(sessionId: string): Promise<void> {
        // Delete the session document
        await this.db.collection('sessions').doc(sessionId).delete();
        
        // Delete all matches associated with this session
        const matchesSnapshot = await this.db.collection('matches')
            .where('sessionId', '==', sessionId)
            .get();
        
        const batch = this.db.batch();
        matchesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    }

    // --- Matches ---

    async getMatches(): Promise<Match[]> {
        const snapshot = await this.db.collection('matches').orderBy('timestamp', 'desc').get();
        return snapshot.docs.map(doc => doc.data() as Match);
    }

    async getMatchesBySessionId(sessionId: string): Promise<Match[]> {
        const snapshot = await this.db.collection('matches')
            .where('sessionId', '==', sessionId)
            .get();
        
        // Sort in-memory instead of using orderBy to avoid composite index requirement
        const matches = snapshot.docs.map(doc => doc.data() as Match);
        return matches.sort((a, b) => b.timestamp - a.timestamp);
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
