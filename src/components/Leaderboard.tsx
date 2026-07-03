
'use client';

import { useEffect, useState } from 'react';
import { Player } from '@/lib/types';
import { Trophy, ChevronUp, ChevronDown, Info } from 'lucide-react';

type SortKey = 'name' | 'w' | 'l' | 'wpct' | 'pts' | 'ptsg' | 'g' | 'bayes';

function bayesianWinRate(p: Player, C: number, globalMeanWr: number): number {
    return (C * globalMeanWr + p.matchesWon) / (C + p.matchesPlayed);
}

function getValue(p: Player, key: SortKey, C = 0, globalMeanWr = 0): number | string {
    const losses = p.matchesPlayed - p.matchesWon;
    switch (key) {
        case 'name':  return p.name;
        case 'w':     return p.matchesWon;
        case 'l':     return losses;
        case 'wpct':  return p.matchesPlayed > 0 ? p.matchesWon / p.matchesPlayed : 0;
        case 'pts':   return p.pointsScored || 0;
        case 'ptsg':  return p.matchesPlayed > 0 ? (p.pointsScored || 0) / p.matchesPlayed : 0;
        case 'g':     return p.matchesPlayed;
        case 'bayes': return bayesianWinRate(p, C, globalMeanWr);
    }
}

export default function Leaderboard({ refreshTrigger, sessionId, showAllTime }: { refreshTrigger?: number, sessionId?: string, showAllTime?: boolean }) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>(showAllTime ? 'bayes' : 'w');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        const url = sessionId
            ? `/api/stats?sessionId=${sessionId}`
            : showAllTime ? `/api/stats?range=all` : `/api/stats`;

        fetch(url)
            .then(res => res.json())
            .then(data => setPlayers(data as Player[]));
    }, [refreshTrigger, sessionId, showAllTime]);

    const totalGames = players.reduce((s, p) => s + p.matchesPlayed, 0);
    const totalWins  = players.reduce((s, p) => s + p.matchesWon, 0);
    const C            = players.length > 0 ? totalGames / players.length : 0;
    const globalMeanWr = totalGames > 0 ? totalWins / totalGames : 0;

    const handleSort = (key: SortKey) => {
        if (key === sortKey) {
            setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const sorted = [...players].sort((a, b) => {
        const av = getValue(a, sortKey, C, globalMeanWr);
        const bv = getValue(b, sortKey, C, globalMeanWr);
        const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
        return sortDir === 'desc' ? -cmp : cmp;
    });

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-20 inline ml-0.5" />;
        return sortDir === 'desc'
            ? <ChevronDown className="w-3 h-3 inline ml-0.5 text-emerald-600" />
            : <ChevronUp className="w-3 h-3 inline ml-0.5 text-emerald-600" />;
    };

    const Th = ({ col, label, className = '' }: { col: SortKey, label: string, className?: string }) => (
        <th
            className={`px-3 py-2 cursor-pointer select-none hover:text-gray-800 ${className}`}
            onClick={() => handleSort(col)}
        >
            {label}<SortIcon col={col} />
        </th>
    );

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4 text-amber-500">
                <Trophy className="w-5 h-5" />
                <h2 className="font-bold text-lg text-gray-800">{showAllTime ? 'Hall of Fame' : 'Leaderboard'}</h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 rounded-l-lg">#</th>
                            <Th col="name" label="Player" />
                            {showAllTime && <Th col="bayes" label="Bayesian" className="text-center" />}
                            <Th col="w"    label="W"    className="text-center" />
                            <Th col="l"    label="L"    className="text-center" />
                            <Th col="wpct" label="W%"   className="text-center" />
                            <Th col="pts"  label="Pts"  className="text-center" />
                            <Th col="ptsg" label="Pts/G" className="text-center" />
                            <Th col="g"    label="G"    className="text-center rounded-r-lg" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sorted.map((p, i) => {
                            const winPct = p.matchesPlayed > 0 ? ((p.matchesWon / p.matchesPlayed) * 100).toFixed(0) : '0';
                            const ptsPerGame = p.matchesPlayed > 0 ? ((p.pointsScored || 0) / p.matchesPlayed).toFixed(1) : '0.0';
                            return (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 font-medium text-gray-400">{i + 1}</td>
                                    <td className="px-3 py-2 font-medium text-gray-900">{p.name}</td>
                                    {showAllTime && (
                                        <td className="px-3 py-2 text-center font-semibold text-orange-500">
                                            {(bayesianWinRate(p, C, globalMeanWr) * 100).toFixed(1)}%
                                        </td>
                                    )}
                                    <td className="px-3 py-2 text-center font-bold text-emerald-600">{p.matchesWon}</td>
                                    <td className="px-3 py-2 text-center text-red-400">{p.matchesPlayed - p.matchesWon}</td>
                                    <td className="px-3 py-2 text-center font-semibold text-blue-600">{winPct}%</td>
                                    <td className="px-3 py-2 text-center text-gray-600">{p.pointsScored || 0}</td>
                                    <td className="px-3 py-2 text-center text-purple-600">{ptsPerGame}</td>
                                    <td className="px-3 py-2 text-center text-gray-400">{p.matchesPlayed}</td>
                                </tr>
                            );
                        })}
                        {players.length === 0 && (
                            <tr>
                                <td colSpan={showAllTime ? 9 : 8} className="px-3 py-4 text-center text-gray-400">No players checked in</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showAllTime && players.length > 0 && (
                <div className="mt-5 pt-5 border-t border-gray-100 text-sm text-gray-600">
                    <div className="flex items-center gap-2 mb-3">
                        <Info className="w-4 h-4 text-orange-400 flex-shrink-0" />
                        <span className="font-bold text-gray-800">How Bayesian Ranking is calculated</span>
                    </div>
                    <p className="mb-3">
                        Raw win rate can be misleading for players with few games. The Bayesian ranking adjusts each player's win rate toward the league average, weighted by how many games they've played.
                    </p>
                    <div className="bg-gray-50 rounded-lg p-3 font-mono text-center text-gray-700 mb-3">
                        Bayesian = (C × league_avg + wins) / (C + games)
                    </div>
                    <ul className="space-y-1 text-gray-500">
                        <li><span className="font-semibold text-gray-700">C</span> — average games played across all players = <span className="text-orange-500 font-semibold">{C.toFixed(1)}</span></li>
                        <li><span className="font-semibold text-gray-700">league_avg</span> — total wins ÷ total games = <span className="text-orange-500 font-semibold">{(globalMeanWr * 100).toFixed(1)}%</span></li>
                        <li><span className="font-semibold text-gray-700">wins / games</span> — the individual player's record</li>
                    </ul>
                    <p className="mt-3 text-gray-400 italic">
                        A player with few games is pulled toward the league average. As they play more, their Bayesian score converges to their true win rate.
                    </p>
                </div>
            )}
        </div>
    );
}
