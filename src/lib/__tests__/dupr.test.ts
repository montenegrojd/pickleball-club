import { describe, it, expect } from 'vitest';
import { computeDuprRatings, computeSessionDuprMovement, DUPR_CONFIG } from '@/lib/dupr';
import { createPlayer, createMatch } from '../../../tests/helpers/fixtures';

const now = Date.UTC(2026, 10, 21);
const players = ['a', 'b', 'c', 'd'].map(id => createPlayer({ id, name: id.toUpperCase() }));
const match = (score1: number, score2: number, t = now - 1000) =>
    createMatch({ team1: ['a', 'b'], team2: ['c', 'd'], score1, score2, isFinished: true, timestamp: t, winnerTeam: score1 > score2 ? 1 : 2 });

describe('computeDuprRatings', () => {
    it('starts everyone at 3.000 and is zero-sum for equal teams', () => {
        const r = computeDuprRatings(players, [match(11, 5)], now);
        const by = Object.fromEntries(r.rows.map(x => [x.playerId, x]));
        expect(by.a.rating).toBeGreaterThan(DUPR_CONFIG.START_RATING);
        expect(by.c.rating).toBeLessThan(DUPR_CONFIG.START_RATING);
        expect(by.a.rating + by.c.rating).toBeCloseTo(6, 10);
        expect(by.a.wins).toBe(1);
        expect(by.c.losses).toBe(1);
    });

    it('moves ratings more for a blowout than a close game', () => {
        const close = computeDuprRatings(players, [match(11, 9)], now).rows.find(x => x.playerId === 'a')!;
        const blow = computeDuprRatings(players, [match(11, 1)], now).rows.find(x => x.playerId === 'a')!;
        expect(blow.rating).toBeGreaterThan(close.rating);
    });

    it('ignores unfinished matches and excludes players inactive for 6+ months', () => {
        const old = now - 200 * 24 * 3600 * 1000;
        const r = computeDuprRatings(players, [match(11, 3, old), createMatch({ team1: ['a', 'b'], team2: ['c', 'd'], isFinished: false })], now);
        expect(r.matchesAnalyzed).toBe(1);
        expect(r.rows).toHaveLength(0);
        expect(r.inactive).toHaveLength(4);
    });
});

describe('computeSessionDuprMovement', () => {
    it('reports before/after ratings only for players in the session', () => {
        const prior = { ...match(11, 4, now - 10_000), sessionId: 's0' };
        const s1a = { ...match(5, 11, now - 5_000), sessionId: 's1' };
        const s1b = { ...match(11, 9, now - 4_000), sessionId: 's1' };
        const res = computeSessionDuprMovement(players, [prior, s1a, s1b], 's1');
        expect(res.matchesAnalyzed).toBe(2);
        expect(res.moves).toHaveLength(4);
        const a = res.moves.find(m => m.playerId === 'a')!;
        const beforeOnly = computeDuprRatings(players, [prior], now - 5_000).rows.find(r => r.playerId === 'a')!;
        const afterAll = computeDuprRatings(players, [prior, s1a, s1b], now).rows.find(r => r.playerId === 'a')!;
        expect(a.before).toBeCloseTo(beforeOnly.rating, 10);
        expect(a.after).toBeCloseTo(afterAll.rating, 10);
        expect(a.delta).toBeCloseTo(a.after - a.before, 10);
        expect(a.wins).toBe(1);
        expect(a.losses).toBe(1);
    });

    it('returns no moves for a session without finished matches', () => {
        expect(computeSessionDuprMovement(players, [match(11, 3)], 'nope').moves).toEqual([]);
    });
});
