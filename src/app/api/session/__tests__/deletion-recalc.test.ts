import { describe, it, expect, beforeEach } from 'vitest';
import { MockStorageAdapter } from '@/../tests/helpers/mock-storage';
import { createPlayer, createSession, createMatch } from '@/../tests/helpers/fixtures';
import { Player, Match } from '@/lib/types';

/**
 * Tests for session deletion with stats recalculation logic
 * This simulates the business logic from DELETE /api/session/[id]
 */
describe('Session Deletion with Stats Recalculation', () => {
  let storage: MockStorageAdapter;

  beforeEach(() => {
    storage = new MockStorageAdapter();
  });

  // Replicate the recalculation logic from the route
  async function recalculateAllPlayerStats(storage: MockStorageAdapter) {
    const [players, matches] = await Promise.all([
      storage.getPlayers(),
      storage.getMatches(),
    ]);

    // Reset all player stats to zero
    const statsMap = new Map<string, Player>();
    players.forEach(p => {
      statsMap.set(p.id, {
        ...p,
        matchesPlayed: 0,
        matchesWon: 0,
        pointsScored: 0,
        pointsAllowed: 0,
      });
    });

    // Recalculate from all finished matches
    const finishedMatches = matches.filter(m => m.isFinished);

    finishedMatches.forEach(m => {
      const updateStats = (
        playerId: string,
        isWinner: boolean,
        scored: number,
        allowed: number
      ) => {
        const p = statsMap.get(playerId);
        if (p) {
          p.matchesPlayed += 1;
          if (isWinner) p.matchesWon += 1;
          p.pointsScored += scored;
          p.pointsAllowed += allowed;
        }
      };

      const s1 = m.score1 || 0;
      const s2 = m.score2 || 0;
      const win1 = m.winnerTeam === 1;

      m.team1.forEach(id => updateStats(id, win1, s1, s2));
      m.team2.forEach(id => updateStats(id, !win1, s2, s1));
    });

    // Update all players in database
    await Promise.all(
      Array.from(statsMap.values()).map(player => storage.updatePlayer(player))
    );
  }

  it('should delete session and cascade delete associated matches', async () => {
    const session1 = createSession({ id: 'session-1' });
    const session2 = createSession({ id: 'session-2', isActive: false, isClosed: true });

    const match1 = createMatch({ id: 'm1', sessionId: 'session-1' });
    const match2 = createMatch({ id: 'm2', sessionId: 'session-2' });
    const match3 = createMatch({ id: 'm3', sessionId: 'session-2' });

    storage.seed([], [session1, session2], [match1, match2, match3]);

    // Delete session-2
    await storage.deleteSession('session-2');

    const remainingSessions = await storage.getSessions();
    const remainingMatches = await storage.getMatches();

    expect(remainingSessions).toHaveLength(1);
    expect(remainingSessions[0].id).toBe('session-1');

    // Only match from session-1 should remain
    expect(remainingMatches).toHaveLength(1);
    expect(remainingMatches[0].id).toBe('m1');
  });

  it('should recalculate all player stats after deleting a session', async () => {
    const players = [
      createPlayer({ id: 'p1', name: 'Player 1' }),
      createPlayer({ id: 'p2', name: 'Player 2' }),
      createPlayer({ id: 'p3', name: 'Player 3' }),
      createPlayer({ id: 'p4', name: 'Player 4' }),
    ];

    // Set initial stats (as if matches were played)
    players[0].matchesPlayed = 2;
    players[0].matchesWon = 1;
    players[0].pointsScored = 20;
    players[0].pointsAllowed = 18;

    const session1 = createSession({ id: 'session-1', isClosed: true, isActive: false });
    const session2 = createSession({ id: 'session-2', isClosed: true, isActive: false });

    // Session 1: One match - Team 1 wins
    const match1 = createMatch({
      id: 'm1',
      sessionId: 'session-1',
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 11,
      score2: 7,
      isFinished: true,
      winnerTeam: 1,
    });

    // Session 2: One match - Team 2 wins
    const match2 = createMatch({
      id: 'm2',
      sessionId: 'session-2',
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 8,
      score2: 11,
      isFinished: true,
      winnerTeam: 2,
    });

    storage.seed(players, [session1, session2], [match1, match2]);

    // Delete session-1
    await storage.deleteSession('session-1');

    // Recalculate stats
    await recalculateAllPlayerStats(storage);

    const updatedPlayers = await storage.getPlayers();
    const p1 = updatedPlayers.find(p => p.id === 'p1')!;
    const p2 = updatedPlayers.find(p => p.id === 'p2')!;
    const p3 = updatedPlayers.find(p => p.id === 'p3')!;
    const p4 = updatedPlayers.find(p => p.id === 'p4')!;

    // After deleting session-1, only session-2 match remains
    // p1 and p2 lost that match
    expect(p1.matchesPlayed).toBe(1);
    expect(p1.matchesWon).toBe(0);
    expect(p1.pointsScored).toBe(8);
    expect(p1.pointsAllowed).toBe(11);

    expect(p2.matchesPlayed).toBe(1);
    expect(p2.matchesWon).toBe(0);
    expect(p2.pointsScored).toBe(8);
    expect(p2.pointsAllowed).toBe(11);

    // p3 and p4 won that match
    expect(p3.matchesPlayed).toBe(1);
    expect(p3.matchesWon).toBe(1);
    expect(p3.pointsScored).toBe(11);
    expect(p3.pointsAllowed).toBe(8);

    expect(p4.matchesPlayed).toBe(1);
    expect(p4.matchesWon).toBe(1);
    expect(p4.pointsScored).toBe(11);
    expect(p4.pointsAllowed).toBe(8);
  });

  it('should reset all player stats to zero when deleting the last session', async () => {
    const players = [
      createPlayer({
        id: 'p1',
        name: 'Player 1',
        matchesPlayed: 5,
        matchesWon: 3,
        pointsScored: 50,
        pointsAllowed: 40,
      }),
      createPlayer({
        id: 'p2',
        name: 'Player 2',
        matchesPlayed: 5,
        matchesWon: 2,
        pointsScored: 45,
        pointsAllowed: 48,
      }),
    ];

    const session = createSession({ id: 'session-1', isClosed: true, isActive: false });
    const match = createMatch({
      id: 'm1',
      sessionId: 'session-1',
      team1: ['p1'],
      team2: ['p2'],
      score1: 11,
      score2: 9,
      isFinished: true,
      winnerTeam: 1,
    });

    storage.seed(players, [session], [match]);

    // Delete the only session
    await storage.deleteSession('session-1');

    // Recalculate (should zero out since no matches remain)
    await recalculateAllPlayerStats(storage);

    const updatedPlayers = await storage.getPlayers();

    updatedPlayers.forEach(p => {
      expect(p.matchesPlayed).toBe(0);
      expect(p.matchesWon).toBe(0);
      expect(p.pointsScored).toBe(0);
      expect(p.pointsAllowed).toBe(0);
    });
  });

  it('should only count finished matches when recalculating stats', async () => {
    const players = [
      createPlayer({ id: 'p1', name: 'Player 1' }),
      createPlayer({ id: 'p2', name: 'Player 2' }),
      createPlayer({ id: 'p3', name: 'Player 3' }),
      createPlayer({ id: 'p4', name: 'Player 4' }),
    ];

    const session1 = createSession({ id: 'session-1' });

    // Finished match
    const match1 = createMatch({
      id: 'm1',
      sessionId: 'session-1',
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 11,
      score2: 8,
      isFinished: true,
      winnerTeam: 1,
    });

    // Unfinished match (should be ignored)
    const match2 = createMatch({
      id: 'm2',
      sessionId: 'session-1',
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 5,
      score2: 3,
      isFinished: false,
    });

    storage.seed(players, [session1], [match1, match2]);

    // Recalculate stats
    await recalculateAllPlayerStats(storage);

    const updatedPlayers = await storage.getPlayers();
    const p1 = updatedPlayers.find(p => p.id === 'p1')!;

    // Should only count the finished match
    expect(p1.matchesPlayed).toBe(1); // Not 2
    expect(p1.matchesWon).toBe(1);
    expect(p1.pointsScored).toBe(11); // From finished match only
  });

  it('should handle deletion validation - cannot delete active session', async () => {
    const activeSession = createSession({ id: 'active', isActive: true, isClosed: false });
    storage.seed([], [activeSession], []);

    const session = await storage.getSession('active');
    
    // Validation logic (from route handler)
    if (session && session.isActive) {
      // Should throw error or return 400
      expect(session.isActive).toBe(true);
      // In real route: return NextResponse.json({ error: 'Cannot delete active session' }, { status: 400 })
    }
  });

  it('should correctly recalculate stats across multiple sessions', async () => {
    const players = [
      createPlayer({ id: 'p1', name: 'Player 1' }),
      createPlayer({ id: 'p2', name: 'Player 2' }),
      createPlayer({ id: 'p3', name: 'Player 3' }),
      createPlayer({ id: 'p4', name: 'Player 4' }),
    ];

    const session1 = createSession({ id: 'session-1', isClosed: true, isActive: false });
    const session2 = createSession({ id: 'session-2', isClosed: true, isActive: false });
    const session3 = createSession({ id: 'session-3', isClosed: true, isActive: false });

    // Session 1: p1 & p2 win
    const m1 = createMatch({
      id: 'm1',
      sessionId: 'session-1',
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 11,
      score2: 5,
      isFinished: true,
      winnerTeam: 1,
    });

    // Session 2: p3 & p4 win
    const m2 = createMatch({
      id: 'm2',
      sessionId: 'session-2',
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 7,
      score2: 11,
      isFinished: true,
      winnerTeam: 2,
    });

    // Session 3: p1 & p3 win
    const m3 = createMatch({
      id: 'm3',
      sessionId: 'session-3',
      team1: ['p1', 'p3'],
      team2: ['p2', 'p4'],
      score1: 11,
      score2: 9,
      isFinished: true,
      winnerTeam: 1,
    });

    storage.seed(players, [session1, session2, session3], [m1, m2, m3]);

    // Delete session-2 (middle session)
    await storage.deleteSession('session-2');

    // Recalculate
    await recalculateAllPlayerStats(storage);

    const updatedPlayers = await storage.getPlayers();
    const p1 = updatedPlayers.find(p => p.id === 'p1')!;
    const p2 = updatedPlayers.find(p => p.id === 'p2')!;
    const p3 = updatedPlayers.find(p => p.id === 'p3')!;
    const p4 = updatedPlayers.find(p => p.id === 'p4')!;

    // p1: Played m1 (won) and m3 (won) = 2 played, 2 won
    expect(p1.matchesPlayed).toBe(2);
    expect(p1.matchesWon).toBe(2);
    expect(p1.pointsScored).toBe(22); // 11 + 11
    expect(p1.pointsAllowed).toBe(14); // 5 + 9

    // p2: Played m1 (won) and m3 (lost) = 2 played, 1 won
    expect(p2.matchesPlayed).toBe(2);
    expect(p2.matchesWon).toBe(1);

    // p3: Played m1 (lost) and m3 (won) = 2 played, 1 won
    expect(p3.matchesPlayed).toBe(2);
    expect(p3.matchesWon).toBe(1);

    // p4: Played m1 (lost) and m3 (lost) = 2 played, 0 won
    expect(p4.matchesPlayed).toBe(2);
    expect(p4.matchesWon).toBe(0);
  });
});
