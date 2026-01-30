'use client';

import { useState } from 'react';
import { Play, RotateCcw, Settings } from 'lucide-react';
import { Matchmaker } from '@/lib/matchmaker';
import { Match, Player } from '@/lib/types';
import Leaderboard from '@/components/Leaderboard';
import MatchHistory from '@/components/MatchHistory';

interface SimulationConfig {
    playerCount: number;
    matchCount: number;
    mode: 'rotation' | 'strict-partners' | 'comparison';
}

interface SimulationStats {
    gamesPlayedPerPlayer: { min: number; max: number; avg: number };
    uniquePartnersPerPlayer: { min: number; max: number; avg: number };
    repeatedPartnerships: number;
    totalPartnerships: number;
    avgWaitTime: number;
    maxWaitTime: number;
}

interface SimulationResult {
    matches: Match[];
    players: Player[];
    stats: SimulationStats;
    mode: 'rotation' | 'strict-partners';
}

export default function SimulatorPage() {
    const [config, setConfig] = useState<SimulationConfig>({
        playerCount: 8,
        matchCount: 20,
        mode: 'rotation'
    });
    
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<SimulationResult[]>([]);

    const generateRandomPlayers = (count: number): Player[] => {
        const names = ['Javier','Diego','Sebas','Horacio','Ivan','Jorge','Xavi','Fede','David','Victor', 'Lars'];
        
        return Array.from({ length: count }, (_, i) => ({
            id: `player-${i + 1}`,
            name: names[i] || `Player ${i + 1}`,
            isCheckedIn: true,
            matchesPlayed: 0,
            matchesWon: 0,
            pointsScored: 0,
            pointsAllowed: 0
        }));
    };

    const runSimulation = (mode: 'rotation' | 'strict-partners'): SimulationResult => {
        const players = generateRandomPlayers(config.playerCount);
        const matches: Match[] = [];
        const playerMap = new Map(players.map(p => [p.id, p.name]));
        let matchCounter = 0;

        // Track when each player last played for wait time calculation
        const lastPlayedTime = new Map<string, number>();

        for (let i = 0; i < config.matchCount; i++) {
            const availablePlayers = players.map(p => p.id);
            const proposal = Matchmaker.proposeMatch(availablePlayers, matches, playerMap, mode);
            
            if (!proposal) break;

            // Generate random scores (0-11)
            const score1 = Math.floor(Math.random() * 12);
            const score2 = Math.floor(Math.random() * 12);
            const winnerTeam = score1 > score2 ? 1 : score1 < score2 ? 2 : (Math.random() > 0.5 ? 1 : 2);

            const match: Match = {
                id: `match-${++matchCounter}`,
                sessionId: 'simulation',
                team1: proposal.team1,
                team2: proposal.team2,
                score1,
                score2,
                isFinished: true,
                winnerTeam,
                timestamp: Date.now() + i * 600000 // Simulate 10 min between matches
            };

            matches.push(match);

            // Update player stats
            const allPlayers = [...proposal.team1, ...proposal.team2];
            allPlayers.forEach(playerId => {
                const player = players.find(p => p.id === playerId)!;
                player.matchesPlayed++;
                
                const isTeam1 = proposal.team1.includes(playerId);
                const isWinner = (isTeam1 && winnerTeam === 1) || (!isTeam1 && winnerTeam === 2);
                
                if (isWinner) player.matchesWon++;
                player.pointsScored = (player.pointsScored || 0) + (isTeam1 ? score1 : score2);
                player.pointsAllowed = (player.pointsAllowed || 0) + (isTeam1 ? score2 : score1);

                lastPlayedTime.set(playerId, match.timestamp);
            });
        }

        // Calculate statistics
        const stats = calculateStats(players, matches, lastPlayedTime);

        return {
            matches,
            players,
            stats,
            mode
        };
    };

    const calculateStats = (
        players: Player[],
        matches: Match[],
        lastPlayedTime: Map<string, number>
    ): SimulationStats => {
        // Games played per player
        const gamesPlayed = players.map(p => p.matchesPlayed);
        const gamesPlayedPerPlayer = {
            min: Math.min(...gamesPlayed),
            max: Math.max(...gamesPlayed),
            avg: gamesPlayed.reduce((a, b) => a + b, 0) / players.length
        };

        // Partner analysis
        const partnershipCounts = new Map<string, number>();
        matches.forEach(match => {
            if (match.team1.length === 2) {
                const key = [match.team1[0], match.team1[1]].sort().join('-');
                partnershipCounts.set(key, (partnershipCounts.get(key) || 0) + 1);
            }
            if (match.team2.length === 2) {
                const key = [match.team2[0], match.team2[1]].sort().join('-');
                partnershipCounts.set(key, (partnershipCounts.get(key) || 0) + 1);
            }
        });

        const uniquePartnersPerPlayer = players.map(player => {
            const partners = new Set<string>();
            matches.forEach(match => {
                const allTeams = [match.team1, match.team2];
                allTeams.forEach(team => {
                    if (team.includes(player.id)) {
                        team.forEach(id => {
                            if (id !== player.id) partners.add(id);
                        });
                    }
                });
            });
            return partners.size;
        });

        const repeatedPartnerships = Array.from(partnershipCounts.values()).filter(count => count > 1).length;
        const totalPartnerships = partnershipCounts.size;

        // Wait time analysis
        const waitTimes: number[] = [];
        players.forEach(player => {
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
            uniquePartnersPerPlayer: {
                min: Math.min(...uniquePartnersPerPlayer),
                max: Math.max(...uniquePartnersPerPlayer),
                avg: uniquePartnersPerPlayer.reduce((a, b) => a + b, 0) / players.length
            },
            repeatedPartnerships,
            totalPartnerships,
            avgWaitTime: waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0,
            maxWaitTime: waitTimes.length > 0 ? Math.max(...waitTimes) : 0
        };
    };

    const handleRunSimulation = () => {
        setIsRunning(true);
        
        setTimeout(() => {
            const newResults: SimulationResult[] = [];
            
            if (config.mode === 'comparison') {
                newResults.push(runSimulation('rotation'));
                newResults.push(runSimulation('strict-partners'));
            } else {
                newResults.push(runSimulation(config.mode));
            }
            
            setResults(newResults);
            setIsRunning(false);
        }, 100);
    };

    const handleReset = () => {
        setResults([]);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-gradient-to-r from-purple-600 to-purple-700 shadow-md">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-extrabold text-white tracking-tight">Session Simulator</h1>
                            <p className="text-purple-100">Development Tool - Matchmaking Algorithm Analysis</p>
                        </div>
                        <Settings className="w-8 h-8 text-purple-200" />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto p-4 md:p-8">
                {/* Configuration Panel */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Configuration</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Player Count */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Number of Players
                            </label>
                            <input
                                type="number"
                                min="4"
                                max="16"
                                value={config.playerCount}
                                onChange={(e) => setConfig({ ...config, playerCount: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>

                        {/* Match Count */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Number of Matches
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={config.matchCount}
                                onChange={(e) => setConfig({ ...config, matchCount: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>

                        {/* Mode */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Matchmaking Mode
                            </label>
                            <select
                                value={config.mode}
                                onChange={(e) => setConfig({ ...config, mode: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                                <option value="rotation">Rotation</option>
                                <option value="strict-partners">No Repeat Partners</option>
                                <option value="comparison">Compare Both</option>
                            </select>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={handleRunSimulation}
                            disabled={isRunning}
                            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            <Play className="w-5 h-5" />
                            {isRunning ? 'Running...' : 'Run Simulation'}
                        </button>
                        
                        {results.length > 0 && (
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                            >
                                <RotateCcw className="w-5 h-5" />
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* Results */}
                {results.length > 0 && (
                    <div className={`grid grid-cols-1 ${results.length > 1 ? 'lg:grid-cols-2' : ''} gap-6`}>
                        {results.map((result, idx) => (
                            <div key={idx} className="space-y-6">
                                {/* Mode Header */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 capitalize">
                                        {result.mode === 'strict-partners' ? 'No Repeat Partners' : 'Rotation'} Mode
                                    </h3>
                                </div>

                                {/* Statistics Summary */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4">Statistics Summary</h3>
                                    
                                    <div className="space-y-4">
                                        {/* Games Played */}
                                        <div className="border-b border-gray-100 pb-3">
                                            <h4 className="text-sm font-semibold text-gray-600 mb-2">Games Played per Player</h4>
                                            <div className="grid grid-cols-3 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Min:</span>
                                                    <span className="ml-2 font-bold text-gray-800">{result.stats.gamesPlayedPerPlayer.min}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Max:</span>
                                                    <span className="ml-2 font-bold text-gray-800">{result.stats.gamesPlayedPerPlayer.max}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Avg:</span>
                                                    <span className="ml-2 font-bold text-gray-800">{result.stats.gamesPlayedPerPlayer.avg.toFixed(1)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Partner Variety */}
                                        <div className="border-b border-gray-100 pb-3">
                                            <h4 className="text-sm font-semibold text-gray-600 mb-2">Unique Partners per Player</h4>
                                            <div className="grid grid-cols-3 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Min:</span>
                                                    <span className="ml-2 font-bold text-gray-800">{result.stats.uniquePartnersPerPlayer.min}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Max:</span>
                                                    <span className="ml-2 font-bold text-gray-800">{result.stats.uniquePartnersPerPlayer.max}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Avg:</span>
                                                    <span className="ml-2 font-bold text-gray-800">{result.stats.uniquePartnersPerPlayer.avg.toFixed(1)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Repeated Partnerships */}
                                        <div className="border-b border-gray-100 pb-3">
                                            <h4 className="text-sm font-semibold text-gray-600 mb-2">Partnership Repetition</h4>
                                            <div className="text-sm">
                                                <span className="text-gray-500">Repeated Partnerships:</span>
                                                <span className="ml-2 font-bold text-gray-800">
                                                    {result.stats.repeatedPartnerships} / {result.stats.totalPartnerships}
                                                    ({result.stats.totalPartnerships > 0 ? ((result.stats.repeatedPartnerships / result.stats.totalPartnerships) * 100).toFixed(1) : 0}%)
                                                </span>
                                            </div>
                                        </div>

                                        {/* Wait Time */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-600 mb-2">Wait Time Between Games</h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Average:</span>
                                                    <span className="ml-2 font-bold text-gray-800">{result.stats.avgWaitTime.toFixed(1)} min</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Maximum:</span>
                                                    <span className="ml-2 font-bold text-gray-800">{result.stats.maxWaitTime.toFixed(1)} min</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Player Stats Table */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4">Player Performance</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Player</th>
                                                    <th className="px-3 py-2 text-center">Games</th>
                                                    <th className="px-3 py-2 text-center">Wins</th>
                                                    <th className="px-3 py-2 text-center">W%</th>
                                                    <th className="px-3 py-2 text-center">Pts</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {result.players.map(player => {
                                                    const winPct = player.matchesPlayed > 0 
                                                        ? ((player.matchesWon / player.matchesPlayed) * 100).toFixed(0) 
                                                        : '0';
                                                    return (
                                                        <tr key={player.id}>
                                                            <td className="px-3 py-2 font-medium text-gray-900">{player.name}</td>
                                                            <td className="px-3 py-2 text-center text-gray-600">{player.matchesPlayed}</td>
                                                            <td className="px-3 py-2 text-center font-bold text-emerald-600">{player.matchesWon}</td>
                                                            <td className="px-3 py-2 text-center font-semibold text-blue-600">{winPct}%</td>
                                                            <td className="px-3 py-2 text-center text-gray-600">{player.pointsScored || 0}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Match List */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4">Match History ({result.matches.length})</h3>
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {result.matches.map((match, index) => {
                                            const getNames = (ids: string[]) => {
                                                return ids.map(id => result.players.find(p => p.id === id)?.name || 'Unknown').join(' & ');
                                            };
                                            
                                            return (
                                                <div key={match.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-gray-500 min-w-[2rem]">#{index + 1}</span>
                                                        <span className={match.winnerTeam === 1 ? "font-bold text-gray-900" : "text-gray-500"}>
                                                            {getNames(match.team1)}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="px-4 font-mono font-bold text-lg text-gray-400">
                                                        {match.score1} - {match.score2}
                                                    </div>
                                                    
                                                    <div className="flex justify-end">
                                                        <span className={match.winnerTeam === 2 ? "font-bold text-gray-900" : "text-gray-500"}>
                                                            {getNames(match.team2)}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
