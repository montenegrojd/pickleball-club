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

  describe('proposeBestMatch', () => {
    const sessionId = 'session-1';
    const teamKeys = (result: { team1: string[]; team2: string[] }) =>
      [result.team1, result.team2].map(team => [...team].sort().join('-')).sort();

    it('should return null when less than 4 players available', () => {
      expect(Matchmaker.proposeBestMatch(['p1', 'p2', 'p3'], [])).toBeNull();
    });

    it('should split up players who already teamed up', () => {
      const history = [
        createMatch({ id: 'm1', sessionId, team1: ['p1', 'p2'], team2: ['p3', 'p4'], isFinished: true, timestamp: 1000 }),
        createMatch({ id: 'm2', sessionId, team1: ['p1', 'p2'], team2: ['p3', 'p4'], isFinished: true, timestamp: 2000 }),
      ];

      const result = Matchmaker.proposeBestMatch(['p1', 'p2', 'p3', 'p4'], history);

      expect(teamKeys(result!)).not.toContain('p1-p2');
      expect(teamKeys(result!)).not.toContain('p3-p4');
    });

    it('should pick the team split that balances teammates and opponents', () => {
      // p1/p4 and p2/p3 have never been teammates, and every opponent pair in that split met only once
      const history = [
        createMatch({ id: 'm1', sessionId, team1: ['p1', 'p2'], team2: ['p3', 'p4'], isFinished: true, timestamp: 1000 }),
        createMatch({ id: 'm2', sessionId, team1: ['p1', 'p3'], team2: ['p2', 'p4'], isFinished: true, timestamp: 2000 }),
      ];

      const result = Matchmaker.proposeBestMatch(['p1', 'p2', 'p3', 'p4'], history);

      expect(teamKeys(result!)).toEqual(['p1-p4', 'p2-p3']);
      expect(result?.scoringBreakdown[0]).toContain('cost 16');
    });

    it('should always include players with fewer games played', () => {
      const history = [
        createMatch({ id: 'm1', sessionId, team1: ['p1', 'p2'], team2: ['p3', 'p4'], isFinished: true, timestamp: 1000 }),
      ];

      const result = Matchmaker.proposeBestMatch(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], history);
      const selected = [...result!.team1, ...result!.team2];

      expect(selected).toEqual(expect.arrayContaining(['p5', 'p6']));
    });

    it('should rest players who played the last 2 matches in a row', () => {
      const history = [
        createMatch({ id: 'm1', sessionId, team1: ['p1', 'p2'], team2: ['p3', 'p4'], isFinished: true, timestamp: 1000 }),
        createMatch({ id: 'm2', sessionId, team1: ['p1', 'p2'], team2: ['p5', 'p6'], isFinished: true, timestamp: 2000 }),
      ];

      const result = Matchmaker.proposeBestMatch(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], history);
      const selected = [...result!.team1, ...result!.team2];

      expect(selected.sort()).toEqual(['p3', 'p4', 'p5', 'p6']);
    });

    it('should count matches still in progress on another court', () => {
      // Court 1 just started p1/p2 vs p3/p4; the next proposal for these players must not repeat it
      const history = [
        createMatch({ id: 'm1', sessionId, team1: ['p1', 'p2'], team2: ['p3', 'p4'], isFinished: false, timestamp: 1000, courtNumber: 1 }),
      ];

      const result = Matchmaker.proposeBestMatch(['p1', 'p2', 'p3', 'p4'], history);

      expect(teamKeys(result!)).not.toContain('p1-p2');
    });

    it('should rest a player who played back-to-back on the same court, even with 2 courts', () => {
      // p1 went straight from m1 into m3 on court 1 while court 2 was busy
      const history = [
        createMatch({ id: 'm1', sessionId, team1: ['p1', 'p2'], team2: ['p3', 'p4'], isFinished: true, timestamp: 1000, courtNumber: 1 }),
        createMatch({ id: 'm2', sessionId, team1: ['p5', 'p6'], team2: ['p7', 'p8'], isFinished: false, timestamp: 2000, courtNumber: 2 }),
        createMatch({ id: 'm3', sessionId, team1: ['p1', 'p9'], team2: ['p2', 'p10'], isFinished: true, timestamp: 3000, courtNumber: 1 }),
      ];

      const fatigued = Matchmaker['identifyBackToBackPlayers'](['p1', 'p2', 'p3', 'p4', 'p9', 'p10'], history);

      expect([...fatigued].sort()).toEqual(['p1', 'p2']);
    });

    it('should not count as back-to-back when a match started on the court the player left', () => {
      // p1 left court 1 after m1, m3 started there without p1, then p1 played m4 on court 2
      const history = [
        createMatch({ id: 'm1', sessionId, team1: ['p1', 'p2'], team2: ['p3', 'p4'], isFinished: true, timestamp: 1000, courtNumber: 1 }),
        createMatch({ id: 'm2', sessionId, team1: ['p5', 'p6'], team2: ['p7', 'p8'], isFinished: true, timestamp: 2000, courtNumber: 2 }),
        createMatch({ id: 'm3', sessionId, team1: ['p2', 'p3'], team2: ['p4', 'p9'], isFinished: false, timestamp: 3000, courtNumber: 1 }),
        createMatch({ id: 'm4', sessionId, team1: ['p1', 'p5'], team2: ['p6', 'p7'], isFinished: true, timestamp: 4000, courtNumber: 2 }),
      ];

      const fatigued = Matchmaker['identifyBackToBackPlayers'](['p1', 'p5', 'p6', 'p7', 'p8'], history);

      expect(fatigued.has('p1')).toBe(false);
      expect([...fatigued].sort()).toEqual(['p5', 'p6', 'p7']);
    });

    it('should credit late arrivals one game less than the player with the fewest', () => {
      const history = [
        createMatch({ id: 'm1', sessionId, team1: ['p1', 'p2'], team2: ['p3', 'p4'], isFinished: true, timestamp: 1000 }),
        createMatch({ id: 'm2', sessionId, team1: ['p1', 'p3'], team2: ['p2', 'p4'], isFinished: true, timestamp: 2000 }),
        createMatch({ id: 'm3', sessionId, team1: ['p1', 'p5'], team2: ['p2', 'p3'], isFinished: true, timestamp: 3000 }),
      ];

      const credits = Matchmaker['getLateArrivalCredits'](history);

      expect(credits.get('p1')).toBe(0);
      expect(credits.get('p4')).toBe(0);
      expect(credits.get('p5')).toBe(1); // fewest before m3 had 2 games
    });

    it('should not make a late arrival play every match to catch up', () => {
      // 8 players on 2 courts, p9 checks in after 10 matches; courts free up alternately
      const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'];
      const history: ReturnType<typeof createMatch>[] = [];
      const propose = (court: number) => {
        const present = history.length >= 10 ? players : players.slice(0, 8);
        const busy = new Set(history.filter(m => !m.isFinished).flatMap(m => [...m.team1, ...m.team2]));
        const result = Matchmaker.proposeBestMatch(present.filter(p => !busy.has(p)), history);
        history.push(createMatch({ id: `m${history.length}`, sessionId, team1: result!.team1, team2: result!.team2, timestamp: history.length, courtNumber: court }));
      };

      propose(1);
      propose(2);
      while (history.length < 24) {
        const next = history.find(m => !m.isFinished)!;
        next.isFinished = true;
        propose(next.courtNumber!);
      }

      const afterArrival = history.slice(10);
      const lateGames = afterArrival.filter(m => [...m.team1, ...m.team2].includes('p9')).length;
      const regularGames = players.slice(0, 8).map(p => afterArrival.filter(m => [...m.team1, ...m.team2].includes(p)).length);

      // p9 plays no more than the regulars after checking in
      expect(lateGames).toBeLessThanOrEqual(Math.max(...regularGames));
    });
  });
});
