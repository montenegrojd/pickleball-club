import { Player, Match, RosterSession, StorageAdapter } from '@/lib/types';

/**
 * In-memory mock implementation of StorageAdapter for testing
 */
export class MockStorageAdapter implements StorageAdapter {
  private players: Player[] = [];
  private sessions: RosterSession[] = [];
  private matches: Match[] = [];

  constructor(
    initialPlayers: Player[] = [],
    initialSessions: RosterSession[] = [],
    initialMatches: Match[] = []
  ) {
    this.players = [...initialPlayers];
    this.sessions = [...initialSessions];
    this.matches = [...initialMatches];
  }

  // Players
  async getPlayers(): Promise<Player[]> {
    return [...this.players];
  }

  async addPlayer(name: string): Promise<Player> {
    // Check for duplicates
    const existing = this.players.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      return existing;
    }

    const newPlayer: Player = {
      id: `player-${Date.now()}-${Math.random()}`,
      name,
      matchesPlayed: 0,
      matchesWon: 0,
      pointsScored: 0,
      pointsAllowed: 0,
    };

    this.players.push(newPlayer);
    return newPlayer;
  }

  async updatePlayer(player: Player): Promise<void> {
    const index = this.players.findIndex(p => p.id === player.id);
    if (index !== -1) {
      this.players[index] = { ...player };
    }
  }

  // Sessions
  async getActiveSession(): Promise<RosterSession | null> {
    return this.sessions.find(s => s.isActive) || null;
  }

  async getSession(id: string): Promise<RosterSession | null> {
    return this.sessions.find(s => s.id === id) || null;
  }

  async getSessions(): Promise<RosterSession[]> {
    return [...this.sessions];
  }

  async createSession(): Promise<RosterSession> {
    // Deactivate all existing sessions
    this.sessions.forEach(s => {
      s.isActive = false;
    });

    const newSession: RosterSession = {
      id: `session-${Date.now()}-${Math.random()}`,
      startDate: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
      playerIds: [],
      isActive: true,
      isClosed: false,
    };

    this.sessions.push(newSession);
    return newSession;
  }

  async startNewSession(): Promise<RosterSession> {
    return this.createSession();
  }

  async checkInPlayer(playerId: string): Promise<void> {
    const session = await this.getActiveSession();
    if (!session) {
      throw new Error('No active session');
    }

    if (!session.playerIds.includes(playerId)) {
      session.playerIds.push(playerId);
    }
  }

  async checkOutPlayer(playerId: string): Promise<void> {
    const session = await this.getActiveSession();
    if (!session) {
      throw new Error('No active session');
    }

    session.playerIds = session.playerIds.filter(id => id !== playerId);
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.isActive = false;
    session.isClosed = true;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions = this.sessions.filter(s => s.id !== sessionId);
    this.matches = this.matches.filter(m => m.sessionId !== sessionId);
  }

  // Matches
  async getMatches(): Promise<Match[]> {
    return [...this.matches];
  }

  async getMatchesBySessionId(sessionId: string): Promise<Match[]> {
    return this.matches.filter(m => m.sessionId === sessionId);
  }

  async addMatch(match: Match): Promise<void> {
    this.matches.push({ ...match });
  }

  async updateMatch(match: Match): Promise<void> {
    const index = this.matches.findIndex(m => m.id === match.id);
    if (index !== -1) {
      this.matches[index] = { ...match };
    }
  }

  async deleteMatch(matchId: string): Promise<void> {
    this.matches = this.matches.filter(m => m.id !== matchId);
  }

  // Helper methods for testing
  reset(): void {
    this.players = [];
    this.sessions = [];
    this.matches = [];
  }

  seed(
    players: Player[] = [],
    sessions: RosterSession[] = [],
    matches: Match[] = []
  ): void {
    this.players = [...players];
    this.sessions = [...sessions];
    this.matches = [...matches];
  }
}
