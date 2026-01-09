
'use client';

import { useState, useEffect } from 'react';
import { Player, RosterSession } from '@/lib/types';
import { Plus, UserCheck, Users, X } from 'lucide-react';

export default function Roster({ onUpdate, sessionId }: { onUpdate: () => void, sessionId?: string }) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [session, setSession] = useState<RosterSession | null>(null);
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        const sessionUrl = sessionId 
            ? `/api/session?id=${sessionId}`
            : '/api/session';
        
        const [pRes, sRes] = await Promise.all([
            fetch('/api/players'),
            fetch(sessionUrl)
        ]);
        const pData = await pRes.json();
        const sData = await sRes.json();
        setPlayers(pData);
        setSession(sData);
    };

    useEffect(() => {
        fetchData();
    }, [sessionId]);

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

    const activePlayerIds = session?.playerIds || [];
    const activePlayers = players.filter(p => activePlayerIds.includes(p.id));
    const inactivePlayers = players.filter(p => !activePlayerIds.includes(p.id));
    const isReadOnly = session && !session.isActive;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4 text-emerald-600">
                <Users className="w-5 h-5" />
                <h2 className="font-bold text-lg">Roster</h2>
            </div>

            <div className="space-y-4">
                {/* Add New - hidden for read-only sessions */}
                {!isReadOnly && (
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
                )}

                {/* Active List */}
                <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Checked In ({activePlayers.length})</h3>
                    <div className="flex flex-wrap gap-2">
                        {activePlayers.map(p => (
                            <span key={p.id} className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-900 border border-emerald-200 px-3 py-2 rounded-lg text-base font-medium group relative">
                                <UserCheck className="w-4 h-4 text-emerald-600" />
                                {p.name}
                                {!isReadOnly && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleCheckOut(p.id); }}
                                        className="ml-2 text-emerald-400 hover:text-red-500 hover:bg-emerald-50 p-1 rounded-full transition-colors"
                                        title="Sign Out (Leave session)"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </span>
                        ))}
                        {activePlayers.length === 0 && <p className="text-sm text-gray-400 italic">No one here yet.</p>}
                    </div>
                </div>

                {/* Inactive List (Quick Add) - hidden for read-only sessions */}
                {!isReadOnly && inactivePlayers.length > 0 && (
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
            </div>
        </div>
    );
}
