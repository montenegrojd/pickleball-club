import { describe, expect, it } from 'vitest';
import { buildSessionMatchHistoryExport, SESSION_MATCH_HISTORY_HEADERS } from '@/lib/session-match-history-export';
import { createMatch, createPlayer } from '@/../tests/helpers/fixtures';

describe('buildSessionMatchHistoryExport', () => {
  it('exports only finished matches with both epoch and ISO timestamps', () => {
    const sessionId = 'session-1';
    const sessionStartDate = '2026-02-20T00:00:00.000Z';
    const players = [
      createPlayer({ id: 'p1', name: 'Alice' }),
      createPlayer({ id: 'p2', name: 'Bob' }),
      createPlayer({ id: 'p3', name: 'Cara' }),
      createPlayer({ id: 'p4', name: 'Dan' })
    ];

    const finished = createMatch({
      id: 'm-finished',
      sessionId,
      team1: ['p1', 'p2'],
      team2: ['p3', 'p4'],
      score1: 11,
      score2: 8,
      winnerTeam: 1,
      isFinished: true,
      timestamp: 1700000000000,
      courtNumber: 2
    });

    const unfinished = createMatch({
      id: 'm-unfinished',
      sessionId,
      team1: ['p1', 'p3'],
      team2: ['p2', 'p4'],
      isFinished: false,
      timestamp: 1700000001000
    });

    const { csv, filename } = buildSessionMatchHistoryExport(
      sessionId,
      sessionStartDate,
      [unfinished, finished],
      players
    );

    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(SESSION_MATCH_HISTORY_HEADERS.join(','));

    const expectedIso = new Date(1700000000000).toISOString();
    expect(lines[1]).toContain('1700000000000');
    expect(lines[1]).toContain(expectedIso);
    expect(lines[1]).toContain('Alice & Bob');
    expect(lines[1]).toContain('p1|p2');
    expect(lines[1]).toContain('Cara & Dan');
    expect(lines[1]).toContain('p3|p4');
    expect(lines[1]).toContain(',11,8,1,');

    expect(filename).toBe('session-2026-02-20-session-1-match-history.csv');
  });

  it('uses Unknown fallback names for missing player records', () => {
    const sessionId = 'session-2';
    const players = [createPlayer({ id: 'p1', name: 'Known Player' })];

    const finished = createMatch({
      id: 'm1',
      sessionId,
      team1: ['p1', 'missing-id'],
      team2: ['missing-2', 'missing-3'],
      isFinished: true,
      winnerTeam: 2,
      timestamp: 1700000002000
    });

    const { csv } = buildSessionMatchHistoryExport(
      sessionId,
      'invalid-date-value',
      [finished],
      players
    );

    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain('Known Player & Unknown');
    expect(dataLine).toContain('Unknown & Unknown');
  });
});