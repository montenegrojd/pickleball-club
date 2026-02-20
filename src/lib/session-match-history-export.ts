import { Match, Player } from '@/lib/types';

function escapeCsv(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

function toCsv(rows: Array<Record<string, string | number | null | undefined>>, headers: string[]): string {
    const headerRow = headers.join(',');
    const dataRows = rows.map(row => headers.map(header => escapeCsv(row[header])).join(','));
    return [headerRow, ...dataRows].join('\n');
}

function getSessionDateForFilename(startDate: string): string {
    const parsed = new Date(startDate);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }
    return startDate.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 20);
}

function getTeamNames(playerMap: Map<string, string>, ids: string[]): string {
    return ids.map(id => playerMap.get(id) || 'Unknown').join(' & ');
}

export const SESSION_MATCH_HISTORY_HEADERS = [
    'sessionId',
    'matchId',
    'courtNumber',
    'timestampEpoch',
    'timestampIso',
    'team1Names',
    'team1Ids',
    'team2Names',
    'team2Ids',
    'score1',
    'score2',
    'winnerTeam',
    'winnerNames'
];

export function buildSessionMatchHistoryExport(
    sessionId: string,
    sessionStartDate: string,
    matches: Match[],
    players: Player[]
): { csv: string; filename: string } {
    const playerMap = new Map(players.map(player => [player.id, player.name]));

    const finishedMatches = matches
        .filter(match => match.isFinished)
        .sort((a, b) => a.timestamp - b.timestamp);

    const rows = finishedMatches.map(match => {
        const team1Names = getTeamNames(playerMap, match.team1);
        const team2Names = getTeamNames(playerMap, match.team2);
        const winnerNames =
            match.winnerTeam === 1
                ? team1Names
                : match.winnerTeam === 2
                    ? team2Names
                    : '';

        return {
            sessionId,
            matchId: match.id,
            courtNumber: match.courtNumber ?? '',
            timestampEpoch: match.timestamp,
            timestampIso: new Date(match.timestamp).toISOString(),
            team1Names,
            team1Ids: match.team1.join('|'),
            team2Names,
            team2Ids: match.team2.join('|'),
            score1: match.score1 ?? '',
            score2: match.score2 ?? '',
            winnerTeam: match.winnerTeam ?? '',
            winnerNames
        };
    });

    const csv = toCsv(rows, SESSION_MATCH_HISTORY_HEADERS);
    const sessionDate = getSessionDateForFilename(sessionStartDate);
    const filename = `session-${sessionDate}-${sessionId}-match-history.csv`;

    return { csv, filename };
}