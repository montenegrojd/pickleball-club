import { describe, it, expect, beforeEach } from 'vitest';
import { MockStorageAdapter } from '@/../tests/helpers/mock-storage';
import { createPlayer, createSession, createMatch } from '@/../tests/helpers/fixtures';
import { Player, Match } from '@/lib/types';

/**
 * Tests for stats update logic in PATCH /api/matches endpoint
 * This simulates the business logic without testing the actual HTTP endpoint
 */
describe('Match Stats Update Logic', () => {
  let storage: MockStorageAdapter;
  let session: any;
  let players: Player[];

  beforeEach(() => {
    storage = new MockStorageAdapter();
    
    // Create a session
    session = createSession({ id: 'session-1' });
    
    // Create 4 test players
    players = [
      createPlayer({ id: 'p1', name: 'Player 1' }),
      createPlayer({ id: 'p2', name: 'Player 2' }),
      createPlayer({ id: 'p3', name: 'Player 3' }),
      createPlayer({ id: 'p4', name: 'Player 4' }),
    ];

    storage.seed(players, [session], []);
  });

  const updateMatchStats = async (
    match: Match,
    oldMatch: Match | undefined,
    storage: MockStorageAdapter
  ) => {
    if (!match.isFinished) return;

    const players = await storage.getPlayers();

    const updateStats = async (
      ids: string[],
      isWin: boolean,
      pointsFor: number,
      pointsAgainst: number,
      multiplier: 1 | -1
    ) => {
      for (const id of ids) {
        const p = players.find(x => x.id === id);
        if (p) {
          p.matchesPlayed += 1 * multiplier;
          if (isWin) p.matchesWon += 1 * multiplier;
          p.pointsScored = (p.pointsScored || 0) + pointsFor * multiplier;
          p.pointsAllowed = (p.pointsAllowed || 0) + pointsAgainst * multiplier;
          await storage.updatePlayer(p);
        }
      }
    };

    // 1. Revert Old Stats if it was previously finished
    if (oldMatch && oldMatch.isFinished && oldMatch.winnerTeam) {
      if (oldMatch.winnerTeam === 1) {
        await updateStats(
          oldMatch.team1,
          true,
          oldMatch.score1 || 0,
          oldMatch.score2 || 0,
          -1
        );
        await updateStats(
          oldMatch.team2,
          false,
          oldMatch.score2 || 0,
          oldMatch.score1 || 0,
          -1
        );
      } else {
        await updateStats(
          oldMatch.team1,
          false,
          oldMatch.score1 || 0,
          oldMatch.score2 || 0,
          -1
        );
        await updateStats(
          oldMatch.team2,
          true,
          oldMatch.score2 || 0,
          oldMatch.score1 || 0,
          -1
        );
      }
    }

    // 2. Apply New Stats
    const s1 = match.score1 || 0;
    const s2 = match.score2 || 0;
    const winnerTeam = s1 > s2 ? 1 : 2;
    match.winnerTeam = winnerTeam;

    if (winnerTeam === 1) {
      await updateStats(match.team1, true, s1, s2, 1);
      await updateStats(match.team2, false, s2, s1, 1);
    } else {
      await updateStats(match.team1, false, s1, s2, 1);
      await updateStats(match.team2, true, s2, s1, 1);
    }
  };

  it('should update stats when match is finished for the first time', async () => {
    const match = createMatch({
      id: 'm1',
      sessionId: session.id,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 11,
      score2: 8,
      isFinished: true,
    });

    await updateMatchStats(match, undefined, storage);

    const updatedPlayers = await storage.getPlayers();
    const p1 = updatedPlayers.find(p => p.id === 'p1')!;
    const p2 = updatedPlayers.find(p => p.id === 'p2')!;
    const p3 = updatedPlayers.find(p => p.id === 'p3')!;
    const p4 = updatedPlayers.find(p => p.id === 'p4')!;

    // Team 1 won (p1, p2)
    expect(p1.matchesPlayed).toBe(1);
    expect(p1.matchesWon).toBe(1);
    expect(p1.pointsScored).toBe(11);
    expect(p1.pointsAllowed).toBe(8);

    expect(p2.matchesPlayed).toBe(1);
    expect(p2.matchesWon).toBe(1);
    expect(p2.pointsScored).toBe(11);
    expect(p2.pointsAllowed).toBe(8);

    // Team 2 lost (p3, p4)
    expect(p3.matchesPlayed).toBe(1);
    expect(p3.matchesWon).toBe(0);
    expect(p3.pointsScored).toBe(8);
    expect(p3.pointsAllowed).toBe(11);

    expect(p4.matchesPlayed).toBe(1);
    expect(p4.matchesWon).toBe(0);
    expect(p4.pointsScored).toBe(8);
    expect(p4.pointsAllowed).toBe(11);
  });

  it('should reverse old stats and apply new stats when score is corrected', async () => {
    // Original match: Team 1 won 11-8
    const oldMatch = createMatch({
      id: 'm1',
      sessionId: session.id,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 11,
      score2: 8,
      isFinished: true,
      winnerTeam: 1,
    });

    // Apply original stats
    await updateMatchStats(oldMatch, undefined, storage);

    // Corrected match: Team 2 actually won 11-9
    const correctedMatch = createMatch({
      id: 'm1',
      sessionId: session.id,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 9,
      score2: 11,
      isFinished: true,
    });

    // Update with correction
    await updateMatchStats(correctedMatch, oldMatch, storage);

    const updatedPlayers = await storage.getPlayers();
    const p1 = updatedPlayers.find(p => p.id === 'p1')!;
    const p2 = updatedPlayers.find(p => p.id === 'p2')!;
    const p3 = updatedPlayers.find(p => p.id === 'p3')!;
    const p4 = updatedPlayers.find(p => p.id === 'p4')!;

    // Team 1 now lost (stats reversed and reapplied)
    expect(p1.matchesPlayed).toBe(1); // Still played 1 match
    expect(p1.matchesWon).toBe(0); // Changed from win to loss
    expect(p1.pointsScored).toBe(9); // Changed from 11 to 9
    expect(p1.pointsAllowed).toBe(11); // Changed from 8 to 11

    expect(p2.matchesPlayed).toBe(1);
    expect(p2.matchesWon).toBe(0);
    expect(p2.pointsScored).toBe(9);
    expect(p2.pointsAllowed).toBe(11);

    // Team 2 now won
    expect(p3.matchesPlayed).toBe(1);
    expect(p3.matchesWon).toBe(1); // Changed from loss to win
    expect(p3.pointsScored).toBe(11); // Changed from 8 to 11
    expect(p3.pointsAllowed).toBe(9); // Changed from 11 to 9

    expect(p4.matchesPlayed).toBe(1);
    expect(p4.matchesWon).toBe(1);
    expect(p4.pointsScored).toBe(11);
    expect(p4.pointsAllowed).toBe(9);
  });

  it('should handle tie scenario where score2 wins when scores are equal', async () => {
    // Edge case: Scores are tied (though unlikely in pickleball)
    const match = createMatch({
      id: 'm1',
      sessionId: session.id,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 10,
      score2: 10,
      isFinished: true,
    });

    await updateMatchStats(match, undefined, storage);

    const updatedPlayers = await storage.getPlayers();
    const p1 = updatedPlayers.find(p => p.id === 'p1')!;
    const p3 = updatedPlayers.find(p => p.id === 'p3')!;

    // When tied, team2 wins (winnerTeam = 2 when s1 is not > s2)
    expect(p1.matchesWon).toBe(0); // Team 1 lost
    expect(p3.matchesWon).toBe(1); // Team 2 won
    expect(match.winnerTeam).toBe(2);
  });

  it('should correctly handle multiple score updates on same match', async () => {
    // First update: Team 1 wins 11-7
    const version1 = createMatch({
      id: 'm1',
      sessionId: session.id,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 11,
      score2: 7,
      isFinished: true,
      winnerTeam: 1,
    });

    await updateMatchStats(version1, undefined, storage);

    // Second update: Corrected to 11-8, still Team 1 wins
    const version2 = createMatch({
      id: 'm1',
      sessionId: session.id,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 11,
      score2: 8,
      isFinished: true,
      winnerTeam: 1,
    });

    await updateMatchStats(version2, version1, storage);

    // Third update: Corrected again to Team 2 wins 12-10
    const version3 = createMatch({
      id: 'm1',
      sessionId: session.id,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 10,
      score2: 12,
      isFinished: true,
    });

    await updateMatchStats(version3, version2, storage);

    const updatedPlayers = await storage.getPlayers();
    const p1 = updatedPlayers.find(p => p.id === 'p1')!;
    const p3 = updatedPlayers.find(p => p.id === 'p3')!;

    // Final state: Team 2 won 12-10
    expect(p1.matchesPlayed).toBe(1);
    expect(p1.matchesWon).toBe(0);
    expect(p1.pointsScored).toBe(10);
    expect(p1.pointsAllowed).toBe(12);

    expect(p3.matchesPlayed).toBe(1);
    expect(p3.matchesWon).toBe(1);
    expect(p3.pointsScored).toBe(12);
    expect(p3.pointsAllowed).toBe(10);
  });

  it('should not update stats when match is marked as not finished', async () => {
    const match = createMatch({
      id: 'm1',
      sessionId: session.id,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 5,
      score2: 3,
      isFinished: false, // Not finished yet
    });

    await updateMatchStats(match, undefined, storage);

    const updatedPlayers = await storage.getPlayers();
    
    // No stats should change
    updatedPlayers.forEach(p => {
      expect(p.matchesPlayed).toBe(0);
      expect(p.matchesWon).toBe(0);
      expect(p.pointsScored).toBe(0);
      expect(p.pointsAllowed).toBe(0);
    });
  });

  it('should set winnerTeam correctly based on scores', async () => {
    const match1 = createMatch({
      id: 'm1',
      sessionId: session.id,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 11,
      score2: 9,
      isFinished: true,
    });

    await updateMatchStats(match1, undefined, storage);
    expect(match1.winnerTeam).toBe(1);

    const match2 = createMatch({
      id: 'm2',
      sessionId: session.id,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 8,
      score2: 11,
      isFinished: true,
    });

    await updateMatchStats(match2, undefined, storage);
    expect(match2.winnerTeam).toBe(2);
  });
});
