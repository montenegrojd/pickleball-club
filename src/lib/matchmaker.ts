
import { Match, Player } from './types';

interface MatchProposal {
    team1: string[];
    team2: string[];
    reason: string;
    mainReason: string;
    scoringBreakdown: string[];
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
     */
    static proposeMatch(
        availablePlayerIds: string[],
        history: Match[],
        playerNames?: Map<string, string>
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
        
        // 3. Prioritize players who haven't played recently
        // Sort by: Not Fatigued > Longest bench time > Fewest games played
        const sortedPlayers = [...availablePlayerIds].sort((a, b) => {
            const aFatigued = playedTwoInARow.has(a);
            const bFatigued = playedTwoInARow.has(b);
            
            // Non-fatigued players go first
            if (aFatigued !== bFatigued) {
                return aFatigued ? 1 : -1;
            }

            const aStat = playerStats.get(a)!;
            const bStat = playerStats.get(b)!;

            // Prioritize players who sat out longer
            if (aStat.lastPlayedIndex !== bStat.lastPlayedIndex) {
                return bStat.lastPlayedIndex - aStat.lastPlayedIndex;
            }

            // Tie-breaker: Fewer games played overall
            return aStat.gamesPlayed - bStat.gamesPlayed;
        });

        const selectedPlayers = sortedPlayers.slice(0, 4);
        if (selectedPlayers.length < 4) return null;

        // 4. Get historical team pairings to avoid repeats
        const historicalTeams = this.getHistoricalTeams(history);

        // 5. Generate all possible team combinations from selected 4 players
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

        // 6. Score each configuration and select the best
        const scoredConfigs: Array<{ config: { team1: string[], team2: string[] }, score: number }> = [];

        configs.forEach(config => {
            let score = 0;

            const team1Key = this.normalizeTeam(config.team1[0], config.team1[1]);
            const team2Key = this.normalizeTeam(config.team2[0], config.team2[1]);

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

            scoredConfigs.push({ config, score });
        });

        // Sort by score (highest first) and select the best
        scoredConfigs.sort((a, b) => b.score - a.score);
        const bestConfig = scoredConfigs[0].config;

        const reasonData = this.generateReason(scoredConfigs, historicalTeams, playedTwoInARow, playerNames);

        return {
            team1: bestConfig.team1,
            team2: bestConfig.team2,
            reason: reasonData.combined,
            mainReason: reasonData.main,
            scoringBreakdown: reasonData.breakdown
        };
    }

    /**
     * Generate human-readable reason for the match proposal
     */
    private static generateReason(
        scoredConfigs: Array<{ config: { team1: string[], team2: string[] }, score: number }>,
        historicalTeams: Set<string>,
        fatigued: Set<string>,
        playerNames?: Map<string, string>
    ): { main: string; breakdown: string[]; combined: string } {
        const reasons: string[] = [];
        const bestConfig = scoredConfigs[0].config;

        const team1Key = this.normalizeTeam(bestConfig.team1[0], bestConfig.team1[1]);
        const team2Key = this.normalizeTeam(bestConfig.team2[0], bestConfig.team2[1]);

        const team1IsNew = !historicalTeams.has(team1Key);
        const team2IsNew = !historicalTeams.has(team2Key);

        if (team1IsNew && team2IsNew) {
            reasons.push("Fresh team pairings");
        } else if (team1IsNew || team2IsNew) {
            reasons.push("One new team pairing");
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
}

