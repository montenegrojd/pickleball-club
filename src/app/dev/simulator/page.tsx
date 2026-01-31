'use client';

import { useState } from 'react';
import { Play, RotateCcw, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { Matchmaker } from '@/lib/matchmaker';
import { Match, Player } from '@/lib/types';

interface SimulationConfig {
    playerCount: number;
    matchCount: number;
    mode: 'rotation' | 'strict-partners' | 'comparison';
}

interface MatchAnalytics {
    hadFatiguedPlayers: string[];
    winnersWereSplit: boolean | null;
    repeatedPartnerships: Array<{ player1: string, player2: string }>;
    selectedPlayers: string[];
    keptWinners: boolean;
}

interface EnhancedMatch extends Match {
    analytics: MatchAnalytics;
}

interface QualityMetrics {
    fatigueAvoidance: { count: number; total: number; percentage: number };
    winnerSplitting: { count: number; total: number; percentage: number };
    partnershipVariety: { count: number; total: number; percentage: number };
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
    matches: EnhancedMatch[];
    players: Player[];
    stats: SimulationStats;
    quality: QualityMetrics;
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
    const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());

    const toggleMatchExpanded = (matchId: string) => {
        const newExpanded = new Set(expandedMatches);
        if (newExpanded.has(matchId)) {
            newExpanded.delete(matchId);
        } else {
            newExpanded.add(matchId);
        }
        setExpandedMatches(newExpanded);
    };

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
        const matches: EnhancedMatch[] = [];
        const playerMap = new Map(players.map(p => [p.id, p.name]));
        let matchCounter = 0;

        // Track when each player last played for wait time calculation
        const lastPlayedTime = new Map<string, number>();
        const historicalTeams = new Set<string>();

        for (let i = 0; i < config.matchCount; i++) {
            const availablePlayers = players.map(p => p.id);
            const proposal = Matchmaker.proposeMatch(availablePlayers, matches, playerMap, mode);
            
            if (!proposal) break;

            // Analyze the match decision
            const analytics = analyzeMatchDecision(matches, proposal, availablePlayers, players);

            // Generate random scores (0-11)
            const score1 = Math.floor(Math.random() * 12);
            const score2 = Math.floor(Math.random() * 12);
            const winnerTeam = score1 > score2 ? 1 : score1 < score2 ? 2 : (Math.random() > 0.5 ? 1 : 2);

            const match: EnhancedMatch = {
                id: `match-${++matchCounter}`,
                sessionId: 'simulation',
                team1: proposal.team1,
                team2: proposal.team2,
                score1,
                score2,
                isFinished: true,
                winnerTeam,
                timestamp: Date.now() + i * (Math.floor(Math.random() * 5) + 6) * 60000, // Simulate 6-10 min between matches
                analytics
            };

            matches.push(match);

            // Track teams for repeat analysis
            const team1Key = [...proposal.team1].sort().join('-');
            const team2Key = [...proposal.team2].sort().join('-');
            historicalTeams.add(team1Key);
            historicalTeams.add(team2Key);

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

        // Calculate statistics and quality metrics
        const stats = calculateStats(players, matches, lastPlayedTime);
        const quality = calculateQualityMetrics(matches);

        return {
            matches,
            players,
            stats,
            quality,
            mode
        };
    };

    const analyzeMatchDecision = (
        history: EnhancedMatch[],
        proposal: { team1: string[], team2: string[] },
        availablePlayers: string[],
        players: Player[]
    ): MatchAnalytics => {
        const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
        const lastMatch = sortedHistory[0];
        const secondLastMatch = sortedHistory[1];

        // Check for fatigued players (played last 2 consecutive games)
        const hadFatiguedPlayers: string[] = [];
        if (lastMatch && secondLastMatch) {
            const lastPlayers = [...lastMatch.team1, ...lastMatch.team2];
            const secondLastPlayers = [...secondLastMatch.team1, ...secondLastMatch.team2];
            
            const selectedPlayers = [...proposal.team1, ...proposal.team2];
            selectedPlayers.forEach(id => {
                if (lastPlayers.includes(id) && secondLastPlayers.includes(id)) {
                    hadFatiguedPlayers.push(id);
                }
            });
        }

        // Check if winners were split
        let winnersWereSplit: boolean | null = null;
        let keptWinners = false;
        if (lastMatch && lastMatch.winnerTeam) {
            const winners = lastMatch.winnerTeam === 1 ? lastMatch.team1 : lastMatch.team2;
            const selectedPlayers = [...proposal.team1, ...proposal.team2];
            const winnersInSelection = winners.filter(w => selectedPlayers.includes(w));
            
            if (winnersInSelection.length === 2) {
                const winnersKey = winnersInSelection.sort().join('-');
                const team1Key = [...proposal.team1].sort().join('-');
                const team2Key = [...proposal.team2].sort().join('-');
                winnersWereSplit = (team1Key !== winnersKey && team2Key !== winnersKey);
                keptWinners = winnersInSelection.length === 2; // Both winners are playing
            }
        }

        // Check for repeated partnerships
        const repeatedPartnerships: Array<{ player1: string, player2: string }> = [];
        const historicalTeams = new Set<string>();
        history.forEach(match => {
            if (match.team1.length === 2) {
                historicalTeams.add([...match.team1].sort().join('-'));
            }
            if (match.team2.length === 2) {
                historicalTeams.add([...match.team2].sort().join('-'));
            }
        });

        const team1Key = [...proposal.team1].sort().join('-');
        const team2Key = [...proposal.team2].sort().join('-');
        
        if (historicalTeams.has(team1Key)) {
            const sorted = [...proposal.team1].sort();
            repeatedPartnerships.push({ player1: sorted[0], player2: sorted[1] });
        }
        if (historicalTeams.has(team2Key)) {
            const sorted = [...proposal.team2].sort();
            repeatedPartnerships.push({ player1: sorted[0], player2: sorted[1] });
        }

        return {
            hadFatiguedPlayers,
            winnersWereSplit,
            repeatedPartnerships,
            selectedPlayers: [...proposal.team1, ...proposal.team2],
            keptWinners
        };
    };

    const calculateQualityMetrics = (matches: EnhancedMatch[]): QualityMetrics => {
        let fatigueAvoidanceCount = 0;
        let winnerSplitCount = 0;
        let winnerSplitTotal = 0;
        let partnershipVarietyCount = 0;

        matches.forEach(match => {
            // Fatigue avoidance (no fatigued players is good)
            if (match.analytics.hadFatiguedPlayers.length === 0) {
                fatigueAvoidanceCount++;
            }

            // Winner splitting (split is good)
            if (match.analytics.winnersWereSplit !== null) {
                winnerSplitTotal++;
                if (match.analytics.winnersWereSplit) {
                    winnerSplitCount++;
                }
            }

            // Partnership variety (no repeats is good)
            if (match.analytics.repeatedPartnerships.length === 0) {
                partnershipVarietyCount++;
            }
        });

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
            }
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
                                <option value="strict-partners">Rotation (new)</option>
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
                                        {result.mode === 'strict-partners' ? 'Rotation (new)' : 'Rotation'} Mode
                                    </h3>
                                </div>

                                {/* Quality Metrics Dashboard */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4">Session Quality Metrics</h3>
                                    
                                    <div className="space-y-3">
                                        {/* Fatigue Management */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="text-sm font-semibold text-gray-700">Fatigue Management</div>
                                                <div className="text-xs text-gray-500">Matches without fatigued players</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-600">
                                                    {result.quality.fatigueAvoidance.count}/{result.quality.fatigueAvoidance.total}
                                                </span>
                                                <span className={`text-lg font-bold ${result.quality.fatigueAvoidance.percentage >= 75 ? 'text-emerald-600' : result.quality.fatigueAvoidance.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                    {result.quality.fatigueAvoidance.percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Winner Splitting */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="text-sm font-semibold text-gray-700">Winner Splitting</div>
                                                <div className="text-xs text-gray-500">Winners split across teams</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-600">
                                                    {result.quality.winnerSplitting.count}/{result.quality.winnerSplitting.total}
                                                </span>
                                                <span className={`text-lg font-bold ${result.quality.winnerSplitting.percentage >= 75 ? 'text-emerald-600' : result.quality.winnerSplitting.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                    {result.quality.winnerSplitting.percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Partnership Variety */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="text-sm font-semibold text-gray-700">Partnership Variety</div>
                                                <div className="text-xs text-gray-500">Matches with fresh partnerships</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-600">
                                                    {result.quality.partnershipVariety.count}/{result.quality.partnershipVariety.total}
                                                </span>
                                                <span className={`text-lg font-bold ${result.quality.partnershipVariety.percentage >= 75 ? 'text-emerald-600' : result.quality.partnershipVariety.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                    {result.quality.partnershipVariety.percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
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
                                            
                                            const hasIssues = match.analytics.hadFatiguedPlayers.length > 0 || 
                                                             match.analytics.winnersWereSplit === false ||
                                                             match.analytics.repeatedPartnerships.length > 0;
                                            
                                            const isExpanded = expandedMatches.has(match.id);
                                            
                                            return (
                                                <div key={match.id} className={`rounded-lg border-2 ${hasIssues ? 'border-yellow-200 bg-yellow-50' : 'border-gray-100 bg-gray-50'}`}>
                                                    <div className="flex flex-col">
                                                        {/* Main match row */}
                                                        <div className="flex items-center justify-between p-3">
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <span className="font-bold text-gray-500 min-w-[2rem]">#{index + 1}</span>
                                                                <span className={match.winnerTeam === 1 ? "font-bold text-gray-900" : "text-gray-500"}>
                                                                    {getNames(match.team1)}
                                                                </span>
                                                            </div>
                                                            
                                                            <div className="px-4 font-mono font-bold text-lg text-gray-400">
                                                                {match.score1} - {match.score2}
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-3 flex-1 justify-between">
                                                                <span className={match.winnerTeam === 2 ? "font-bold text-gray-900" : "text-gray-500"}>
                                                                    {getNames(match.team2)}
                                                                </span>
                                                                <button
                                                                    onClick={() => toggleMatchExpanded(match.id)}
                                                                    className="text-gray-400 hover:text-gray-600"
                                                                >
                                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Badges */}
                                                        <div className="flex gap-2 px-3 pb-2 flex-wrap text-xs">
                                                            {match.analytics.hadFatiguedPlayers.length === 0 && (
                                                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-semibold">
                                                                    ✓ No Fatigue
                                                                </span>
                                                            )}
                                                            {match.analytics.hadFatiguedPlayers.length > 0 && (
                                                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded font-semibold">
                                                                    ⚠️ {match.analytics.hadFatiguedPlayers.length} Fatigued
                                                                </span>
                                                            )}
                                                            {match.analytics.winnersWereSplit === true && (
                                                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-semibold">
                                                                    ✓ Winners Split
                                                                </span>
                                                            )}
                                                            {match.analytics.winnersWereSplit === false && (
                                                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-semibold">
                                                                    ✗ Winners Together
                                                                </span>
                                                            )}
                                                            {match.analytics.repeatedPartnerships.length === 0 && (
                                                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-semibold">
                                                                    ✓ Fresh Partners
                                                                </span>
                                                            )}
                                                            {match.analytics.repeatedPartnerships.length > 0 && (
                                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-semibold">
                                                                    🔄 {match.analytics.repeatedPartnerships.length} Repeat
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Expandable details */}
                                                        {isExpanded && (
                                                            <div className="px-3 pb-3 pt-2 border-t border-gray-200 space-y-2 text-xs text-gray-600">
                                                                {match.analytics.hadFatiguedPlayers.length > 0 && (
                                                                    <div className="flex gap-2">
                                                                        <span className="font-semibold text-orange-700">⚠️ Fatigued:</span>
                                                                        <span>{match.analytics.hadFatiguedPlayers.map(id => result.players.find(p => p.id === id)?.name).join(', ')} played 2 consecutive games</span>
                                                                    </div>
                                                                )}
                                                                {match.analytics.winnersWereSplit === false && (
                                                                    <div className="flex gap-2">
                                                                        <span className="font-semibold text-red-700">✗ Winners:</span>
                                                                        <span>Previous winners remained on the same team</span>
                                                                    </div>
                                                                )}
                                                                {match.analytics.winnersWereSplit === true && (
                                                                    <div className="flex gap-2">
                                                                        <span className="font-semibold text-emerald-700">✓ Winners:</span>
                                                                        <span>Previous winners were successfully split</span>
                                                                    </div>
                                                                )}
                                                                {match.analytics.repeatedPartnerships.length > 0 && (
                                                                    <div className="flex gap-2">
                                                                        <span className="font-semibold text-yellow-700">🔄 Repeats:</span>
                                                                        <span>
                                                                            {match.analytics.repeatedPartnerships.map(partnership => {
                                                                                const name1 = result.players.find(p => p.id === partnership.player1)?.name || 'Unknown';
                                                                                const name2 = result.players.find(p => p.id === partnership.player2)?.name || 'Unknown';
                                                                                return `${name1} & ${name2}`;
                                                                            }).join(', ')} played together before
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
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
