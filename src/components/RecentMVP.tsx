'use client';

import { useEffect, useState } from 'react';
import { Player } from '@/lib/types';
import { Crown } from 'lucide-react';

const MIN_MATCHES = 5;

interface MVPData {
    player: Player;
    sessionCount: number;
}

export default function RecentMVP() {
    const [mvp, setMvp] = useState<MVPData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/stats?range=recent')
            .then(res => res.json())
            .then(({ players, sessionCount }: { players: Player[], sessionCount: number }) => {
                const qualified = players.filter(p => p.matchesPlayed >= MIN_MATCHES);
                if (qualified.length === 0) { setLoading(false); return; }

                const ranked = qualified.sort((a, b) => {
                    const aPct = a.matchesWon / a.matchesPlayed;
                    const bPct = b.matchesWon / b.matchesPlayed;
                    if (bPct !== aPct) return bPct - aPct;
                    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
                    const aPpg = (a.pointsScored || 0) / a.matchesPlayed;
                    const bPpg = (b.pointsScored || 0) / b.matchesPlayed;
                    return bPpg - aPpg;
                });

                setMvp({ player: ranked[0], sessionCount });
                setLoading(false);
            });
    }, []);

    if (loading || !mvp) return null;

    const { player, sessionCount } = mvp;
    const winPct = ((player.matchesWon / player.matchesPlayed) * 100).toFixed(0);
    const ptsg = ((player.pointsScored || 0) / player.matchesPlayed).toFixed(1);
    const losses = player.matchesPlayed - player.matchesWon;

    return (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                <Crown className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-gray-800">Hot Streak</h3>
                <span className="text-xs text-gray-400 ml-1">last {sessionCount} session{sessionCount !== 1 ? 's' : ''}</span>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-2xl font-extrabold text-gray-900">{player.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {player.matchesWon}W – {losses}L · {player.matchesPlayed} matches
                    </p>
                </div>
                <div className="text-right space-y-1">
                    <div className="text-3xl font-extrabold text-amber-500">{winPct}%</div>
                    <div className="text-xs text-gray-400">{ptsg} pts/game</div>
                </div>
            </div>
        </div>
    );
}
