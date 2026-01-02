
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
  id: string; // usually YYYY-MM-DD
  playerIds: string[];
  isClosed?: boolean;
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
  checkInPlayer(playerId: string): Promise<void>;
  checkOutPlayer(playerId: string): Promise<void>;
  closeSession(sessionId: string): Promise<void>;

  // Matches
  getMatches(): Promise<Match[]>;
  addMatch(match: Match): Promise<void>;
  updateMatch(match: Match): Promise<void>;
  deleteMatch(matchId: string): Promise<void>;
}
