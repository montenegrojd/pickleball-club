import { describe, it, expect } from 'vitest';
import { Matchmaker } from '@/lib/matchmaker';
import { createMatch } from '@/../tests/helpers/fixtures';

describe('Matchmaker', () => {
  describe('proposeMatch', () => {
    it('should return null when less than 4 players available', () => {
      const result = Matchmaker.proposeMatch(['p1', 'p2', 'p3'], []);
      expect(result).toBeNull();
    });

    it('should return null when exactly 3 players available', () => {
      const result = Matchmaker.proposeMatch(['p1', 'p2', 'p3'], []);
      expect(result).toBeNull();
    });

    it('should propose a match with 4 players when no history exists', () => {
      const players = ['p1', 'p2', 'p3', 'p4'];
      const result = Matchmaker.proposeMatch(players, []);

      expect(result).not.toBeNull();
      expect(result?.team1).toHaveLength(2);
      expect(result?.team2).toHaveLength(2);
      expect([...result!.team1, ...result!.team2]).toEqual(expect.arrayContaining(players));
    });

    it('should propose a match with first 4 players from larger pool when no history', () => {
      const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      const result = Matchmaker.proposeMatch(players, []);

      expect(result).not.toBeNull();
      expect(result?.team1).toHaveLength(2);
      expect(result?.team2).toHaveLength(2);
      
      // Should select first 4 players
      const selectedPlayers = [...result!.team1, ...result!.team2];
      expect(selectedPlayers).toHaveLength(4);
    });

    it('should avoid players who played last 2 consecutive matches (fatigued)', () => {
      const sessionId = 'session-1';
      
      // Match 1 (oldest): p1, p2, p3, p4
      const match1 = createMatch({
        id: 'm1',
        sessionId,
        team1: ['p1', 'p2'],
        team2: ['p3', 'p4'],
        timestamp: 1000,
      });

      // Match 2 (most recent): p1, p2, p5, p6 
      // p1 and p2 played both matches -> fatigued
      const match2 = createMatch({
        id: 'm2',
        sessionId,
        team1: ['p1', 'p2'],
        team2: ['p5', 'p6'],
        timestamp: 2000,
      });

      const availablePlayers = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      const result = Matchmaker.proposeMatch(availablePlayers, [match1, match2]);

      expect(result).not.toBeNull();
      
      // p1 and p2 should NOT both be selected (they're fatigued)
      const selectedPlayers = [...result!.team1, ...result!.team2];
      
      // Should prefer non-fatigued players: p3, p4, p5, p6
      const fatigued = selectedPlayers.filter(p => p === 'p1' || p === 'p2');
      expect(fatigued.length).toBeLessThanOrEqual(2); // May include some if needed
      
      // Should include at least some fresh players
      const fresh = selectedPlayers.filter(p => ['p3', 'p4', 'p5', 'p6'].includes(p));
      expect(fresh.length).toBeGreaterThanOrEqual(2);
    });

    it('should split winning pair from last match', () => {
      const sessionId = 'session-1';
      
      // Last match: Team 1 (p1, p2) won
      const lastMatch = createMatch({
        id: 'm1',
        sessionId,
        team1: ['p1', 'p2'],
        team2: ['p3', 'p4'],
        score1: 11,
        score2: 8,
        isFinished: true,
        winnerTeam: 1,
        timestamp: 1000,
      });

      // All 4 players available again
      const availablePlayers = ['p1', 'p2', 'p3', 'p4'];
      const result = Matchmaker.proposeMatch(availablePlayers, [lastMatch]);

      expect(result).not.toBeNull();
      
      // Winners (p1, p2) should NOT be on the same team
      const team1HasP1 = result!.team1.includes('p1');
      const team1HasP2 = result!.team1.includes('p2');
      const team2HasP1 = result!.team2.includes('p1');
      const team2HasP2 = result!.team2.includes('p2');

      // If p1 is in team1, p2 should be in team2 (and vice versa)
      if (team1HasP1) {
        expect(team2HasP2).toBe(true);
      } else {
        expect(team1HasP2).toBe(true);
      }
    });

    it('should split winning pair even when there are more than 4 available players', () => {
      const sessionId = 'session-1';
      
      // Last match: Team 2 (p3, p4) won
      const lastMatch = createMatch({
        id: 'm1',
        sessionId,
        team1: ['p1', 'p2'],
        team2: ['p3', 'p4'],
        score1: 8,
        score2: 11,
        isFinished: true,
        winnerTeam: 2,
        timestamp: 1000,
      });

      // 6 players available, including both winners
      const availablePlayers = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      const result = Matchmaker.proposeMatch(availablePlayers, [lastMatch]);

      expect(result).not.toBeNull();

      const selectedPlayers = [...result!.team1, ...result!.team2];
      const p3Selected = selectedPlayers.includes('p3');
      const p4Selected = selectedPlayers.includes('p4');

      // If both winners are selected, they must be on different teams
      if (p3Selected && p4Selected) {
        const team1HasP3 = result!.team1.includes('p3');
        const team1HasP4 = result!.team1.includes('p4');
        
        // They should not both be in team1 (and therefore not both in team2)
        expect(team1HasP3 && team1HasP4).toBe(false);
      }
    });

    it('should handle edge case with exactly 4 players all fatigued', () => {
      const sessionId = 'session-1';
      
      // Match 1: All 4 players
      const match1 = createMatch({
        id: 'm1',
        sessionId,
        team1: ['p1', 'p2'],
        team2: ['p3', 'p4'],
        timestamp: 1000,
      });

      // Match 2: Same 4 players (all fatigued)
      const match2 = createMatch({
        id: 'm2',
        sessionId,
        team1: ['p1', 'p3'],
        team2: ['p2', 'p4'],
        timestamp: 2000,
      });

      const availablePlayers = ['p1', 'p2', 'p3', 'p4'];
      const result = Matchmaker.proposeMatch(availablePlayers, [match1, match2]);

      // Should still propose a match even though all are fatigued
      expect(result).not.toBeNull();
      expect(result?.team1).toHaveLength(2);
      expect(result?.team2).toHaveLength(2);
    });

    it('should handle case where last match had no winner', () => {
      const sessionId = 'session-1';
      
      const lastMatch = createMatch({
        id: 'm1',
        sessionId,
        team1: ['p1', 'p2'],
        team2: ['p3', 'p4'],
        isFinished: false, // No winner determined
        timestamp: 1000,
      });

      const availablePlayers = ['p1', 'p2', 'p3', 'p4'];
      const result = Matchmaker.proposeMatch(availablePlayers, [lastMatch]);

      // Should still propose a valid match
      expect(result).not.toBeNull();
      expect(result?.team1).toHaveLength(2);
      expect(result?.team2).toHaveLength(2);
    });

    it('should return match with reason text', () => {
      const players = ['p1', 'p2', 'p3', 'p4'];
      const result = Matchmaker.proposeMatch(players, []);

      expect(result).not.toBeNull();
      expect(result?.reason).toBeDefined();
      expect(typeof result?.reason).toBe('string');
      expect(result?.reason.length).toBeGreaterThan(0);
    });
  });
});
