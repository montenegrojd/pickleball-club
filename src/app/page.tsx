
'use client';

import { useState, useEffect } from 'react';
import { Calendar, Plus, Users, Trophy, Trash2, ArrowRight, X, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

interface SessionWithStats {
    id: string;
    startDate: string;
    playerIds: string[];
    isActive: boolean;
    isClosed?: boolean;
    matchCount: number;
    playerCount: number;
}

export default function SessionManager() {
    const [sessions, setSessions] = useState<SessionWithStats[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchSessions = async () => {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        setSessions(data);
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleStartNewSession = async () => {
        if (!confirm('Start a new session? This will deactivate the current session.')) return;
        
        setLoading(true);
        await fetch('/api/session/start', { method: 'POST' });
        await fetchSessions();
        setLoading(false);
    };

    const handleCloseSession = async () => {
        if (!confirm('Are you sure you want to CLOSE the session? This will sign out all players.\n\nStats will be preserved.')) return;
        
        setLoading(true);
        await fetch('/api/session/close', { method: 'POST' });
        await fetchSessions();
        setLoading(false);
    };

    const handleDeleteSession = async (sessionId: string, sessionDate: string) => {
        if (!confirm(`Delete session from ${sessionDate}?\n\nThis will permanently delete the session and all its matches. Player stats will be recalculated.\n\nThis action cannot be undone!`)) return;
        
        setLoading(true);
        const res = await fetch(`/api/session/${sessionId}`, { method: 'DELETE' });
        if (res.ok) {
            await fetchSessions();
        } else {
            const error = await res.json();
            alert(`Error: ${error.error}`);
        }
        setLoading(false);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const activeSession = sessions.find(s => s.isActive);

    return (
        <>
            {/* Header */}
            <header className="bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-md">
                <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-extrabold text-white tracking-tight">Pickleball Club</h1>
                            <p className="text-emerald-100">Tuesday Night League</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="min-h-screen bg-gray-50 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    {/* Hall of Fame Link */}
                    <div className="mb-6 text-left">
                        <Link 
                            href="/hall-of-fame"
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:from-yellow-600 hover:to-orange-600 transition-all transform hover:scale-105"
                        >
                            <Trophy className="w-6 h-6" />
                            Hall of Fame
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-6 h-6 text-emerald-600" />
                                <h2 className="text-2xl font-bold text-gray-800">Sessions</h2>
                            </div>
                            {!activeSession && (
                                <button
                                    onClick={handleStartNewSession}
                                    disabled={loading}
                                    className="flex items-center justify-center bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                    title="Start New Session"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {/* Active Session Banner */}
                        {activeSession && (
                            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wide mb-1">
                                            Active Session
                                        </div>
                                        <div className="text-mm font-bold text-emerald-900">
                                            {formatDate(activeSession.startDate)}
                                        </div>
                                        <div className="text-sm text-emerald-700 mt-1">
                                            {activeSession.playerCount} players • {activeSession.matchCount} matches
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleCloseSession}
                                            disabled={loading}
                                            className="flex items-center justify-center bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                                            title="Close Session (End Day)"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                        <Link 
                                            href={`/session/${activeSession.id}`}
                                            className="flex items-center justify-center bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 transition-colors"
                                            title="Go to Dashboard"
                                        >
                                            <LayoutDashboard className="w-5 h-5" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Session List */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                                All Sessions
                            </h3>
                            {sessions.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No sessions yet. Start your first session!</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {sessions.map(session => (
                                        <div
                                            key={session.id}
                                            className="p-4 border border-gray-200 rounded-lg hover:border-emerald-300 transition-all"
                                        >
                                            <div className="flex items-center justify-between">
                                                <Link
                                                    href={`/session/${session.id}`}
                                                    className="flex-1 hover:bg-emerald-50/50 -m-4 p-4 rounded-lg"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold text-gray-800">
                                                            {formatDate(session.startDate)}
                                                        </span>
                                                        {session.isActive && (
                                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                                                                Active
                                                            </span>
                                                        )}
                                                        {session.isClosed && !session.isActive && (
                                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                                                                Closed
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                                        <span className="flex items-center gap-1">
                                                            <Users className="w-4 h-4" />
                                                            {session.playerCount} players
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Trophy className="w-4 h-4" />
                                                            {session.matchCount} matches
                                                        </span>
                                                    </div>
                                                </Link>
                                                <div className="flex items-center gap-2">
                                                    {session.isClosed && !session.isActive && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleDeleteSession(session.id, formatDate(session.startDate));
                                                            }}
                                                            disabled={loading}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                                                            title="Delete session"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <div className="text-emerald-600 font-semibold">
                                                        <LayoutDashboard className="w-5 h-5" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}

