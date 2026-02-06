'use client';

import { useEffect, useState } from 'react';
import { Player, Match } from '@/lib/types';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

interface PartnershipStats {
    partnerId: string;
    partnerName: string;
    matchesPlayed: number;
    matchesWon: number;
    winRate: number;
}

interface OpponentStats {
    opponentId: string;
    opponentName: string;
    matchesPlayed: number;
    matchesLost: number;
    lossRate: number;
}

export default function PlayerInsights({ refreshTrigger, sessionId, showAllTime }: { refreshTrigger?: number, sessionId?: string, showAllTime?: boolean }) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
    const [partnerships, setPartnerships] = useState<PartnershipStats[]>([]);
    const [opponents, setOpponents] = useState<OpponentStats[]>([]);
    const [insightsExpanded, setInsightsExpanded] = useState(false);

    useEffect(() => {
        const statsUrl = sessionId 
            ? `/api/stats?sessionId=${sessionId}`
            : showAllTime ? `/api/stats?range=all` : `/api/stats`;
        
        const matchesUrl = sessionId
            ? `/api/matches?sessionId=${sessionId}`
            : showAllTime ? `/api/matches?range=all` : `/api/matches`;
        
        Promise.all([
            fetch(statsUrl).then(res => res.json()),
            fetch(matchesUrl).then(res => res.json())
        ]).then(([statsData, matchesData]) => {
            setPlayers(statsData);
            setMatches(matchesData.filter((m: Match) => m.isFinished));
        });
    }, [refreshTrigger, sessionId, showAllTime]);

    useEffect(() => {
        if (selectedPlayerId && matches.length > 0 && players.length > 0) {
            analyzePlayer(selectedPlayerId);
        }
    }, [selectedPlayerId, matches, players]);

    const analyzePlayer = (playerId: string) => {
        const partnerMap = new Map<string, { played: number; won: number; name: string }>();
        const opponentMap = new Map<string, { played: number; lost: number; name: string }>();

        matches.forEach(match => {
            const { team1, team2, winnerTeam } = match;
            const isOnTeam1 = team1.includes(playerId);
            const isOnTeam2 = team2.includes(playerId);

            if (!isOnTeam1 && !isOnTeam2) return;

            const playerTeam = isOnTeam1 ? team1 : team2;
            const opponentTeam = isOnTeam1 ? team2 : team1;
            const won = (isOnTeam1 && winnerTeam === 1) || (isOnTeam2 && winnerTeam === 2);

            // Track partners
            playerTeam.forEach(partnerId => {
                if (partnerId === playerId) return;
                const partner = players.find(p => p.id === partnerId);
                if (!partner) return;

                if (!partnerMap.has(partnerId)) {
                    partnerMap.set(partnerId, { played: 0, won: 0, name: partner.name });
                }
                const stats = partnerMap.get(partnerId)!;
                stats.played++;
                if (won) stats.won++;
            });

            // Track opponents
            opponentTeam.forEach(opponentId => {
                const opponent = players.find(p => p.id === opponentId);
                if (!opponent) return;

                if (!opponentMap.has(opponentId)) {
                    opponentMap.set(opponentId, { played: 0, lost: 0, name: opponent.name });
                }
                const stats = opponentMap.get(opponentId)!;
                stats.played++;
                if (!won) stats.lost++;
            });
        });

        // Convert to arrays and sort
        const partnerStats: PartnershipStats[] = Array.from(partnerMap.entries())
            .map(([id, stats]) => ({
                partnerId: id,
                partnerName: stats.name,
                matchesPlayed: stats.played,
                matchesWon: stats.won,
                winRate: stats.played > 0 ? (stats.won / stats.played) * 100 : 0
            }))
            .sort((a, b) => {
                // Sort by win rate, then by matches played
                if (Math.abs(b.winRate - a.winRate) > 0.01) return b.winRate - a.winRate;
                return b.matchesPlayed - a.matchesPlayed;
            })
            .slice(0, 5);

        const opponentStats: OpponentStats[] = Array.from(opponentMap.entries())
            .map(([id, stats]) => ({
                opponentId: id,
                opponentName: stats.name,
                matchesPlayed: stats.played,
                matchesLost: stats.lost,
                lossRate: stats.played > 0 ? (stats.lost / stats.played) * 100 : 0
            }))
            .sort((a, b) => {
                // Sort by loss rate, then by matches played
                if (Math.abs(b.lossRate - a.lossRate) > 0.01) return b.lossRate - a.lossRate;
                return b.matchesPlayed - a.matchesPlayed;
            })
            .slice(0, 5);

        setPartnerships(partnerStats);
        setOpponents(opponentStats);
    };

    const getWinRateColor = (rate: number) => {
        if (rate >= 70) return 'text-emerald-600';
        if (rate >= 50) return 'text-blue-600';
        if (rate >= 30) return 'text-amber-600';
        return 'text-red-600';
    };

    const getWinRateBgColor = (rate: number) => {
        if (rate >= 70) return 'bg-emerald-50';
        if (rate >= 50) return 'bg-blue-50';
        if (rate >= 30) return 'bg-amber-50';
        return 'bg-red-50';
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <button
                onClick={() => setInsightsExpanded(!insightsExpanded)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
            >
                <Users className="w-5 h-5" />
                <h2 className="font-bold text-lg text-gray-800">Player Insights</h2>
                <span className="text-sm text-gray-500">({insightsExpanded ? 'hide' : 'show'})</span>
            </button>

            {insightsExpanded && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Player to Analyze
                        </label>
                        <select
                            value={selectedPlayerId}
                            onChange={(e) => setSelectedPlayerId(e.target.value)}
                            className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        >
                            <option value="">Choose a player...</option>
                            {players.filter(p => p.matchesPlayed > 0).map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.matchesWon}-{p.matchesPlayed - p.matchesWon})
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedPlayerId && (
                        <div className="space-y-6">
                            {/* Best Partners */}
                            <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-lg border border-emerald-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                                    <h3 className="font-bold text-gray-800">Best Partners</h3>
                                </div>
                                {partnerships.length > 0 ? (
                                    <div className="space-y-2">
                                        {partnerships.map((partner, idx) => (
                                            <div
                                                key={partner.partnerId}
                                                className={clsx(
                                                    'flex items-center justify-between p-2 rounded',
                                                    getWinRateBgColor(partner.winRate)
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-400 w-5">#{idx + 1}</span>
                                                    <span className="font-medium text-gray-900">{partner.partnerName}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm text-gray-600">
                                                        {partner.matchesWon}-{partner.matchesPlayed - partner.matchesWon}
                                                    </span>
                                                    <span className={clsx('text-sm font-bold', getWinRateColor(partner.winRate))}>
                                                        {partner.winRate.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No partnership data available</p>
                                )}
                            </div>

                            {/* Toughest Opponents */}
                            <div className="bg-gradient-to-br from-red-50 to-orange-50 p-4 rounded-lg border border-red-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <TrendingDown className="w-5 h-5 text-red-600" />
                                    <h3 className="font-bold text-gray-800">Toughest Opponents</h3>
                                </div>
                                {opponents.length > 0 ? (
                                    <div className="space-y-2">
                                        {opponents.map((opponent, idx) => (
                                            <div
                                                key={opponent.opponentId}
                                                className="flex items-center justify-between p-2 rounded bg-white"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-400 w-5">#{idx + 1}</span>
                                                    <span className="font-medium text-gray-900">{opponent.opponentName}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm text-gray-600">
                                                        {opponent.matchesLost}-{opponent.matchesPlayed - opponent.matchesLost}
                                                    </span>
                                                    <span className="text-sm font-bold text-red-600">
                                                        {opponent.lossRate.toFixed(0)}% loss
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No opponent data available</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
