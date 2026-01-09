import { Player, Match, RosterSession } from '@/lib/types';

/**
 * Test fixture factory functions
 */

export function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: `player-${Math.random()}`,
    name: 'Test Player',
    matchesPlayed: 0,
    matchesWon: 0,
    pointsScored: 0,
    pointsAllowed: 0,
    ...overrides,
  };
}

export function createSession(overrides: Partial<RosterSession> = {}): RosterSession {
  return {
    id: `session-${Math.random()}`,
    startDate: new Date().toISOString(),
    playerIds: [],
    isActive: true,
    isClosed: false,
    ...overrides,
  };
}

export function createMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: `match-${Math.random()}`,
    sessionId: `session-${Math.random()}`,
    team1: ['player1', 'player2'],
    team2: ['player3', 'player4'],
    score1: undefined,
    score2: undefined,
    isFinished: false,
    timestamp: Date.now(),
    ...overrides,
  };
}
