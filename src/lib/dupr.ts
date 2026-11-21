import { Match, Player } from '@/lib/types';

/**
 * DUPR-alternative rating simulation (NOT an official DUPR rating).
 *
 * Modified Elo over doubles matches, processed in chronological order:
 *  - Everyone starts at START_RATING (3.000).
 *  - Each team's strength is the average rating of its two players.
 *  - Expected share of points for team A: E = 1 / (1 + 10^((rB - rA) / SCALE)).
 *  - Actual result is the proportion of points won: S = scoreA / (scoreA + scoreB),
 *    so a 11-9 win moves ratings far less than an 11-2 win.
 *  - Each player moves by K * (S - E) (team B by the opposite sign), where
 *      K = CLUB_WEIGHT * DOUBLES_ADJ * provisionalBoost * experienceDamping
 *    provisionalBoost = 1 + PROVISIONAL_BOOST * max(0, (PROVISIONAL_MATCHES - n) / PROVISIONAL_MATCHES)
 *    experienceDamping = 1 / (1 + EXPERIENCE_DAMPING * n)
 *    with n = matches the player had played before this one.
 *
 * Constants were calibrated against the reference ranking image produced with
 * the same match history (sum of squared error ≈ 0.014 across 20 players).
 */
export const DUPR_CONFIG = {
    START_RATING: 3.0,
    SCALE: 1.0,
    CLUB_WEIGHT: 0.2,
    DOUBLES_ADJ: 1.0,
    PROVISIONAL_MATCHES: 20,
    PROVISIONAL_BOOST: 1.0,
    EXPERIENCE_DAMPING: 0.005,
    ACTIVE_MONTHS: 6,
} as const;

export type DuprConfig = typeof DUPR_CONFIG;

export interface DuprRow {
    playerId: string;
    name: string;
    rating: number;
    matches: number;
    wins: number;
    losses: number;
    lastMatch: number; // epoch ms
    provisional: boolean;
}

export interface DuprResult {
    rows: DuprRow[];          // active players, sorted by rating desc
    inactive: DuprRow[];      // players with no match inside the active window
    matchesAnalyzed: number;
    asOf: number;
    config: DuprConfig;
}

function isScored(m: Match): m is Match & { score1: number; score2: number } {
    return (
        m.isFinished &&
        typeof m.score1 === 'number' &&
        typeof m.score2 === 'number' &&
        m.score1 + m.score2 > 0 &&
        m.team1.length > 0 &&
        m.team2.length > 0
    );
}

export function computeDuprRatings(
    players: Player[],
    matches: Match[],
    now: number = Date.now(),
    config: DuprConfig = DUPR_CONFIG,
): DuprResult {
    const names = new Map(players.map(p => [p.id, p.name]));
    const rating = new Map<string, number>();
    const stats = new Map<string, { n: number; w: number; l: number; last: number }>();

    const get = (id: string) => rating.get(id) ?? config.START_RATING;
    const st = (id: string) => {
        let s = stats.get(id);
        if (!s) {
            s = { n: 0, w: 0, l: 0, last: 0 };
            stats.set(id, s);
        }
        return s;
    };
    const kFor = (id: string) => {
        const n = stats.get(id)?.n ?? 0;
        const provisional =
            1 + config.PROVISIONAL_BOOST * Math.max(0, (config.PROVISIONAL_MATCHES - n) / config.PROVISIONAL_MATCHES);
        return config.CLUB_WEIGHT * config.DOUBLES_ADJ * provisional / (1 + config.EXPERIENCE_DAMPING * n);
    };
    const avg = (ids: string[]) => ids.reduce((acc, id) => acc + get(id), 0) / ids.length;

    const scored = matches.filter(isScored).sort((a, b) => a.timestamp - b.timestamp);

    for (const m of scored) {
        const rA = avg(m.team1);
        const rB = avg(m.team2);
        const expected = 1 / (1 + Math.pow(10, (rB - rA) / config.SCALE));
        const actual = m.score1 / (m.score1 + m.score2);
        const diff = actual - expected;

        const updates: [string, number][] = [
            ...m.team1.map(id => [id, get(id) + kFor(id) * diff] as [string, number]),
            ...m.team2.map(id => [id, get(id) - kFor(id) * diff] as [string, number]),
        ];
        for (const [id, r] of updates) rating.set(id, r);

        const team1Won = m.winnerTeam ? m.winnerTeam === 1 : m.score1 > m.score2;
        for (const id of m.team1) {
            const s = st(id);
            s.n++; s.last = Math.max(s.last, m.timestamp);
            if (team1Won) s.w++; else s.l++;
        }
        for (const id of m.team2) {
            const s = st(id);
            s.n++; s.last = Math.max(s.last, m.timestamp);
            if (team1Won) s.l++; else s.w++;
        }
    }

    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - config.ACTIVE_MONTHS);

    const all: DuprRow[] = [...stats.entries()].map(([id, s]) => ({
        playerId: id,
        name: names.get(id) ?? id,
        rating: get(id),
        matches: s.n,
        wins: s.w,
        losses: s.l,
        lastMatch: s.last,
        provisional: s.n < config.PROVISIONAL_MATCHES,
    }));
    all.sort((a, b) => b.rating - a.rating);

    return {
        rows: all.filter(r => r.lastMatch >= cutoff.getTime()),
        inactive: all.filter(r => r.lastMatch < cutoff.getTime()),
        matchesAnalyzed: scored.length,
        asOf: now,
        config,
    };
}

