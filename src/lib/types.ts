
export interface Player {
  id: string;
  name: string;
  matchesPlayed: number;
  matchesWon: number;
  pointsScored: number;
  pointsAllowed: number;
}

export interface PlayerStats extends Player {
  // Purely for clarity, currently identical structure
}

export interface Match {
  id: string;
  sessionId: string; // UUID of the session this match belongs to
  team1: string[]; // Player IDs
  team2: string[]; // Player IDs
  score1?: number;
  score2?: number;
  isFinished: boolean;
  timestamp: number;
  winnerTeam?: 1 | 2; // 1 or 2
  courtNumber?: number; // Added optional field
  isLocked?: boolean; // Computed field from API
}

export interface RosterSession {
  id: string; // UUID
  startDate: string; // ISO date string in EST
  playerIds: string[];
  isActive: boolean; // true if this is the current active session
  isClosed?: boolean; // true if session has been closed
}

export interface StorageAdapter {
  // Players
  getPlayers(): Promise<Player[]>;
  addPlayer(name: string): Promise<Player>;
  updatePlayer(player: Player): Promise<void>;

  // Roster
  getActiveSession(): Promise<RosterSession | null>;
  getSession(id: string): Promise<RosterSession | null>;
  getSessions(): Promise<RosterSession[]>;
  createSession(): Promise<RosterSession>;
  startNewSession(): Promise<RosterSession>;
  checkInPlayer(playerId: string): Promise<void>;
  checkOutPlayer(playerId: string): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  // Matches
  getMatches(): Promise<Match[]>;
  getMatchesBySessionId(sessionId: string): Promise<Match[]>;
  addMatch(match: Match): Promise<void>;
  updateMatch(match: Match): Promise<void>;
  deleteMatch(matchId: string): Promise<void>;
}
