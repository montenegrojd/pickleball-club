'use client';

import { useState, useEffect } from 'react';
import { Match, Player } from '@/lib/types';
import { Users, Swords, ChevronDown, ChevronUp } from 'lucide-react';

interface Cell {
    count: number;
    wins: number; // wins credited to the ROW player (as teammate-pair win, or row-vs-column record)
}

type Matrix = Map<string, Map<string, Cell>>;

const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const bump = (matrix: Matrix, a: string, b: string, win: boolean) => {
    const row = matrix.get(a);
    if (!row) return;
    const prev = row.get(b) || { count: 0, wins: 0 };
    row.set(b, { count: prev.count + 1, wins: prev.wins + (win ? 1 : 0) });
};

// Sequential emerald ramp — light to dark as the count increases.
const heatClass = (count: number, max: number): string => {
    if (count === 0) return 'bg-gray-50 text-gray-300';
    const ratio = max > 0 ? count / max : 0;
    if (ratio > 0.8) return 'bg-emerald-600 text-white';
    if (ratio > 0.6) return 'bg-emerald-500 text-white';
    if (ratio > 0.4) return 'bg-emerald-400 text-white';
    if (ratio > 0.2) return 'bg-emerald-300 text-emerald-900';
    return 'bg-emerald-100 text-emerald-800';
};

function MatrixTable({
    title,
    icon,
    players,
    matrix,
    cellTooltip
}: {
    title: string;
    icon: React.ReactNode;
    players: Player[];
    matrix: Matrix;
    cellTooltip: (row: Player, col: Player, cell: Cell) => string;
}) {
    const max = Math.max(
        0,
        ...players.flatMap(p => players.map(q => matrix.get(p.id)?.get(q.id)?.count || 0))
    );

    return (
        <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                {icon}
                {title}
            </h3>
            <div className="overflow-x-auto">
                <table className="border-collapse text-xs">
                    <thead>
                        <tr>
                            <th className="sticky left-0 bg-white" />
                            {players.map(col => (
                                <th
                                    key={col.id}
                                    title={col.name}
                                    className="w-8 h-8 text-[10px] font-semibold text-gray-500 text-center align-bottom pb-1"
                                >
                                    {getInitials(col.name)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {players.map(row => (
                            <tr key={row.id}>
                                <th
                                    scope="row"
                                    title={row.name}
                                    className="sticky left-0 bg-white pr-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap"
                                >
                                    {row.name}
                                </th>
                                {players.map(col => {
                                    if (col.id === row.id) {
                                        return (
                                            <td
                                                key={col.id}
                                                className="w-8 h-8 text-center bg-gray-50 text-gray-300"
                                            >
                                                –
                                            </td>
                                        );
                                    }
                                    const cell = matrix.get(row.id)?.get(col.id) || { count: 0, wins: 0 };
                                    return (
                                        <td
                                            key={col.id}
                                            title={cellTooltip(row, col, cell)}
                                            className={`w-8 h-8 text-center font-bold rounded-sm ${heatClass(cell.count, max)}`}
                                        >
                                            {cell.count || ''}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-400">
                <span>Fewer</span>
                <span className="w-3 h-3 rounded-sm bg-emerald-100" />
                <span className="w-3 h-3 rounded-sm bg-emerald-300" />
                <span className="w-3 h-3 rounded-sm bg-emerald-400" />
                <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                <span className="w-3 h-3 rounded-sm bg-emerald-600" />
                <span>More</span>
            </div>
        </div>
    );
}

export default function PlayerMatchups({
    refreshTrigger,
    sessionId,
    defaultExpanded = false
}: {
    refreshTrigger?: number;
    sessionId?: string;
    defaultExpanded?: boolean;
}) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [teammateMatrix, setTeammateMatrix] = useState<Matrix>(new Map());
    const [opponentMatrix, setOpponentMatrix] = useState<Matrix>(new Map());
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!isExpanded) return;

        const matchesUrl = sessionId ? `/api/matches?sessionId=${sessionId}` : '/api/matches';

        Promise.all([
            fetch(matchesUrl).then(res => res.json()),
            fetch('/api/players').then(res => res.json())
        ]).then(([mData, pData]: [Match[], Player[]]) => {
            const finished = (mData as Match[]).filter(m => m.isFinished);

            const playedIds = new Set<string>();
            finished.forEach(m => [...m.team1, ...m.team2].forEach(id => playedIds.add(id)));

            const activePlayers = pData
                .filter(p => playedIds.has(p.id))
                .sort((a, b) => a.name.localeCompare(b.name));

            const teammates: Matrix = new Map(activePlayers.map(p => [p.id, new Map<string, Cell>()]));
            const opponents: Matrix = new Map(activePlayers.map(p => [p.id, new Map<string, Cell>()]));

            finished.forEach(match => {
                const team1Won = match.winnerTeam === 1;
                const team2Won = match.winnerTeam === 2;

                // Teammates: every pair within the same team.
                match.team1.forEach(a => match.team1.forEach(b => {
                    if (a !== b) bump(teammates, a, b, team1Won);
                }));
                match.team2.forEach(a => match.team2.forEach(b => {
                    if (a !== b) bump(teammates, a, b, team2Won);
                }));

                // Opponents: every pair across the two teams, tracked directionally
                // so each cell can show the row player's record against the column player.
                match.team1.forEach(a => match.team2.forEach(b => {
                    bump(opponents, a, b, team1Won);
                    bump(opponents, b, a, team2Won);
                }));
            });

            setPlayers(activePlayers);
            setTeammateMatrix(teammates);
            setOpponentMatrix(opponents);
            setLoaded(true);
        });
    }, [isExpanded, refreshTrigger, sessionId]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
            <div
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-purple-600">
                    <Users className="w-5 h-5" />
                    <h2 className="font-bold text-lg text-gray-800">Player Matchups</h2>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {isExpanded && !loaded && (
                <p className="text-sm text-gray-400">Loading…</p>
            )}

            {isExpanded && loaded && players.length < 2 && (
                <p className="text-sm text-gray-400">Not enough completed matches yet.</p>
            )}

            {isExpanded && loaded && players.length >= 2 && (
                <div className="space-y-8">
                    <MatrixTable
                        title="Played With (Teammates)"
                        icon={<Users className="w-4 h-4" />}
                        players={players}
                        matrix={teammateMatrix}
                        cellTooltip={(row, col, cell) => {
                            if (cell.count === 0) return `${row.name} & ${col.name} — never teamed up`;
                            const pct = Math.round((cell.wins / cell.count) * 100);
                            return `${row.name} & ${col.name}: ${cell.count} match${cell.count === 1 ? '' : 'es'} together — won ${cell.wins} (${pct}%)`;
                        }}
                    />

                    <MatrixTable
                        title="Played Against (Opponents)"
                        icon={<Swords className="w-4 h-4" />}
                        players={players}
                        matrix={opponentMatrix}
                        cellTooltip={(row, col, cell) => {
                            if (cell.count === 0) return `${row.name} vs ${col.name} — never played each other`;
                            return `${row.name} vs ${col.name}: ${cell.count} match${cell.count === 1 ? '' : 'es'} — ${row.name} ${cell.wins}-${cell.count - cell.wins}`;
                        }}
                    />
                </div>
            )}
        </div>
    );
}
