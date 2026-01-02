
'use client';

import { useState, useEffect } from 'react';
import { Match, Player } from '@/lib/types';
import { Play, CheckCircle } from 'lucide-react';

interface MatchControlProps {
    onUpdate: () => void;
    refreshTrigger: number;
}

export default function MatchControl({ onUpdate, refreshTrigger }: MatchControlProps) {
    const [activeMatches, setActiveMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(false);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    // Local state to track scores for each match. Keyed by valid match ID.
    const [matchesScores, setMatchesScores] = useState<Record<string, { s1: string, s2: string }>>({});

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
        fetchData();
    }, [refreshTrigger]);

    const generateMatch = async () => {
        setLoading(true);
        const res = await fetch('/api/matchmaker');
        const proposal = await res.json();

        if (proposal && !proposal.error) {
            // Determine next court number
            // Simple logic: max current court + 1, or just length + 1 if we assume linear
            // Let's use 1-based index from current active count for simplicity, or try to fill gaps? 
            // Simplest: Active count + 1.
            const courtNum = activeMatches.length + 1;

            await fetch('/api/matches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    team1: proposal.team1,
                    team2: proposal.team2,
                    isFinished: false,
                    courtNumber: courtNum
                })
            });
            await fetchData();
            onUpdate();
        } else {
            alert("Could not generate match. Not enough free players?");
        }
        setLoading(false);
    };

    const finishMatch = async (match: Match) => {
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

        await fetchData();
        onUpdate();
        setLoading(false);
    };

    const cancelMatch = async (match: Match) => {
        if (!confirm("Cancel this match? No scores will be recorded.")) return;

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

    const getNames = (ids: string[]) => {
        return ids.map(id => allPlayers.find(p => p.id === id)?.name || 'Unknown').join(' & ');
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-emerald-500">
            <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-xl text-gray-800">Active Courts</h2>
                <button
                    onClick={generateMatch}
                    disabled={loading}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-emerald-700 hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    <Play className="w-4 h-4 fill-current" />
                    New Match
                </button>
            </div>

            {activeMatches.length === 0 ? (
                <div className="text-center py-8 text-gray-400 italic">
                    No matches in progress. Click "New Match" to start.
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
                                            <span className="text-3xl font-bold w-12 text-center">{scores.s1}</span>
                                            <button onClick={() => updateScore(match.id, 1, 'inc')} className="p-2 w-10 h-10 bg-emerald-100 text-emerald-800 rounded-full font-bold hover:bg-emerald-200 active:scale-95">+</button>
                                        </div>
                                    </div>

                                    <div className="font-bold text-gray-300">VS</div>

                                    {/* Team 2 */}
                                    <div className="flex-1 text-center w-full">
                                        <div className="font-bold text-emerald-900 mb-2 truncate px-2">{getNames(match.team2)}</div>
                                        <div className="flex items-center justify-center gap-3">
                                            <button onClick={() => updateScore(match.id, 2, 'dec')} className="p-2 w-10 h-10 bg-gray-200 rounded-full font-bold hover:bg-gray-300 active:scale-95">-</button>
                                            <span className="text-3xl font-bold w-12 text-center">{scores.s2}</span>
                                            <button onClick={() => updateScore(match.id, 2, 'inc')} className="p-2 w-10 h-10 bg-emerald-100 text-emerald-800 rounded-full font-bold hover:bg-emerald-200 active:scale-95">+</button>
                                        </div>
                                    </div>
                                </div>


                                <div className="mt-6 flex gap-2">
                                    <button
                                        onClick={() => finishMatch(match)}
                                        className="flex-1 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 flex items-center justify-center gap-2 text-sm"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Finish Match
                                    </button>
                                    <button
                                        onClick={() => cancelMatch(match)}
                                        className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 text-sm"
                                    >
                                        Cancel Match
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
