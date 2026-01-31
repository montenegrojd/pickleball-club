
import { Match, Player } from './types';

interface MatchAnalytics {
    hadFatiguedPlayers: string[];
    winnersWereSplit: boolean | null;
    repeatedPartnerships: Array<{ player1: string, player2: string }>;
    keptWinners: boolean;
}

interface MatchProposal {
    team1: string[];
    team2: string[];
    reason: string;
    mainReason: string;
    scoringBreakdown: string[];
    analytics?: MatchAnalytics;
}

interface PlayerStats {
    playerId: string;
    gamesPlayed: number;
    lastPlayedIndex: number; // Lower number = more recent (0 = last game)
}

export class Matchmaker {
    /**
     * Helper: Normalize team pairing to consistent string for comparison
     * Always sorts player IDs so [p1, p2] and [p2, p1] are treated as same team
     */
    private static normalizeTeam(player1: string, player2: string): string {
        return [player1, player2].sort().join('-');
    }

    /**
     * Helper: Get all team pairings that have played together in history
     */
    private static getHistoricalTeams(history: Match[]): Set<string> {
        const teams = new Set<string>();
        history.forEach(match => {
            if (match.team1.length === 2) {
                teams.add(this.normalizeTeam(match.team1[0], match.team1[1]));
            }
            if (match.team2.length === 2) {
                teams.add(this.normalizeTeam(match.team2[0], match.team2[1]));
            }
        });
        return teams;
    }

    /**
     * Helper: Calculate player stats for prioritization
     */
    private static calculatePlayerStats(
        availablePlayerIds: string[],
        history: Match[]
    ): Map<string, PlayerStats> {
        const stats = new Map<string, PlayerStats>();
        
        // Initialize all available players
        availablePlayerIds.forEach(id => {
            stats.set(id, {
                playerId: id,
                gamesPlayed: 0,
                lastPlayedIndex: Infinity, // Never played
            });
        });

        // Sort history by timestamp (most recent first)
        const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);

        // Track when each player last played
        sortedHistory.forEach((match, index) => {
            const allPlayers = [...match.team1, ...match.team2];
            allPlayers.forEach(playerId => {
                const stat = stats.get(playerId);
                if (stat) {
                    stat.gamesPlayed++;
                    // Only set lastPlayedIndex if this is the most recent game for this player
                    if (stat.lastPlayedIndex === Infinity) {
                        stat.lastPlayedIndex = index;
                    }
                }
            });
        });

