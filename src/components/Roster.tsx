
'use client';

import { useState, useEffect } from 'react';
import { Player, RosterSession } from '@/lib/types';
import { Plus, UserCheck, Users, X } from 'lucide-react';

export default function Roster({ onUpdate }: { onUpdate: () => void }) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [session, setSession] = useState<RosterSession | null>(null);
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        const [pRes, sRes] = await Promise.all([
            fetch('/api/players'),
            fetch('/api/session')
        ]);
        const pData = await pRes.json();
        const sData = await sRes.json();
        setPlayers(pData);
        setSession(sData);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddPlayer = async () => {
        if (!newName.trim()) return;
        setLoading(true);
        const res = await fetch('/api/players', {
            method: 'POST',
            body: JSON.stringify({ name: newName })
        });
        const newPlayer = await res.json();

        // Auto check-in
        await fetch('/api/session/checkin', {
            method: 'POST',
            body: JSON.stringify({ playerId: newPlayer.id })
        });

        setNewName('');
        await fetchData();
        onUpdate();
        setLoading(false);
    };

    const handleCheckIn = async (playerId: string) => {
        setLoading(true);
        await fetch('/api/session/checkin', {
            method: 'POST',
            body: JSON.stringify({ playerId })
        });
        await fetchData();
        onUpdate();
        setLoading(false);
    };

    const handleCheckOut = async (playerId: string) => {
        if (!confirm("Remove this player from the current session?")) return;
        setLoading(true);
        await fetch('/api/session/checkout', {
            method: 'DELETE',
            body: JSON.stringify({ playerId })
        });
        await fetchData();
        onUpdate();
        setLoading(false);
    };

    const handleCloseSession = async () => {
        if (!confirm("Are you sure you want to CLOSE the session? This will sign out all players.\n\nStats will be preserved.")) return;
        setLoading(true);
        await fetch('/api/session/close', { method: 'POST' });
        await fetchData();
        onUpdate();
        setLoading(false);
    };

    const activePlayerIds = session?.playerIds || [];
    const activePlayers = players.filter(p => activePlayerIds.includes(p.id));
    const inactivePlayers = players.filter(p => !activePlayerIds.includes(p.id));

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4 text-emerald-600">
                <Users className="w-5 h-5" />
                <h2 className="font-bold text-lg">Today's Roster</h2>
            </div>

            <div className="space-y-4">
                {/* Add New */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="New player name..."
                        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
                    />
                    <button
                        onClick={handleAddPlayer}
                        disabled={loading}
                        className="bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                {/* Active List */}
                <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Checked In ({activePlayers.length})</h3>
                    <div className="flex flex-wrap gap-2">
                        {activePlayers.map(p => (
                            <span key={p.id} className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-900 border border-emerald-200 px-3 py-2 rounded-lg text-base font-medium group relative">
                                <UserCheck className="w-4 h-4 text-emerald-600" />
                                {p.name}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleCheckOut(p.id); }}
                                    className="ml-2 text-emerald-400 hover:text-red-500 hover:bg-emerald-50 p-1 rounded-full transition-colors"
                                    title="Sign Out (Leave session)"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </span>
                        ))}
                        {activePlayers.length === 0 && <p className="text-sm text-gray-400 italic">No one here yet.</p>}
                    </div>
                </div>

                {/* Inactive List (Quick Add) */}
                {inactivePlayers.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Quick Check-in</h3>
                        <div className="flex flex-wrap gap-2">
                            {inactivePlayers.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleCheckIn(p.id)}
                                    disabled={loading}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md text-sm transition-colors"
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                    {session?.isClosed ? (
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            Session Closed
                        </span>
                    ) : activePlayers.length > 0 ? (
                        <button
                            onClick={handleCloseSession}
                            className="text-xs font-semibold text-red-400 hover:text-red-600 hover:underline uppercase tracking-wide"
                        >
                            Close Session (End Day)
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
