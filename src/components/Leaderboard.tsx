
'use client';

import { useEffect, useState } from 'react';
import { Player } from '@/lib/types';
import { Trophy } from 'lucide-react';
import clsx from 'clsx';

export default function Leaderboard({ refreshTrigger, range = 'today' }: { refreshTrigger?: number, range?: 'today' | 'all' }) {
    const [players, setPlayers] = useState<Player[]>([]);

    useEffect(() => {
        fetch(`/api/stats?range=${range}`)
            .then(res => res.json())
            .then(data => {
                // Sort by matches won
                const sorted = (data as Player[]).sort((a, b) => {
                    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
                    return b.matchesPlayed - a.matchesPlayed;
                });
                setPlayers(sorted);
            });
    }, [refreshTrigger, range]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4 text-amber-500">
                <Trophy className="w-5 h-5" />
                <h2 className="font-bold text-lg text-gray-800">{range === 'all' ? 'Hall of Fame' : "Today's Leaderboard"}</h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 rounded-l-lg">#</th>
                            <th className="px-3 py-2">Player</th>
                            <th className="px-3 py-2 text-center">W</th>
                            <th className="px-3 py-2 text-center">L</th>
                            <th className="px-3 py-2 text-center">Pts</th>
                            <th className="px-3 py-2 text-center rounded-r-lg">G</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {players.map((p, i) => (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium text-gray-400">{i + 1}</td>
                                <td className="px-3 py-2 font-medium text-gray-900">{p.name}</td>
                                <td className="px-3 py-2 text-center font-bold text-emerald-600">{p.matchesWon}</td>
                                <td className="px-3 py-2 text-center text-red-400">{p.matchesPlayed - p.matchesWon}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{p.pointsScored || 0}</td>
                                <td className="px-3 py-2 text-center text-gray-400">{p.matchesPlayed}</td>
                            </tr>
                        ))}
                        {players.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-3 py-4 text-center text-gray-400">No stats yet</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