        return stats;
    }

    /**
     * Main matchmaking algorithm
     * @param mode - 'rotation' for balanced play, 'strict-partners' to avoid partner repetition
     */
    static proposeMatch(
        availablePlayerIds: string[],
        history: Match[],
        playerNames?: Map<string, string>,
        mode: 'rotation' | 'strict-partners' = 'rotation'
    ): MatchProposal | null {
        if (availablePlayerIds.length < 4) return null;

        const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
        const lastMatch = sortedHistory[0];
        const secondLastMatch = sortedHistory[1];

        // 1. Identify fatigued players (played last 2 consecutive games)
        const playedTwoInARow = new Set<string>();
        if (lastMatch && secondLastMatch) {
            const lastPlayers = [...lastMatch.team1, ...lastMatch.team2];
            const secondLastPlayers = [...secondLastMatch.team1, ...secondLastMatch.team2];

            lastPlayers.forEach(id => {
                if (secondLastPlayers.includes(id)) {
                    playedTwoInARow.add(id);
                }
            });
        }

        // 2. Calculate player stats for smart selection
        const playerStats = this.calculatePlayerStats(availablePlayerIds, history);
        
        // 3. Get historical team pairings to check for repeats
        const historicalTeams = this.getHistoricalTeams(history);
        
        // 4. For strict-partners mode: Try to keep winners on court if it doesn't create repeated partnerships
        let selectedPlayers: string[];
        
        if (mode === 'strict-partners' && lastMatch && lastMatch.winnerTeam) {
            const winners = lastMatch.winnerTeam === 1 ? lastMatch.team1 : lastMatch.team2;
            const availableWinners = winners.filter(w => availablePlayerIds.includes(w) && !playedTwoInARow.has(w));
            
            if (availableWinners.length === 2) {
                // Both winners are available and not fatigued
                // Select 2 more players using rotation logic
                const otherPlayers = availablePlayerIds
                    .filter(id => !availableWinners.includes(id))
                    .sort((a, b) => {
                        const aFatigued = playedTwoInARow.has(a);
                        const bFatigued = playedTwoInARow.has(b);
                        
                        if (aFatigued !== bFatigued) {
                            return aFatigued ? 1 : -1;
                        }

                        const aStat = playerStats.get(a)!;
                        const bStat = playerStats.get(b)!;

                        if (aStat.lastPlayedIndex !== bStat.lastPlayedIndex) {
                            return bStat.lastPlayedIndex - aStat.lastPlayedIndex;
                        }

                        return aStat.gamesPlayed - bStat.gamesPlayed;
                    });
                
                const candidateWithWinners = [...availableWinners, ...otherPlayers.slice(0, 2)];
                
                // Check if any configuration with winners would avoid all repeated partnerships
                const [w1, w2, p1, p2] = candidateWithWinners;
                const testConfigs = [
                    { team1: [w1, w2], team2: [p1, p2] },
                    { team1: [w1, p1], team2: [w2, p2] },
                    { team1: [w1, p2], team2: [w2, p1] },
                ];
                
                const hasFreshConfig = testConfigs.some(config => {
                    const team1Key = this.normalizeTeam(config.team1[0], config.team1[1]);
                    const team2Key = this.normalizeTeam(config.team2[0], config.team2[1]);
                    return !historicalTeams.has(team1Key) && !historicalTeams.has(team2Key);
                });
                
                if (hasFreshConfig) {
                    // Keep winners - at least one config has both teams fresh
                    selectedPlayers = candidateWithWinners;
                } else {
                    // Would create repeated partnerships - use standard rotation instead
                    selectedPlayers = [...availablePlayerIds].sort((a, b) => {
                        const aFatigued = playedTwoInARow.has(a);
                        const bFatigued = playedTwoInARow.has(b);
                        
                        if (aFatigued !== bFatigued) {
                            return aFatigued ? 1 : -1;
                        }

                        const aStat = playerStats.get(a)!;
                        const bStat = playerStats.get(b)!;

                        if (aStat.lastPlayedIndex !== bStat.lastPlayedIndex) {
                            return bStat.lastPlayedIndex - aStat.lastPlayedIndex;
                        }

                        return aStat.gamesPlayed - bStat.gamesPlayed;
                    }).slice(0, 4);
                }
            } else {
                // Not all winners available or some are fatigued, use standard rotation
                selectedPlayers = [...availablePlayerIds].sort((a, b) => {
                    const aFatigued = playedTwoInARow.has(a);
                    const bFatigued = playedTwoInARow.has(b);
                    
                    if (aFatigued !== bFatigued) {
                        return aFatigued ? 1 : -1;
                    }

                    const aStat = playerStats.get(a)!;
                    const bStat = playerStats.get(b)!;

                    if (aStat.lastPlayedIndex !== bStat.lastPlayedIndex) {
                        return bStat.lastPlayedIndex - aStat.lastPlayedIndex;
                    }

                    return aStat.gamesPlayed - bStat.gamesPlayed;
                }).slice(0, 4);
            }
        } else {
            // Rotation mode or no winners to prioritize: standard player selection
            // Sort by: Not Fatigued > Longest bench time > Fewest games played
            selectedPlayers = [...availablePlayerIds].sort((a, b) => {
                const aFatigued = playedTwoInARow.has(a);
                const bFatigued = playedTwoInARow.has(b);
                
                if (aFatigued !== bFatigued) {
                    return aFatigued ? 1 : -1;
                }

                const aStat = playerStats.get(a)!;
                const bStat = playerStats.get(b)!;

                if (aStat.lastPlayedIndex !== bStat.lastPlayedIndex) {
                    return bStat.lastPlayedIndex - aStat.lastPlayedIndex;
                }

                return aStat.gamesPlayed - bStat.gamesPlayed;
            }).slice(0, 4);
        }

        if (selectedPlayers.length < 4) return null;

        // 6. Generate all possible team combinations from selected 4 players
        const [p1, p2, p3, p4] = selectedPlayers;
        
        // All possible team configurations:
        // Config 1: [p1,p2] vs [p3,p4]
        // Config 2: [p1,p3] vs [p2,p4]
        // Config 3: [p1,p4] vs [p2,p3]
        const configs = [
            { team1: [p1, p2], team2: [p3, p4] },
            { team1: [p1, p3], team2: [p2, p4] },
            { team1: [p1, p4], team2: [p2, p3] },
        ];

        // 7. Score each configuration and select the best
        const scoredConfigs: Array<{ config: { team1: string[], team2: string[] }, score: number }> = [];

        configs.forEach(config => {
            let score = 0;

            const team1Key = this.normalizeTeam(config.team1[0], config.team1[1]);
            const team2Key = this.normalizeTeam(config.team2[0], config.team2[1]);

            if (mode === 'strict-partners') {
                // STRICT-PARTNERS MODE: Partner variety is the top priority
                // Heavy penalty for any repeated partnership
                if (historicalTeams.has(team1Key)) score -= 1000;
                if (historicalTeams.has(team2Key)) score -= 1000;

                // Winner-splitting is applied but with lower priority than partner variety
                if (lastMatch && lastMatch.winnerTeam) {
                    const winners = lastMatch.winnerTeam === 1 ? lastMatch.team1 : lastMatch.team2;
                    const winnersInSelection = winners.filter(w => selectedPlayers.includes(w));

                    if (winnersInSelection.length === 2) {
                        const winnersTeamKey = this.normalizeTeam(winnersInSelection[0], winnersInSelection[1]);
                        
                        // Reward splitting the winners (but less than partner variety penalty)
                        if (team1Key !== winnersTeamKey && team2Key !== winnersTeamKey) {
                            score += 50; // Winners are split (lower priority)
                        } else {
                            score -= 75; // Winners together (mild penalty)
                        }
                    }
                }
            } else {
                // ROTATION MODE: Current balanced approach
                // Heavily penalize if teams have played together before
                if (historicalTeams.has(team1Key)) score -= 100;
                if (historicalTeams.has(team2Key)) score -= 100;

                // Apply winner-splitting rule: if last match had winners, they should be split
                if (lastMatch && lastMatch.winnerTeam) {
                    const winners = lastMatch.winnerTeam === 1 ? lastMatch.team1 : lastMatch.team2;
                    const winnersInSelection = winners.filter(w => selectedPlayers.includes(w));

                    if (winnersInSelection.length === 2) {
                        const winnersTeamKey = this.normalizeTeam(winnersInSelection[0], winnersInSelection[1]);
                        
                        // Heavily reward splitting the winners
                        if (team1Key !== winnersTeamKey && team2Key !== winnersTeamKey) {
                            score += 200; // Winners are split
                        } else {
                            score -= 300; // Winners are together again (bad!)
                        }
                    }
                }
            }

            scoredConfigs.push({ config, score });
        });

        // Sort by score (highest first) and select the best
        scoredConfigs.sort((a, b) => b.score - a.score);
        const bestConfig = scoredConfigs[0].config;

        const reasonData = this.generateReason(scoredConfigs, historicalTeams, playedTwoInARow, playerNames, mode);
        
        // Generate analytics for the selected match
        const analytics = this.generateAnalytics(
            history,
            bestConfig,
            selectedPlayers,
            historicalTeams,
            playedTwoInARow,
            mode
        );

        return {
            team1: bestConfig.team1,
            team2: bestConfig.team2,
            reason: reasonData.combined,
            mainReason: reasonData.main,
            scoringBreakdown: reasonData.breakdown,
            analytics
        };
    }

    /**
     * Generate analytics for the proposed match
     */
    private static generateAnalytics(
        history: Match[],
        proposal: { team1: string[], team2: string[] },
        selectedPlayers: string[],
        historicalTeams: Set<string>,
        fatigued: Set<string>,
        mode: 'rotation' | 'strict-partners' = 'rotation'
    ): MatchAnalytics {
        const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
        const lastMatch = sortedHistory[0];

        // Check for fatigued players in the selected 4
        const hadFatiguedPlayers = selectedPlayers.filter(id => fatigued.has(id));

        // Check if winners were split
        let winnersWereSplit: boolean | null = null;
        let keptWinners = false;
        if (lastMatch && lastMatch.winnerTeam) {
            const winners = lastMatch.winnerTeam === 1 ? lastMatch.team1 : lastMatch.team2;
            const winnersInSelection = winners.filter(w => selectedPlayers.includes(w));
            
            if (winnersInSelection.length === 2) {
                const winnersKey = this.normalizeTeam(winnersInSelection[0], winnersInSelection[1]);
                const team1Key = this.normalizeTeam(proposal.team1[0], proposal.team1[1]);
                const team2Key = this.normalizeTeam(proposal.team2[0], proposal.team2[1]);
                winnersWereSplit = (team1Key !== winnersKey && team2Key !== winnersKey);
                keptWinners = true;
            }
        }

        // Check for repeated partnerships
        const repeatedPartnerships: Array<{ player1: string, player2: string }> = [];
        const team1Key = this.normalizeTeam(proposal.team1[0], proposal.team1[1]);
        const team2Key = this.normalizeTeam(proposal.team2[0], proposal.team2[1]);
        
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
            keptWinners
        };
    }

    /**
     * Generate human-readable reason for the match proposal
     */
    private static generateReason(
        scoredConfigs: Array<{ config: { team1: string[], team2: string[] }, score: number }>,
        historicalTeams: Set<string>,
        fatigued: Set<string>,
        playerNames?: Map<string, string>,
        mode: 'rotation' | 'strict-partners' = 'rotation'
    ): { main: string; breakdown: string[]; combined: string } {
        const reasons: string[] = [];
        const bestConfig = scoredConfigs[0].config;

        const team1Key = this.normalizeTeam(bestConfig.team1[0], bestConfig.team1[1]);
        const team2Key = this.normalizeTeam(bestConfig.team2[0], bestConfig.team2[1]);

        const team1IsNew = !historicalTeams.has(team1Key);
        const team2IsNew = !historicalTeams.has(team2Key);

        if (team1IsNew && team2IsNew) {
            reasons.push(mode === 'strict-partners' ? "Fresh partnerships" : "Fresh team pairings");
        } else if (team1IsNew || team2IsNew) {
            reasons.push(mode === 'strict-partners' ? "One new partnership" : "One new team pairing");
        } else if (mode === 'strict-partners') {
            reasons.push("Best partnership variety available");
        }

        const allPlayers = [...bestConfig.team1, ...bestConfig.team2];
        const fatigueCount = allPlayers.filter(p => fatigued.has(p)).length;
        
        if (fatigueCount === 0) {
            reasons.push("all players well-rested");
        } else if (fatigueCount < 4) {
            reasons.push(`${4 - fatigueCount} rested players`);
        }

        const mainReason = reasons.length > 0 
            ? reasons.join(", ") + "."
            : "Best available match based on rotation rules.";

        // Helper to get display name
        const getName = (id: string) => playerNames?.get(id) || id;

        // Add scoring breakdown as separate array
        const breakdown = scoredConfigs.map((sc, idx) => {
            const { config, score } = sc;
            const team1Display = config.team1.map(getName).join(",");
            const team2Display = config.team2.map(getName).join(",");
            return `[${team1Display}] vs [${team2Display}]: ${score > 0 ? '+' : ''}${score}`;
        });

        const combined = `${mainReason} Scores: ${breakdown.join(" | ")}`;

        return { main: mainReason, breakdown, combined };
    }

    /**
     * Playoff/Tournament matchmaking algorithm
     * Seeds players by performance (points, wins) and creates competitive matchups:
     * #1 vs #4 and #2 vs #3
     */
    static proposePlayoffMatch(
        availablePlayerIds: string[],
        history: Match[],
        playerStats: Player[],
        playerNames?: Map<string, string>
    ): MatchProposal | null {
        if (availablePlayerIds.length < 4) return null;

        // Filter stats to only available players and sort by ranking
        const availableStats = playerStats
            .filter(p => availablePlayerIds.includes(p.id))
            .sort((a, b) => {
                // Primary: Win percentage (for players with matches)
                const aWinPct = a.matchesPlayed > 0 ? a.matchesWon / a.matchesPlayed : 0;
                const bWinPct = b.matchesPlayed > 0 ? b.matchesWon / b.matchesPlayed : 0;
                if (aWinPct !== bWinPct) return bWinPct - aWinPct;

                // Secondary: Total wins
                if (a.matchesWon !== b.matchesWon) return b.matchesWon - a.matchesWon;

                // Tertiary: Points scored
                const aPoints = a.pointsScored || 0;
                const bPoints = b.pointsScored || 0;
                if (aPoints !== bPoints) return bPoints - aPoints;

                // Quaternary: Points per game
                const aPPG = a.matchesPlayed > 0 ? aPoints / a.matchesPlayed : 0;
                const bPPG = b.matchesPlayed > 0 ? bPoints / b.matchesPlayed : 0;
                return bPPG - aPPG;
            });

        if (availableStats.length < 4) return null;

        // Seed top 4 players
        const seed1 = availableStats[0].id;
        const seed2 = availableStats[1].id;
        const seed3 = availableStats[2].id;
        const seed4 = availableStats[3].id;

        // Create matchup: #1 vs #4, #2 vs #3
        const team1 = [seed1, seed4];
        const team2 = [seed2, seed3];

        // Generate reason
        const getName = (id: string) => playerNames?.get(id) || id;
        const getRank = (id: string) => {
            const idx = availableStats.findIndex(s => s.id === id);
            return `#${idx + 1}`;
        };

        const team1Display = team1.map(id => `${getName(id)} ${getRank(id)}`).join(" & ");
        const team2Display = team2.map(id => `${getName(id)} ${getRank(id)}`).join(" & ");

        const mainReason = "Playoff Match: Top seeds face off";
        const breakdown = [
            `Team 1: ${team1Display}`,
            `Team 2: ${team2Display}`,
            `Seeding: #1 & #4 vs #2 & #3`
        ];
        const combined = `${mainReason}. ${breakdown.join(" | ")}`;

        return {
            team1,
            team2,
            reason: combined,
            mainReason,
            scoringBreakdown: breakdown
        };
    }
}

