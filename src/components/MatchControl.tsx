
'use client';

import { useState, useEffect } from 'react';
import { Match, Player } from '@/lib/types';
import { Play, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface MatchAnalytics {
    hadFatiguedPlayers: string[];
    winnersWereSplit: boolean | null;
    repeatedPartnerships: Array<{ player1: string, player2: string }>;
    keptWinners: boolean;
}

interface PendingProposal {
    team1: string[];
    team2: string[];
    analytics: MatchAnalytics | null;
    availablePlayerIds: string[];
    isEdited: boolean;
}

interface MatchControlProps {
    onUpdate: () => void;
    refreshTrigger: number;
    sessionId?: string;
}

export default function MatchControl({ onUpdate, refreshTrigger, sessionId }: MatchControlProps) {
    const [activeMatches, setActiveMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(false);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    // Local state to track scores for each match. Keyed by valid match ID.
    const [matchesScores, setMatchesScores] = useState<Record<string, { s1: string, s2: string }>>({});
    const [lastMatchAnalytics, setLastMatchAnalytics] = useState<MatchAnalytics | null>(null);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [matchMode, setMatchMode] = useState<'rotation' | 'playoff'>('rotation');
    const [pendingProposal, setPendingProposal] = useState<PendingProposal | null>(null);

    const hasDuplicatePendingPlayers = pendingProposal
        ? (() => {
            const selectedPlayers = [...pendingProposal.team1, ...pendingProposal.team2].filter(Boolean);
            return new Set(selectedPlayers).size !== selectedPlayers.length;
        })()
        : false;

    const fetchData = async () => {
        const [mRes, pRes] = await Promise.all([
            fetch('/api/matches'),
            fetch('/api/players')
        ]);
        const matches: Match[] = await mRes.json();
        const players: Player[] = await pRes.json();
        setAllPlayers(players);

        // Filter for active matches
        // Sort by court number or timestamp
        const active = matches.filter(m => !m.isFinished).sort((a, b) => (a.courtNumber || 0) - (b.courtNumber || 0));
        setActiveMatches(active);

        // Initialize scores state for new matches
        setMatchesScores(prev => {
            const next = { ...prev };
            active.forEach(m => {
                if (!next[m.id]) {
                    next[m.id] = { s1: '0', s2: '0' };
                }
            });
            return next;
        });
    };

    useEffect(() => {
        void (async () => {
            await fetchData();
        })();
    }, [refreshTrigger]);

    const getSessionRosterIds = async () => {
        const sessionPath = sessionId ? `/api/session?id=${sessionId}` : '/api/session';
        const response = await fetch(sessionPath);
        if (!response.ok) return [] as string[];
        const session = await response.json();
        return Array.isArray(session.playerIds) ? session.playerIds as string[] : [];
    };

    const getCurrentMatchContext = async () => {
        const [matchesResponse, rosterIds] = await Promise.all([
            fetch('/api/matches'),
            getSessionRosterIds()
        ]);
        const matches: Match[] = await matchesResponse.json();
        const activeMatchesNow = matches.filter(match => !match.isFinished);
        const busyPlayerIds = new Set(activeMatchesNow.flatMap(match => [...match.team1, ...match.team2]));
        const availablePlayerIds = rosterIds.filter(id => !busyPlayerIds.has(id));

        const usedCourtNumbers = new Set(
            activeMatchesNow
                .map(match => match.courtNumber)
                .filter((courtNumber): courtNumber is number => typeof courtNumber === 'number' && courtNumber > 0)
        );

        let nextCourtNumber = 1;
        while (usedCourtNumbers.has(nextCourtNumber)) {
            nextCourtNumber += 1;
        }

        return {
            nextCourtNumber,
            availablePlayerIds
        };
    };

    const createMatchFromTeams = async (team1: string[], team2: string[]) => {
        const { nextCourtNumber } = await getCurrentMatchContext();

        const createResponse = await fetch('/api/matches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                team1,
                team2,
                isFinished: false,
                courtNumber: nextCourtNumber
            })
        });

        if (!createResponse.ok) {
            const data = await createResponse.json().catch(() => ({}));
            return { success: false, error: data.error || 'Failed to create match' };
        }

        return { success: true, error: '' };
    };

    const requestProposal = async () => {
        const res = await fetch(`/api/matchmaker?mode=${matchMode}`);
        const proposal = await res.json();

        if (proposal && !proposal.error) {
            const { availablePlayerIds } = await getCurrentMatchContext();

            const analytics = proposal.analytics || null;
            setLastMatchAnalytics(analytics);
            setShowAnalytics(true);
            setPendingProposal({
                team1: proposal.team1,
                team2: proposal.team2,
                analytics,
                availablePlayerIds,
                isEdited: false
            });
            return { success: true, proposal };
        }

        return { success: false, proposal };
    };

    const generateMatch = async () => {
        setLoading(true);
        const result = await requestProposal();

        if (!result.success) {
            alert("Could not generate match. Not enough free players?");
        } else {
            setShowAnalytics(true);
        }

        setLoading(false);
    };

    const confirmPendingProposal = async () => {
        if (!pendingProposal) return;

        if (hasDuplicatePendingPlayers) {
            return;
        }

        setLoading(true);
        const result = await createMatchFromTeams(pendingProposal.team1, pendingProposal.team2);

        if (!result.success) {
            alert(result.error);
            setLoading(false);
            return;
        }

        setPendingProposal(null);
        await fetchData();
        onUpdate();
        setLoading(false);
    };

    const updatePendingProposalPlayer = (team: 1 | 2, index: number, playerId: string) => {
        if (!pendingProposal) return;

        const nextTeam1 = [...pendingProposal.team1];
        const nextTeam2 = [...pendingProposal.team2];

        if (team === 1) {
            nextTeam1[index] = playerId;
        } else {
            nextTeam2[index] = playerId;
        }

        setPendingProposal({
            ...pendingProposal,
            team1: nextTeam1,
            team2: nextTeam2,
            isEdited: true
        });
    };

    const finishMatch = async (match: Match, startNextMatch = false) => {
        const scores = matchesScores[match.id];
        if (!scores) return;

        const s1 = parseInt(scores.s1);
        const s2 = parseInt(scores.s2);

        if (isNaN(s1) || isNaN(s2)) {
            alert("Please enter valid scores");
            return;
        }

        setLoading(true);
        await fetch('/api/matches', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...match,
                score1: s1,
                score2: s2,
                isFinished: true,
                winnerTeam: s1 > s2 ? 1 : 2
            })
        });

        // Cleanup local state
        setMatchesScores(prev => {
            const next = { ...prev };
            delete next[match.id];
            return next;
        });

        if (startNextMatch) {
            const proposalResult = await requestProposal();
            if (!proposalResult.success) {
                alert("Match finished, but we couldn't start the next match automatically.");
            } else {
                const createResult = await createMatchFromTeams(proposalResult.proposal.team1, proposalResult.proposal.team2);
                if (!createResult.success) {
                    alert(`Match finished, but next match creation failed: ${createResult.error}`);
                }
            }
            setPendingProposal(null);
        }

        await fetchData();
        onUpdate();
        setLoading(false);
    };

    const cancelMatch = async (match: Match) => {
        setLoading(true);
        await fetch(`/api/matches/${match.id}`, {
            method: 'DELETE'
        });

        // Cleanup local state
        setMatchesScores(prev => {
            const next = { ...prev };
            delete next[match.id];
            return next;
        });

        await fetchData();
        onUpdate();
        setLoading(false);
    };

    const updateScore = (matchId: string, team: 1 | 2, action: 'inc' | 'dec') => {
        setMatchesScores(prev => {
            const current = prev[matchId] || { s1: '0', s2: '0' };
            const val = parseInt(team === 1 ? current.s1 : current.s2) || 0;
            const newVal = action === 'inc' ? val + 1 : Math.max(0, val - 1);

            return {
                ...prev,
                [matchId]: {
                    ...current,
                    [team === 1 ? 's1' : 's2']: newVal.toString()
                }
            };
        });
    }

    const handleScoreInput = (matchId: string, team: 1 | 2, value: string) => {
        // Allow empty string or valid numbers
        if (value === '' || /^\d+$/.test(value)) {
            setMatchesScores(prev => ({
                ...prev,
                [matchId]: {
                    ...prev[matchId],
                    [team === 1 ? 's1' : 's2']: value
                }
            }));
        }
    }

    const getNames = (ids: string[]) => {
        return ids.map(id => allPlayers.find(p => p.id === id)?.name || 'Unknown').join(' & ');
    };

    return (
        <>
            {/* New Match Card */}
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-emerald-500 mb-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h2 className="font-bold text-xl text-gray-800 mb-1">Generate Match</h2>
                        <p className="text-sm text-gray-500">Select a mode, edit if needed, then confirm match</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <select
                            value={matchMode}
                            onChange={(e) => setMatchMode(e.target.value as 'rotation' | 'playoff')}
                            className="flex-1 md:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="rotation">Rotation</option>
                            <option value="playoff">Playoff</option>
                        </select>
                        <button
                            onClick={generateMatch}
                            disabled={loading}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-emerald-700 hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                        >
                            <Play className="w-4 h-4 fill-current" />
                            Generate Proposal
                        </button>
                    </div>
                </div>

                {pendingProposal && (
                    <div className="mt-4 border-t pt-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">Team 1</h3>
                                <div className="space-y-2">
                                    {[0, 1].map(index => (
                                        <select
                                            key={`team1-${index}`}
                                            value={pendingProposal.team1[index]}
                                            onChange={(e) => updatePendingProposalPlayer(1, index, e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        >
                                            {pendingProposal.availablePlayerIds.map(playerId => (
                                                <option key={playerId} value={playerId}>
                                                    {allPlayers.find(player => player.id === playerId)?.name || 'Unknown'}
                                                </option>
                                            ))}
                                        </select>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">Team 2</h3>
                                <div className="space-y-2">
                                    {[0, 1].map(index => (
                                        <select
                                            key={`team2-${index}`}
                                            value={pendingProposal.team2[index]}
                                            onChange={(e) => updatePendingProposalPlayer(2, index, e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        >
                                            {pendingProposal.availablePlayerIds.map(playerId => (
                                                <option key={playerId} value={playerId}>
                                                    {allPlayers.find(player => player.id === playerId)?.name || 'Unknown'}
                                                </option>
                                            ))}
                                        </select>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setPendingProposal(null)}
                                disabled={loading}
                                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-300 disabled:opacity-50"
                            >
                                Discard Proposal
                            </button>
                            <button
                                onClick={confirmPendingProposal}
                                disabled={loading || hasDuplicatePendingPlayers}
                                title={hasDuplicatePendingPlayers ? 'Select 4 different players to confirm' : undefined}
                                className="bg-gray-900 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-800 disabled:opacity-50"
                            >
                                Confirm Match
                            </button>
                        </div>
                    </div>
                )}

                {/* Match Analytics */}
                {lastMatchAnalytics && (!pendingProposal || !pendingProposal.isEdited) && (
                    <div className="mt-4 border-t pt-4">
                        <button
                            onClick={() => setShowAnalytics(!showAnalytics)}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors w-full"
                        >
                            <Info className="w-4 h-4" />
                            <span className="font-medium">Match Quality</span>
                            {showAnalytics ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                        </button>
                        {showAnalytics && (
                            <div className="mt-2 text-sm text-gray-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                        <div className="flex gap-2 flex-wrap text-xs">
                                            {lastMatchAnalytics.hadFatiguedPlayers.length === 0 && (
                                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-semibold">
                                                    ✓ No Fatigue
                                                </span>
                                            )}
                                            {lastMatchAnalytics.hadFatiguedPlayers.length > 0 && (
                                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded font-semibold">
                                                    ⚠️ {lastMatchAnalytics.hadFatiguedPlayers.length} Fatigued
                                                </span>
                                            )}
                                            {lastMatchAnalytics.winnersWereSplit === true && (
                                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-semibold">
                                                    ✓ Winners Split
                                                </span>
                                            )}
                                            {lastMatchAnalytics.winnersWereSplit === false && (
                                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-semibold">
                                                    ✗ Winners Together
                                                </span>
                                            )}
                                            {lastMatchAnalytics.repeatedPartnerships.length === 0 && (
                                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-semibold">
                                                    ✓ Fresh Partners
                                                </span>
                                            )}
                                            {lastMatchAnalytics.repeatedPartnerships.length > 0 && (
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-semibold">
                                                    🔄 {lastMatchAnalytics.repeatedPartnerships.length} Repeat
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Detailed analytics info */}
                                        <div className="mt-2 space-y-1 text-xs">
                                            {lastMatchAnalytics.hadFatiguedPlayers.length > 0 && (
                                                <div className="flex gap-2">
                                                    <span className="font-semibold text-orange-700">⚠️ Fatigued:</span>
                                                    <span>{lastMatchAnalytics.hadFatiguedPlayers.map(id => allPlayers.find(p => p.id === id)?.name || 'Unknown').join(', ')} played 2 consecutive games</span>
                                                </div>
                                            )}
                                            {lastMatchAnalytics.repeatedPartnerships.length > 0 && (
                                                <div className="flex gap-2">
                                                    <span className="font-semibold text-yellow-700">🔄 Repeats:</span>
                                                    <span>
                                                        {lastMatchAnalytics.repeatedPartnerships.map(p => {
                                                            const name1 = allPlayers.find(player => player.id === p.player1)?.name || 'Unknown';
                                                            const name2 = allPlayers.find(player => player.id === p.player2)?.name || 'Unknown';
                                                            return `${name1} & ${name2}`;
                                                        }).join(', ')} played together before
                                                    </span>
                                                </div>
                                            )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Active Courts Card */}
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
                <h2 className="font-bold text-xl text-gray-800 mb-6">Active Courts</h2>

                {activeMatches.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 italic">
                        No matches in progress
                    </div>
                ) : (
                <div className="grid grid-cols-1 gap-6">
                    {activeMatches.map((match, idx) => {
                        const scores = matchesScores[match.id] || { s1: '0', s2: '0' };
                        return (
                            <div key={match.id} className="border rounded-xl p-4 bg-gray-50 relative">
                                <div className="absolute top-2 left-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    Court {match.courtNumber || idx + 1}
                                </div>

                                <div className="mt-6 flex flex-col md:flex-row items-center gap-4">
                                    {/* Team 1 */}
                                    <div className="flex-1 text-center w-full">
                                        <div className="font-bold text-emerald-900 mb-2 truncate px-2">{getNames(match.team1)}</div>
                                        <div className="flex items-center justify-center gap-3">
                                            <button onClick={() => updateScore(match.id, 1, 'dec')} className="p-2 w-10 h-10 bg-gray-200 rounded-full font-bold hover:bg-gray-300 active:scale-95">-</button>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={scores.s1}
                                                onChange={(e) => handleScoreInput(match.id, 1, e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                                className="text-3xl font-bold w-16 text-center border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:outline-none text-black"
                                            />
                                            <button onClick={() => updateScore(match.id, 1, 'inc')} className="p-2 w-10 h-10 bg-emerald-100 text-emerald-800 rounded-full font-bold hover:bg-emerald-200 active:scale-95">+</button>
                                        </div>
                                    </div>

                                    <div className="font-bold text-gray-300">VS</div>

                                    {/* Team 2 */}
                                    <div className="flex-1 text-center w-full">
                                        <div className="font-bold text-emerald-900 mb-2 truncate px-2">{getNames(match.team2)}</div>
                                        <div className="flex items-center justify-center gap-3">
                                            <button onClick={() => updateScore(match.id, 2, 'dec')} className="p-2 w-10 h-10 bg-gray-200 rounded-full font-bold hover:bg-gray-300 active:scale-95">-</button>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={scores.s2}
                                                onChange={(e) => handleScoreInput(match.id, 2, e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                                className="text-3xl font-bold w-16 text-center border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:outline-none text-black"
                                            />
                                            <button onClick={() => updateScore(match.id, 2, 'inc')} className="p-2 w-10 h-10 bg-emerald-100 text-emerald-800 rounded-full font-bold hover:bg-emerald-200 active:scale-95">+</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 flex gap-2">
                                    <button
                                        onClick={() => cancelMatch(match)}
                                        disabled={loading}
                                        className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 text-sm"
                                    >
                                        Cancel Match
                                    </button>
                                    <button
                                        onClick={() => finishMatch(match, true)}
                                        disabled={loading}
                                        className="flex-1 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                                    >
                                        Finish & Start Match
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
        </>
    );
}
