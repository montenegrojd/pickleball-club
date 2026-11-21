'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import type { SessionDuprResult } from '@/lib/dupr';

interface Props {
    sessionId: string;
    refreshTrigger?: number;
    defaultExpanded?: boolean;
}

export default function SessionDuprMovement({ sessionId, refreshTrigger = 0, defaultExpanded = true }: Props) {
    const [data, setData] = useState<SessionDuprResult | null>(null);
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    useEffect(() => {
        fetch(`/api/session/${sessionId}/dupr`)
            .then(r => (r.ok ? r.json() : null))
            .then(setData)
            .catch(() => setData(null));
    }, [sessionId, refreshTrigger]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-2 text-teal-600">
                    <TrendingUp className="w-5 h-5" />
                    <h2 className="font-bold text-lg text-gray-800">Movimientos DUPR-alt de la sesión</h2>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {isExpanded && !data && <p className="text-sm text-gray-400">Loading…</p>}
            {isExpanded && data && data.moves.length === 0 && (
                <p className="text-sm text-gray-400">Todavía no hay partidos terminados en esta sesión.</p>
            )}

            {isExpanded && data && data.moves.length > 0 && (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm tabular-nums">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b">
                                    <th className="pb-2 font-medium">Jugador</th>
                                    <th className="pb-2 text-right font-medium">Inicio → Ahora</th>
                                    <th className="pb-2 text-right font-medium">Δ</th>
                                    <th className="pb-2 text-right font-medium">Puesto</th>
                                    <th className="pb-2 text-right font-medium">W-L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.moves.map(m => {
                                    const rankDelta = m.rankBefore !== null && m.rankAfter !== null ? m.rankBefore - m.rankAfter : null;
                                    return (
                                        <tr key={m.playerId} className="border-b border-gray-100 last:border-0">
                                            <td className="py-2 font-medium text-gray-900">{m.name}</td>
                                            <td className="py-2 text-right text-gray-600">
                                                {m.before.toFixed(3)} → <span className="font-semibold text-gray-900">{m.after.toFixed(3)}</span>
                                            </td>
                                            <td className={`py-2 text-right font-semibold ${m.delta > 0 ? 'text-emerald-700' : m.delta < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                                {m.delta > 0 ? '+' : ''}{m.delta.toFixed(3)}
                                            </td>
                                            <td className="py-2 text-right text-gray-700 whitespace-nowrap">
                                                {m.rankAfter === null ? '—' : (
                                                    <>
                                                        {m.rankBefore !== null && <span className="text-gray-400">#{m.rankBefore} → </span>}
                                                        #{m.rankAfter}
                                                        {rankDelta === null ? <span className="ml-1 text-xs text-teal-600">nuevo</span>
                                                            : rankDelta > 0 ? <span className="ml-1 text-xs text-emerald-700">▲{rankDelta}</span>
                                                            : rankDelta < 0 ? <span className="ml-1 text-xs text-red-600">▼{-rankDelta}</span>
                                                            : <span className="ml-1 text-xs text-gray-400">=</span>}
                                                    </>
                                                )}
                                            </td>
                                            <td className="py-2 text-right text-gray-700">{m.wins}–{m.losses}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-3 text-xs text-gray-400">
                        Rating antes del primer partido de la sesión vs. después del último · {data.matchesAnalyzed} partidos terminados
                    </p>
                </>
            )}
        </div>
    );
}
