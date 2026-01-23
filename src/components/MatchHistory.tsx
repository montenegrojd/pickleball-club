
'use client';

import { useState, useEffect } from 'react';
import { Match, Player } from '@/lib/types';
import { Clock, Edit2, Save, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function MatchHistory({ refreshTrigger, onUpdate, sessionId }: { refreshTrigger: number, onUpdate: () => void, sessionId?: string }) {
    const [matches, setMatches] = useState<Match[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editScores, setEditScores] = useState({ s1: '', s2: '' });
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        const matchesUrl = sessionId 
            ? `/api/matches?sessionId=${sessionId}`
            : '/api/matches?range=today';
        
        Promise.all([
            fetch(matchesUrl).then(res => res.json()),
            fetch('/api/players').then(res => res.json())
        ]).then(([mData, pData]) => {
            // Sort by newest first (filtering handled server-side)
            setMatches((mData as Match[]).sort((a, b) => b.timestamp - a.timestamp));
            setPlayers(pData);
        });
    }, [refreshTrigger, sessionId]);

    const getNames = (ids: string[]) => {
        return ids.map(id => players.find(p => p.id === id)?.name || 'Unknown').join(' & ');
    };

    const startEdit = (m: Match) => {
        setEditingId(m.id);
        setEditScores({
            s1: m.score1?.toString() || '0',
            s2: m.score2?.toString() || '0'
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const saveEdit = async (m: Match) => {
        const s1 = parseInt(editScores.s1);
        const s2 = parseInt(editScores.s2);

        if (isNaN(s1) || isNaN(s2)) {
            alert("Invalid scores");
            return;
        }

        const res = await fetch('/api/matches', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...m,
                score1: s1,
                score2: s2,
                isFinished: true, // Should already be
                winnerTeam: s1 > s2 ? 1 : 2
            })
        });

        if (!res.ok) {
            const data = await res.json();
            alert(data.error || "Failed to update score");
            return;
        }

        setEditingId(null);
        onUpdate(); // Trigger refresh of Leaderboard and this list (via parent state)
    };

    const finishedMatches = matches.filter(m => m.isFinished);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
            <div
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-blue-600">
                    <Clock className="w-5 h-5" />
                    <h2 className="font-bold text-lg text-gray-800">Match History ({finishedMatches.length})</h2>
                </div>
                <button className="text-gray-400 hover:text-gray-600 md:hidden">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {isExpanded && (
                <div className="space-y-3">
                    {finishedMatches.map(m => (
                        <div key={m.id} className="flex flex-col md:flex-row items-center justify-between p-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
                            <div className="flex-1 flex justify-end gap-2 text-right">
                                <span className={m.winnerTeam === 1 ? "font-bold text-gray-900" : "text-gray-500"}>
                                    {getNames(m.team1)}
                                </span>
                            </div>

                            {editingId === m.id ? (
                                <div className="flex flex-col items-center gap-2 mx-4 bg-white p-2 rounded border shadow-sm z-10">
                                    <div className="flex items-center gap-4">
                                        {/* Team 1 Score */}
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => {
                                                    const curr = parseInt(editScores.s1) || 0;
                                                    setEditScores(prev => ({ ...prev, s1: Math.max(0, curr - 1).toString() }));
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full font-bold text-gray-700 hover:bg-gray-300"
                                            >-</button>
                                            <span className="text-xl font-bold w-8 text-center text-black">{editScores.s1}</span>
                                            <button
                                                onClick={() => {
                                                    const curr = parseInt(editScores.s1) || 0;
                                                    setEditScores(prev => ({ ...prev, s1: (curr + 1).toString() }));
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-full font-bold text-emerald-800 hover:bg-emerald-200"
                                            >+</button>
                                        </div>

                                        <span className="font-bold text-gray-300">-</span>

                                        {/* Team 2 Score */}
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => {
                                                    const curr = parseInt(editScores.s2) || 0;
                                                    setEditScores(prev => ({ ...prev, s2: Math.max(0, curr - 1).toString() }));
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full font-bold text-gray-700 hover:bg-gray-300"
                                            >-</button>
                                            <span className="text-xl font-bold w-8 text-center text-black">{editScores.s2}</span>
                                            <button
                                                onClick={() => {
                                                    const curr = parseInt(editScores.s2) || 0;
                                                    setEditScores(prev => ({ ...prev, s2: (curr + 1).toString() }));
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-full font-bold text-emerald-800 hover:bg-emerald-200"
                                            >+</button>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 w-full justify-center mt-1">
                                        <button onClick={cancelEdit} className="flex-1 bg-gray-200 text-gray-700 py-1 rounded text-xs font-bold hover:bg-gray-300">Cancel</button>
                                        <button onClick={() => saveEdit(m)} className="flex-1 bg-emerald-600 text-white py-1 rounded text-xs font-bold hover:bg-emerald-700">Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="px-4 font-mono font-bold text-lg text-gray-400 flex items-center gap-2">
                                    {m.score1} - {m.score2}
                                    {!m.isLocked && (
                                        <button onClick={() => startEdit(m)} className="text-gray-300 hover:text-blue-500 transition-colors" title="Edit Score">
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="flex-1 flex justify-start gap-2 text-left">
                                <span className={m.winnerTeam === 2 ? "font-bold text-gray-900" : "text-gray-500"}>
                                    {getNames(m.team2)}
                                </span>
                            </div>
                        </div>
                    ))}
                    {finishedMatches.length === 0 && (
                        <p className="text-center text-gray-400 py-4">No finished matches yet.</p>
                    )}
                </div>
            )}
        </div>
    );
}