export interface SessionDuprMove {
    playerId: string;
    name: string;
    before: number;            // rating right before the session's first match
    after: number;             // rating after the session's last finished match
    delta: number;
    rankBefore: number | null; // position in the active ranking at session start (null = not ranked yet)
    rankAfter: number | null;
    matches: number;           // matches played in this session
    wins: number;
    losses: number;
}

export interface SessionDuprResult {
    sessionId: string;
    matchesAnalyzed: number;
    moves: SessionDuprMove[];  // sorted by delta desc
}

/**
 * DUPR-alt movement for every player who played in a session: ratings/ranks just
 * before the session's first finished match vs. after its last finished match.
 */
export function computeSessionDuprMovement(
    players: Player[],
    matches: Match[],
    sessionId: string,
    config: DuprConfig = DUPR_CONFIG,
): SessionDuprResult {
    const sessionMatches = matches.filter(isScored).filter(m => m.sessionId === sessionId);
    if (sessionMatches.length === 0) return { sessionId, matchesAnalyzed: 0, moves: [] };

    const start = Math.min(...sessionMatches.map(m => m.timestamp));
    const end = Math.max(...sessionMatches.map(m => m.timestamp));

    const beforeRes = computeDuprRatings(players, matches.filter(m => m.timestamp < start), start, config);
    const afterRes = computeDuprRatings(players, matches.filter(m => m.timestamp <= end), end, config);

    const index = (res: DuprResult) => {
        const map = new Map<string, { rating: number; rank: number | null }>();
        res.rows.forEach((r, i) => map.set(r.playerId, { rating: r.rating, rank: i + 1 }));
        res.inactive.forEach(r => map.set(r.playerId, { rating: r.rating, rank: null }));
        return map;
    };
    const before = index(beforeRes);
    const after = index(afterRes);
    const names = new Map(players.map(p => [p.id, p.name]));

    const tally = new Map<string, { n: number; w: number; l: number }>();
    for (const m of sessionMatches) {
        const team1Won = m.winnerTeam ? m.winnerTeam === 1 : m.score1 > m.score2;
        for (const [ids, won] of [[m.team1, team1Won], [m.team2, !team1Won]] as const) {
            for (const id of ids) {
                const t = tally.get(id) ?? { n: 0, w: 0, l: 0 };
                t.n++;
                if (won) t.w++; else t.l++;
                tally.set(id, t);
            }
        }
    }

    const moves: SessionDuprMove[] = [...tally.entries()].map(([id, t]) => {
        const b = before.get(id);
        const a = after.get(id);
        const ratingBefore = b?.rating ?? config.START_RATING;
        const ratingAfter = a?.rating ?? ratingBefore;
        return {
            playerId: id,
            name: names.get(id) ?? id,
            before: ratingBefore,
            after: ratingAfter,
            delta: ratingAfter - ratingBefore,
            rankBefore: b?.rank ?? null,
            rankAfter: a?.rank ?? null,
            matches: t.n,
            wins: t.w,
            losses: t.l,
        };
    });
    moves.sort((x, y) => y.delta - x.delta);

    return { sessionId, matchesAnalyzed: sessionMatches.length, moves };
}
