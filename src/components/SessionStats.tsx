'use client';

import { useState, useEffect } from 'react';
import { Match, Player } from '@/lib/types';
import { TrendingUp, Users, Clock, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

interface QualityMetrics {
    fatigueAvoidance: { count: number; total: number; percentage: number };
    winnerSplitting: { count: number; total: number; percentage: number };
    partnershipVariety: { count: number; total: number; percentage: number };
    unusedPartnerships: { used: number; total: number; unused: number; percentage: number };
}

interface Stats {
    gamesPlayedPerPlayer: { min: number; max: number; avg: number };
    uniquePartnersPerPlayer: { min: number; max: number; avg: number };
    avgWaitTime: number;
    maxWaitTime: number;
}

export default function SessionStats({ refreshTrigger, sessionId }: { refreshTrigger: number, sessionId?: string }) {
    const [matches, setMatches] = useState<Match[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [quality, setQuality] = useState<QualityMetrics | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        const matchesUrl = sessionId 
            ? `/api/matches?sessionId=${sessionId}`
            : '/api/matches';
        
        Promise.all([
            fetch(matchesUrl).then(res => res.json()),
            fetch('/api/players').then(res => res.json())
        ]).then(([mData, pData]) => {
            const finishedMatches = (mData as Match[]).filter(m => m.isFinished);
            setMatches(finishedMatches);
            setPlayers(pData);
            
            if (finishedMatches.length > 0) {
                // Get unique players who actually played in these matches
                const playersInMatches = new Set<string>();
                finishedMatches.forEach(match => {
                    [...match.team1, ...match.team2].forEach(id => playersInMatches.add(id));
                });
                const playerCount = playersInMatches.size;
                
                setQuality(calculateQualityMetrics(finishedMatches, playerCount));
                setStats(calculateStats(finishedMatches, pData));
            }
        });
    }, [refreshTrigger, sessionId]);

    const calculateQualityMetrics = (matches: Match[], playerCount: number): QualityMetrics => {
        let fatigueAvoidanceCount = 0;
        let winnerSplitCount = 0;
        let winnerSplitTotal = 0;
        let partnershipVarietyCount = 0;

        const usedPartnerships = new Set<string>();
        const historicalTeams = new Set<string>();

        // Sort by timestamp
        const sortedMatches = [...matches].sort((a, b) => a.timestamp - b.timestamp);

        sortedMatches.forEach((match, index) => {
            const prevMatch = index > 0 ? sortedMatches[index - 1] : null;
            const prevPrevMatch = index > 1 ? sortedMatches[index - 2] : null;

            // Check for fatigued players
            let hadFatigued = false;
            if (prevMatch && prevPrevMatch) {
                const prevPlayers = [...prevMatch.team1, ...prevMatch.team2];
                const prevPrevPlayers = [...prevPrevMatch.team1, ...prevPrevMatch.team2];
                const currentPlayers = [...match.team1, ...match.team2];

                currentPlayers.forEach(id => {
                    if (prevPlayers.includes(id) && prevPrevPlayers.includes(id)) {
                        hadFatigued = true;
                    }
                });
            }
            if (!hadFatigued) fatigueAvoidanceCount++;

            // Check for winner splitting
            if (prevMatch && prevMatch.winnerTeam) {
                const winners = prevMatch.winnerTeam === 1 ? prevMatch.team1 : prevMatch.team2;
                const currentPlayers = [...match.team1, ...match.team2];
                const winnersInCurrent = winners.filter(w => currentPlayers.includes(w));

                if (winnersInCurrent.length === 2) {
                    winnerSplitTotal++;
                    const winnersKey = winnersInCurrent.sort().join('-');
                    const team1Key = [...match.team1].sort().join('-');
                    const team2Key = [...match.team2].sort().join('-');
                    
                    if (team1Key !== winnersKey && team2Key !== winnersKey) {
                        winnerSplitCount++;
                    }
                }
            }

            // Check for repeated partnerships
            const team1Key = match.team1.length === 2 ? [...match.team1].sort().join('-') : '';
            const team2Key = match.team2.length === 2 ? [...match.team2].sort().join('-') : '';
            
            const hasRepeats = (team1Key && historicalTeams.has(team1Key)) || (team2Key && historicalTeams.has(team2Key));
            if (!hasRepeats) partnershipVarietyCount++;

            // Track partnerships
            if (team1Key) {
                usedPartnerships.add(team1Key);
                historicalTeams.add(team1Key);
            }
            if (team2Key) {
                usedPartnerships.add(team2Key);
                historicalTeams.add(team2Key);
            }
        });

        const totalPossiblePartnerships = (playerCount * (playerCount - 1)) / 2;

        return {
            fatigueAvoidance: {
                count: fatigueAvoidanceCount,
                total: matches.length,
                percentage: matches.length > 0 ? (fatigueAvoidanceCount / matches.length) * 100 : 0
            },
            winnerSplitting: {
                count: winnerSplitCount,
                total: winnerSplitTotal,
                percentage: winnerSplitTotal > 0 ? (winnerSplitCount / winnerSplitTotal) * 100 : 0
            },
            partnershipVariety: {
                count: partnershipVarietyCount,
                total: matches.length,
                percentage: matches.length > 0 ? (partnershipVarietyCount / matches.length) * 100 : 0
            },
            unusedPartnerships: {
                used: usedPartnerships.size,
                total: totalPossiblePartnerships,
                unused: totalPossiblePartnerships - usedPartnerships.size,
                percentage: totalPossiblePartnerships > 0 ? (usedPartnerships.size / totalPossiblePartnerships) * 100 : 0
            }
        };
    };

    const calculateStats = (matches: Match[], players: Player[]): Stats => {
        // Games played per player - count from matches, not cumulative stats
        const playerMatchCounts = new Map<string, number>();
        matches.forEach(match => {
            [...match.team1, ...match.team2].forEach(playerId => {
                playerMatchCounts.set(playerId, (playerMatchCounts.get(playerId) || 0) + 1);
            });
        });

        const gamesPlayed = players
            .map(p => playerMatchCounts.get(p.id) || 0)
            .filter(count => count > 0); // Only players who actually played
        
        const gamesPlayedPerPlayer = gamesPlayed.length > 0 ? {
            min: Math.min(...gamesPlayed),
            max: Math.max(...gamesPlayed),
            avg: gamesPlayed.reduce((a, b) => a + b, 0) / gamesPlayed.length
        } : { min: 0, max: 0, avg: 0 };

        // Filter to only players who participated in these matches
        const activePlayers = players.filter(p => playerMatchCounts.has(p.id));

        // Partner analysis
        const uniquePartnersPerPlayer = activePlayers.map(player => {
            const partners = new Set<string>();
            matches.forEach(match => {
                [match.team1, match.team2].forEach(team => {
                    if (team.includes(player.id)) {
                        team.forEach(id => {
                            if (id !== player.id) partners.add(id);
                        });
                    }
                });
            });
            return partners.size;
        });

        // Wait time analysis
        const waitTimes: number[] = [];
        activePlayers.forEach(player => {
            const playerMatches = matches
                .filter(m => [...m.team1, ...m.team2].includes(player.id))
                .sort((a, b) => a.timestamp - b.timestamp);
            
            for (let i = 1; i < playerMatches.length; i++) {
                const wait = playerMatches[i].timestamp - playerMatches[i - 1].timestamp;
                waitTimes.push(wait / 60000); // Convert to minutes
            }
        });

        return {
            gamesPlayedPerPlayer,
            uniquePartnersPerPlayer: uniquePartnersPerPlayer.length > 0 ? {
                min: Math.min(...uniquePartnersPerPlayer),
                max: Math.max(...uniquePartnersPerPlayer),
                avg: uniquePartnersPerPlayer.reduce((a, b) => a + b, 0) / uniquePartnersPerPlayer.length
            } : { min: 0, max: 0, avg: 0 },
            avgWaitTime: waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0,
            maxWaitTime: waitTimes.length > 0 ? Math.max(...waitTimes) : 0
        };
    };

    if (matches.length === 0 || !quality || !stats) {
        return null;
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
            <div
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-purple-600">
                    <BarChart3 className="w-5 h-5" />
                    <h2 className="font-bold text-lg text-gray-800">Session Analytics</h2>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {isExpanded && (
                <div className="space-y-6">
                    {/* Quality Metrics */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Quality Metrics
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                    <div className="text-xs font-semibold text-gray-700">Fatigue Management</div>
                                    <div className="text-xs text-gray-500">No three games in a row</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-600">
                                        {quality.fatigueAvoidance.count}/{quality.fatigueAvoidance.total}
                                    </span>
                                    <span className={`text-lg font-bold ${quality.fatigueAvoidance.percentage >= 75 ? 'text-emerald-600' : quality.fatigueAvoidance.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {quality.fatigueAvoidance.percentage.toFixed(0)}%
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                    <div className="text-xs font-semibold text-gray-700">Partnership Coverage</div>
                                    <div className="text-xs text-gray-500">Unique partnerships explored</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-600">
                                        {quality.unusedPartnerships.used}/{quality.unusedPartnerships.total}
                                    </span>
                                    <span className={`text-lg font-bold ${quality.unusedPartnerships.percentage >= 75 ? 'text-emerald-600' : quality.unusedPartnerships.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {quality.unusedPartnerships.percentage.toFixed(0)}%
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                    <div className="text-xs font-semibold text-gray-700">Partnership Variety</div>
                                    <div className="text-xs text-gray-500">Fresh partnerships per match</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-600">
                                        {quality.partnershipVariety.count}/{quality.partnershipVariety.total}
                                    </span>
                                    <span className={`text-lg font-bold ${quality.partnershipVariety.percentage >= 75 ? 'text-emerald-600' : quality.partnershipVariety.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {quality.partnershipVariety.percentage.toFixed(0)}%
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                    <div className="text-xs font-semibold text-gray-700">Winner Splitting</div>
                                    <div className="text-xs text-gray-500">Winners split across teams</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-600">
                                        {quality.winnerSplitting.count}/{quality.winnerSplitting.total}
                                    </span>
                                    <span className={`text-lg font-bold ${quality.winnerSplitting.percentage >= 75 ? 'text-emerald-600' : quality.winnerSplitting.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {quality.winnerSplitting.percentage.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Statistics Summary */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Player Statistics
                        </h3>
                        <div className="space-y-3">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <h4 className="text-xs font-semibold text-gray-600 mb-2">Games Played per Player</h4>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <span className="text-gray-500">Min:</span>
                                        <span className="ml-2 font-bold text-gray-800">{stats.gamesPlayedPerPlayer.min}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Max:</span>
                                        <span className="ml-2 font-bold text-gray-800">{stats.gamesPlayedPerPlayer.max}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-gray-50 rounded-lg">
                                <h4 className="text-xs font-semibold text-gray-600 mb-2">Unique Partners per Player</h4>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <span className="text-gray-500">Min:</span>
                                        <span className="ml-2 font-bold text-gray-800">{stats.uniquePartnersPerPlayer.min}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Max:</span>
                                        <span className="ml-2 font-bold text-gray-800">{stats.uniquePartnersPerPlayer.max}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-gray-50 rounded-lg">
                                <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Wait Time Between Games
                                </h4>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <span className="text-gray-500">Average:</span>
                                        <span className="ml-2 font-bold text-gray-800">{stats.avgWaitTime.toFixed(1)} min</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Maximum:</span>
                                        <span className="ml-2 font-bold text-gray-800">{stats.maxWaitTime.toFixed(1)} min</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
