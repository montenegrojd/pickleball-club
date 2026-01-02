
import { Match, Player } from './types';

interface MatchProposal {
    team1: string[];
    team2: string[];
    reason: string;
}

export class Matchmaker {
    static proposeMatch(
        availablePlayerIds: string[],
        history: Match[]
    ): MatchProposal | null {
        if (availablePlayerIds.length < 4) return null;

        // 1. Identify Fatigued Players (played last 2 games consecutively)
        const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
        const lastMatch = sortedHistory[0];
        const secondLastMatch = sortedHistory[1];

        const playedLastGame = new Set<string>();
        if (lastMatch) {
            [...lastMatch.team1, ...lastMatch.team2].forEach(p => playedLastGame.add(p));
        }

        const playedTwoInARow = new Set<string>();
        if (lastMatch && secondLastMatch) {
            const p1 = [...lastMatch.team1, ...lastMatch.team2];
            const p2 = [...secondLastMatch.team1, ...secondLastMatch.team2];

            p1.forEach(id => {
                if (p2.includes(id)) playedTwoInARow.add(id);
            });
        }

        // 2. Select 4 Players
        // Prioritize: Not Fatigued > Least Games Played > Random
        // We don't have "Games Played Today" passed in easily, but we can infer or simpler:
        // Just prioritize avoiding "Two In A Row".

        let candidates = availablePlayerIds.filter(id => !playedTwoInARow.has(id));

        // Fallback: If not enough non-fatigued players, add back fatigued ones (sorted by something? random for now)
        if (candidates.length < 4) {
            const fatigueList = availablePlayerIds.filter(id => playedTwoInARow.has(id));
            // Shuffle fatigue list to be fair?
            candidates = [...candidates, ...fatigueList];
        }

        // Take top 4
        // Ideally calculate who sat out longest?
        // For now, simple logic: Just take the first 4 from the candidates logic.
        // IMPROVEMENT: Sort candidates by "Consecutive matches missed" (Bench time). 
        // But we need to track that state. 
        // Let's rely on basic "Available" list order if the partial shuffle happens outside, 
        // or just assume "availablePlayerIds" is the full roster checked in.

        // Better Selection Logic:
        // a. Must include those who sat out last game? 
        // b. Exclude fatigued (2 in a row).
        // c. Fill remainder with those who played 1 game recently.

        const selectedPlayers = candidates.slice(0, 4);

        if (selectedPlayers.length < 4) return null; // Should be handled above

        // 3. Team Formatting (Winners Split)
        const p1 = selectedPlayers[0];
        const p2 = selectedPlayers[1];
        const p3 = selectedPlayers[2];
        const p4 = selectedPlayers[3];

        // Check if any pair was a winning team in the last match
        let team1 = [p1, p2];
        let team2 = [p3, p4];

        if (lastMatch && lastMatch.winnerTeam) {
            const winners = lastMatch.winnerTeam === 1 ? lastMatch.team1 : lastMatch.team2;
            // If the winners are both in our selected group
            const winnersInSelection = winners.filter(w => selectedPlayers.includes(w));

            if (winnersInSelection.length === 2) {
                // We have both winners playing again. Ensure they are split.
                // Current Proposal: Team A=[p1,p2], Team B=[p3,p4]
                // If winners are p1 and p2, we must split them.
                const [w1, w2] = winnersInSelection;

                // Find non-winners
                const nonWinners = selectedPlayers.filter(p => !winnersInSelection.includes(p));

                // Split: w1 with nw1, w2 with nw2
                team1 = [w1, nonWinners[0]];
                team2 = [w2, nonWinners[1]];
            }
        }

        return {
            team1,
            team2,
            reason: "Generated based on availability and rotation rules."
        };
    }
}
