
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
    // Scoring constants
    private static readonly REPEAT_PENALTY = -100;
    private static readonly WINNERS_SPLIT_BONUS = 200;
    private static readonly WINNERS_TOGETHER_PENALTY = -300;
    private static readonly UNUSED_PARTNERSHIP_BONUS = 150;
    private static readonly BOTH_TEAMS_UNUSED_BONUS = 300; // Extra bonus when both teams are fresh

    // Best Match weights: a match creates 2 partner pairs but 4 opponent pairs,
    // so partner repeats weigh double to keep both matrices on the same scale
    private static readonly BEST_MATCH_PARTNER_WEIGHT = 2;
    private static readonly BEST_MATCH_OPPONENT_WEIGHT = 1;

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
     * Helper: Identify players who played in the last 2 consecutive games (fatigued)
     */
    private static identifyFatiguedPlayers(history: Match[]): Set<string> {
        const fatigued = new Set<string>();
        
        const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
        const lastMatch = sortedHistory[0];
        const secondLastMatch = sortedHistory[1];

        if (lastMatch && secondLastMatch) {
            const lastPlayers = [...lastMatch.team1, ...lastMatch.team2];
            const secondLastPlayers = [...secondLastMatch.team1, ...secondLastMatch.team2];

            lastPlayers.forEach(id => {
                if (secondLastPlayers.includes(id)) {
                    fatigued.add(id);
                }
            });
        }

        return fatigued;
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
     * Helper: Get winners from the last match
     */
    private static getLastMatchWinners(history: Match[]): string[] | null {
        if (history.length === 0) return null;
        
        const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
        const lastMatch = sortedHistory[0];
        
        if (!lastMatch || !lastMatch.winnerTeam) return null;
        
        return lastMatch.winnerTeam === 1 ? lastMatch.team1 : lastMatch.team2;
    }

    /**
     * Helper: Generate all possible team configurations from 4 players
     */
    private static generateAllConfigurations(players: string[]): Array<{ team1: string[], team2: string[] }> {
        const [p1, p2, p3, p4] = players;
        return [
            { team1: [p1, p2], team2: [p3, p4] },
            { team1: [p1, p3], team2: [p2, p4] },
            { team1: [p1, p4], team2: [p2, p3] },
        ];
    }

    /**
     * Helper: Get normalized team keys for a configuration
     */
    private static getConfigurationTeamKeys(config: { team1: string[], team2: string[] }): { team1Key: string, team2Key: string } {
        return {
            team1Key: this.normalizeTeam(config.team1[0], config.team1[1]),
            team2Key: this.normalizeTeam(config.team2[0], config.team2[1])
        };
    }

    /**
     * Helper: Score a configuration
     */
    private static scoreConfiguration(
        config: { team1: string[], team2: string[] },
        historicalTeams: Set<string>,
        selectedPlayers: string[],
        winners: string[] | null
    ): number {
        let score = 0;
        const { team1Key, team2Key } = this.getConfigurationTeamKeys(config);

        // Penalize repeated partnerships
        if (historicalTeams.has(team1Key)) score += this.REPEAT_PENALTY;
        if (historicalTeams.has(team2Key)) score += this.REPEAT_PENALTY;

        // Bonus for unused partnerships
        if (!historicalTeams.has(team1Key)) score += this.UNUSED_PARTNERSHIP_BONUS;
        if (!historicalTeams.has(team2Key)) score += this.UNUSED_PARTNERSHIP_BONUS;
        
        // Extra bonus if both teams are fresh
        if (!historicalTeams.has(team1Key) && !historicalTeams.has(team2Key)) {
            score += this.BOTH_TEAMS_UNUSED_BONUS;
        }

        // Apply winner-splitting rule
        if (winners && winners.length === 2) {
            const winnersInSelection = winners.filter(w => selectedPlayers.includes(w));

            if (winnersInSelection.length === 2) {
                const winnersTeamKey = this.normalizeTeam(winnersInSelection[0], winnersInSelection[1]);
                
                if (team1Key !== winnersTeamKey && team2Key !== winnersTeamKey) {
                    score += this.WINNERS_SPLIT_BONUS;
                } else {
                    score += this.WINNERS_TOGETHER_PENALTY;
                }
            }
        }

        return score;
    }

    /**
     * Helper: Generate all possible 4-player combinations from available players
     */
    private static generateAllPlayerCombinations(playerIds: string[]): string[][] {
        const combinations: string[][] = [];
        const n = playerIds.length;
        
        // Generate all C(n, 4) combinations
        for (let i = 0; i < n - 3; i++) {
            for (let j = i + 1; j < n - 2; j++) {
                for (let k = j + 1; k < n - 1; k++) {
                    for (let l = k + 1; l < n; l++) {
                        combinations.push([playerIds[i], playerIds[j], playerIds[k], playerIds[l]]);
                    }
                }
            }
        }
        
        return combinations;
    }

    /**
     * Helper: Check if a 4-player combination has potential for fresh partnerships
     * Returns true if at least one of the 3 possible team configurations would have a fresh partnership
     */
    private static combinationHasFreshPotential(
        combo: string[],
        historicalTeams: Set<string>
    ): boolean {
        const configs = this.generateAllConfigurations(combo);
        
        // Check if any configuration has at least one fresh partnership
        return configs.some(config => {
            const { team1Key, team2Key } = this.getConfigurationTeamKeys(config);
            return !historicalTeams.has(team1Key) || !historicalTeams.has(team2Key);
        });
    }

    /**
     * Helper: Score a 4-player combination based on fairness metrics
     * Higher score = fairer combination
     */
    private static scoreCombination(
        combo: string[],
        fatigued: Set<string>,
        playerStats: Map<string, PlayerStats>
    ): { score: number; breakdown: { fatigueCount: number; totalWaitTime: number; totalGames: number } } {
        // Count fatigued players (fewer is better)
        const fatigueCount = combo.filter(id => fatigued.has(id)).length;
        
        // Sum of wait times (higher is better - players who waited longer)
        const totalWaitTime = combo.reduce((sum, id) => {
            const stat = playerStats.get(id);
            return sum + (stat?.lastPlayedIndex ?? 0);
        }, 0);
        
        // Sum of games played (lower is better - balance game counts)
        const totalGames = combo.reduce((sum, id) => {
            const stat = playerStats.get(id);
            return sum + (stat?.gamesPlayed ?? 0);
        }, 0);
        
        // Calculate composite score
        // Prioritize: no fatigue > long wait > few games
        const score = 
            (4 - fatigueCount) * 1000 +  // Very high weight for avoiding fatigue
            totalWaitTime * 100 -         // High weight for wait time
            totalGames * 10;              // Lower weight for game balance
        
        return {
            score,
            breakdown: { fatigueCount, totalWaitTime, totalGames }
        };
    }

    /**
     * Helper: Select best 4-player combination
     * Prioritizes combinations with fresh partnership potential, then fairness
     */
    private static selectBestCombination(
        availablePlayerIds: string[],
        fatigued: Set<string>,
        playerStats: Map<string, PlayerStats>,
        historicalTeams: Set<string>
    ): string[] | null {
        // If exactly 4 players, no choice
        if (availablePlayerIds.length === 4) {
            return availablePlayerIds;
        }
        
        // Generate all possible 4-player combinations
        const allCombinations = this.generateAllPlayerCombinations(availablePlayerIds);
        
        // Filter out combinations with fatigued players if non-fatigued options exist
        const nonFatiguedCombinations = allCombinations.filter(combo =>
            combo.every(playerId => !fatigued.has(playerId))
        );
        
        // Use non-fatigued combinations if available, otherwise use all combinations
        const candidatesByFatigue = nonFatiguedCombinations.length > 0 ? nonFatiguedCombinations : allCombinations;
        
        // Filter to combinations with fresh partnership potential
        const freshCombinations = candidatesByFatigue.filter(combo => 
            this.combinationHasFreshPotential(combo, historicalTeams)
        );
        
        // Use fresh combinations if available, otherwise use all fatigue-filtered combinations
        const candidateCombinations = freshCombinations.length > 0 ? freshCombinations : candidatesByFatigue;
        
        // Score all candidate combinations
        const scoredCombinations = candidateCombinations.map(combo => ({
            combo,
            ...this.scoreCombination(combo, fatigued, playerStats)
        }));
        
        // Sort by score (highest first)
        scoredCombinations.sort((a, b) => b.score - a.score);
        
        // Return best combination
        return scoredCombinations.length > 0 ? scoredCombinations[0].combo : null;
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

        // 1. Gather context
        const fatigued = this.identifyFatiguedPlayers(history);
        const playerStats = this.calculatePlayerStats(availablePlayerIds, history);
        const historicalTeams = this.getHistoricalTeams(history);
        const winners = this.getLastMatchWinners(history);

        // 2. Select best 4-player combination (prioritizes fresh partnerships + fairness)
        const selectedPlayers = this.selectBestCombination(availablePlayerIds, fatigued, playerStats, historicalTeams);

        if (!selectedPlayers || selectedPlayers.length < 4) return null;

        // 3. Generate all possible team configurations
        const configs = this.generateAllConfigurations(selectedPlayers);

        // 4. Score each configuration
        const scoredConfigs = configs.map(config => ({
            config,
            score: this.scoreConfiguration(config, historicalTeams, selectedPlayers, winners)
        }));

        // 5. Select best configuration
        scoredConfigs.sort((a, b) => b.score - a.score);
        const bestConfig = scoredConfigs[0].config;

        // 6. Generate reason and analytics
        const reasonData = this.generateReason(scoredConfigs, historicalTeams, fatigued, playerNames);
        const analytics = this.generateAnalytics(history, bestConfig, selectedPlayers, historicalTeams, fatigued);

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
        fatigued: Set<string>
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

    /**
     * Strict Rotation matchmaking algorithm
     * Always picks the 4 players who have waited longest (by lastPlayedIndex).
     * Team formation uses the same partnership scoring as the regular mode.
     */
    static proposeStrictRotation(
        availablePlayerIds: string[],
        history: Match[],
        playerNames?: Map<string, string>
    ): MatchProposal | null {
        if (availablePlayerIds.length < 4) return null;

        const fatigued = this.identifyFatiguedPlayers(history);
        const playerStats = this.calculatePlayerStats(availablePlayerIds, history);
        const historicalTeams = this.getHistoricalTeams(history);
        const winners = this.getLastMatchWinners(history);

        // Sort by longest wait (Infinity = never played, so they go first)
        // Ties broken by fewest games played
        const sorted = [...availablePlayerIds].sort((a, b) => {
            const sa = playerStats.get(a)!;
            const sb = playerStats.get(b)!;
            if (sb.lastPlayedIndex !== sa.lastPlayedIndex) {
                return sb.lastPlayedIndex - sa.lastPlayedIndex; // higher index = waited longer
            }
            return sa.gamesPlayed - sb.gamesPlayed; // fewer games = higher priority
        });

        const selectedPlayers = sorted.slice(0, 4);

        // Team formation: same scoring as regular mode
        const configs = this.generateAllConfigurations(selectedPlayers);
        const scoredConfigs = configs.map(config => ({
            config,
            score: this.scoreConfiguration(config, historicalTeams, selectedPlayers, winners)
        }));
        scoredConfigs.sort((a, b) => b.score - a.score);
        const bestConfig = scoredConfigs[0].config;

        const reasonData = this.generateReason(scoredConfigs, historicalTeams, fatigued, playerNames);
        const analytics = this.generateAnalytics(history, bestConfig, selectedPlayers, historicalTeams, fatigued);

        return {
            team1: bestConfig.team1,
            team2: bestConfig.team2,
            reason: "Strict queue rotation. " + reasonData.combined,
            mainReason: "Strict queue: longest-waiting players selected.",
            scoringBreakdown: reasonData.breakdown,
            analytics
        };
    }

    /**
     * Helper: Count how many times each pair of players has been teammates and opponents.
     * Includes matches still in progress, so a match on another court is taken into account.
     */
    private static buildMatchupCounts(history: Match[]): { partners: Map<string, number>, opponents: Map<string, number> } {
        const partners = new Map<string, number>();
        const opponents = new Map<string, number>();
        const bump = (counts: Map<string, number>, a: string, b: string) => {
            const key = this.normalizeTeam(a, b);
            counts.set(key, (counts.get(key) || 0) + 1);
        };

        history.forEach(match => {
            if (match.team1.length === 2) bump(partners, match.team1[0], match.team1[1]);
            if (match.team2.length === 2) bump(partners, match.team2[0], match.team2[1]);
            match.team1.forEach(a => match.team2.forEach(b => bump(opponents, a, b)));
        });

        return { partners, opponents };
    }

    /**
     * Helper: Identify players who played their last 2 matches back-to-back and would
     * now play a third without rest. Works with multiple courts: a new match on a court
     * means the previous match there finished, so a player rested if a match started
     * on the court they left without them.
     */
    private static identifyBackToBackPlayers(playerIds: string[], history: Match[]): Set<string> {
        const fatigued = new Set<string>();
        const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
        const courtOf = (match: Match) => match.courtNumber ?? 0;
        const nextOnCourt = (match: Match) =>
            sortedHistory.find(m => m.timestamp > match.timestamp && courtOf(m) === courtOf(match));

        playerIds.forEach(id => {
            const played = sortedHistory.filter(m => m.team1.includes(id) || m.team2.includes(id));
            if (played.length < 2) return;
            const previous = played[played.length - 2];
            const last = played[played.length - 1];

            // No match started on previous's court before last (no rest in between),
            // and nothing has started on last's court since (no rest after)
            const afterPrevious = nextOnCourt(previous);
            const restedBetween = afterPrevious !== undefined && afterPrevious !== last && afterPrevious.timestamp < last.timestamp;
            if (!restedBetween && !nextOnCourt(last)) {
                fatigued.add(id);
            }
        });

        return fatigued;
    }

    /**
     * Helper: Games credited to late arrivals. When a player plays their first match,
     * they are credited one game less than the player with the fewest games so far,
     * so from then on they rotate like everyone else.
     */
    private static getLateArrivalCredits(history: Match[]): Map<string, number> {
        const credits = new Map<string, number>();
        const games = new Map<string, number>(); // Games played plus credit
        const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

        sortedHistory.forEach(match => {
            const matchPlayers = [...match.team1, ...match.team2];
            const fewestGames = games.size > 0 ? Math.min(...games.values()) : 0;

            matchPlayers.forEach(id => {
                if (games.has(id)) return;
                const credit = Math.max(0, fewestGames - 1);
                credits.set(id, credit);
                games.set(id, credit); // Credited games count for later arrivals too
            });
            matchPlayers.forEach(id => games.set(id, (games.get(id) ?? 0) + 1));
        });

        return credits;
    }

    /**
     * Helper: Repetition cost of a configuration (lower is better).
     * Each pairing adds 2*count+1 — the increase of that pairing's squared count —
     * so pairings that already repeat a lot are penalized the most.
     */
    private static scoreRepetitionCost(
        config: { team1: string[], team2: string[] },
        counts: { partners: Map<string, number>, opponents: Map<string, number> }
    ): { cost: number; partnerRepeats: number; opponentRepeats: number } {
        const partnerCounts = [
            counts.partners.get(this.normalizeTeam(config.team1[0], config.team1[1])) || 0,
            counts.partners.get(this.normalizeTeam(config.team2[0], config.team2[1])) || 0,
        ];
        const opponentCounts = config.team1.flatMap(a =>
            config.team2.map(b => counts.opponents.get(this.normalizeTeam(a, b)) || 0)
        );

        const pairCost = (values: number[]) => values.reduce((sum, c) => sum + 2 * c + 1, 0);
        const sum = (values: number[]) => values.reduce((total, c) => total + c, 0);

        return {
            cost: this.BEST_MATCH_PARTNER_WEIGHT * pairCost(partnerCounts) +
                this.BEST_MATCH_OPPONENT_WEIGHT * pairCost(opponentCounts),
            partnerRepeats: sum(partnerCounts),
            opponentRepeats: sum(opponentCounts),
        };
    }

    /**
     * Best Match matchmaking algorithm
     * Keeps court time fair (rested players first, fewest games played), then picks the
     * 4 players and team split that least repeat previous teammate and opponent pairings.
     * Works one court at a time: players in active matches are excluded by the caller,
     * and those active matches still count as history.
     */
    static proposeBestMatch(
        availablePlayerIds: string[],
        history: Match[],
        playerNames?: Map<string, string>
    ): MatchProposal | null {
        if (availablePlayerIds.length < 4) return null;

        const fatigued = this.identifyBackToBackPlayers(availablePlayerIds, history);
        const playerStats = this.calculatePlayerStats(availablePlayerIds, history);
        const historicalTeams = this.getHistoricalTeams(history);
        const counts = this.buildMatchupCounts(history);

        // 1. Who plays: as few fatigued players as possible, then keep only the
        //    combinations with the fewest games played so nobody is left on the bench
        const allCombinations = this.generateAllPlayerCombinations(availablePlayerIds);
        const fatigueOf = (combo: string[]) => combo.filter(id => fatigued.has(id)).length;
        const minFatigue = Math.min(...allCombinations.map(fatigueOf));
        const candidatesByFatigue = allCombinations.filter(combo => fatigueOf(combo) === minFatigue);

        // Late arrivals are credited the games they missed (see getLateArrivalCredits),
        // so they get priority for one match instead of playing every match to catch up
        const credits = this.getLateArrivalCredits(history);
        const effectiveGames = (id: string) => (playerStats.get(id)?.gamesPlayed ?? 0) + (credits.get(id) ?? 0);
        const gamesOf = (combo: string[]) => combo.reduce((sum, id) => sum + effectiveGames(id), 0);
        const minGames = Math.min(...candidatesByFatigue.map(gamesOf));
        const candidates = candidatesByFatigue.filter(combo => gamesOf(combo) === minGames);

        // 2. Score every team split of every candidate by repetition cost
        //    Ties go to the players who have waited longest
        const waitOf = (combo: string[]) =>
            combo.reduce((sum, id) => sum + Math.min(playerStats.get(id)?.lastPlayedIndex ?? 0, history.length), 0);

        const scoredConfigs = candidates.flatMap(combo => {
            const wait = waitOf(combo);
            return this.generateAllConfigurations(combo).map(config => ({
                config,
                wait,
                ...this.scoreRepetitionCost(config, counts),
            }));
        });
        scoredConfigs.sort((a, b) => a.cost - b.cost || b.wait - a.wait);

        const best = scoredConfigs[0];
        const selectedPlayers = [...best.config.team1, ...best.config.team2];

        // 3. Explain the choice
        const getName = (id: string) => playerNames?.get(id) || id;
        const mainReason = best.partnerRepeats === 0 && best.opponentRepeats === 0
            ? "Best match: all-new teammates and opponents."
            : `Best match: least repeated pairings (${best.partnerRepeats} previous as teammates, ${best.opponentRepeats} as opponents).`;
        const breakdown = scoredConfigs.slice(0, 3).map(({ config, cost, partnerRepeats, opponentRepeats }) =>
            `[${config.team1.map(getName).join(",")}] vs [${config.team2.map(getName).join(",")}]: cost ${cost} (teammates ${partnerRepeats}, opponents ${opponentRepeats})`
        );

        return {
            team1: best.config.team1,
            team2: best.config.team2,
            reason: `${mainReason} Lowest costs: ${breakdown.join(" | ")}`,
            mainReason,
            scoringBreakdown: breakdown,
            analytics: this.generateAnalytics(history, best.config, selectedPlayers, historicalTeams, fatigued)
        };
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

