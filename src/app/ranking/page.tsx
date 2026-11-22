'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import type { DuprResult } from '@/lib/dupr';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtShort = (t: number) => {
    const d = new Date(t);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
const fmtLong = (t: number) => `${fmtShort(t)} ${new Date(t).getFullYear()}`;

export default function RankingPage() {
    const [data, setData] = useState<DuprResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showProvisional, setShowProvisional] = useState(true);

    const toggleProvisional = () => {
        setShowProvisional(prev => {
            const next = !prev;
            try { localStorage.setItem('ranking.showProvisional', String(next)); } catch { /* ignore */ }
            return next;
        });
    };

    const rows = data ? data.rows.filter(r => showProvisional || !r.provisional) : [];
    const provisionalCount = data ? data.rows.filter(r => r.provisional).length : 0;

    useEffect(() => {
        fetch('/api/dupr')
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
            .then((d: DuprResult) => {
                try {
                    if (localStorage.getItem('ranking.showProvisional') === 'false') setShowProvisional(false);
                } catch { /* storage unavailable */ }
                setData(d);
            })
            .catch(e => setError(String(e)));
    }, []);

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#0f2537] text-slate-100">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal-700/30" />
            <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-teal-800/25" />

            <div className="relative mx-auto max-w-3xl px-4 py-10 md:px-8">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Ranking Pickleball Club</h1>
                        <p className="mt-1 text-teal-100/80">Simulación DUPR alternativa · Match type: Club</p>
                    </div>
                    <Link href="/" className="flex items-center gap-2 text-teal-100 hover:text-white">
                        <Home className="h-5 w-5" />
                        <span className="hidden font-semibold sm:inline">Inicio</span>
                    </Link>
                </div>

                <div className="mt-5 rounded-full bg-teal-700/50 px-5 py-2 text-teal-50">
                    Activos en los últimos {data?.config.ACTIVE_MONTHS ?? 6} meses
                    {data && <> · actualizado al {fmtLong(data.asOf)}</>}
                </div>

                {data && provisionalCount > 0 && (
                    <div className="mt-4 flex items-center justify-end">
                        <label className="flex cursor-pointer select-none items-center gap-3 text-sm text-teal-100/90">
                            <span>
                                Mostrar provisionales
                                <span className="ml-1 text-teal-100/60">({provisionalCount})</span>
                            </span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={showProvisional}
                                onClick={toggleProvisional}
                                className={`relative h-6 w-11 rounded-full transition-colors ${showProvisional ? 'bg-teal-500' : 'bg-white/20'}`}
                            >
                                <span
                                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${showProvisional ? 'translate-x-5' : 'translate-x-0.5'}`}
                                />
                            </button>
                        </label>
                    </div>
                )}

                <section className="mt-4 rounded-2xl bg-[#14304a]/80 p-4 md:p-6">
                    {error && <p className="text-red-300">No se pudo cargar el ranking: {error}</p>}
                    {!data && !error && <p className="text-teal-100/70">Calculando…</p>}
                    {data && (
                        <table className="w-full text-left tabular-nums">
                            <thead>
                                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-teal-200/80">
                                    <th className="py-3 pr-2 font-medium">#</th>
                                    <th className="py-3 pr-2 font-medium">Jugador</th>
                                    <th className="py-3 pr-2 text-right font-medium">Rating</th>
                                    <th className="py-3 pr-2 text-right font-medium">Partidos</th>
                                    <th className="hidden py-3 pr-2 font-medium sm:table-cell">Último</th>
                                    <th className="py-3 text-right font-medium">W-L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={r.playerId} className="border-b border-white/10 last:border-0">
                                        <td className="py-3 pr-2 text-teal-300">{i + 1}</td>
                                        <td className="py-3 pr-2 text-lg">
                                            {r.name}
                                            {r.provisional && (
                                                <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-200" title="Menos de 20 partidos: rating provisional">
                                                    prov
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 pr-2 text-right font-semibold">{r.rating.toFixed(3)}</td>
                                        <td className="py-3 pr-2 text-right">{r.matches}</td>
                                        <td className="hidden py-3 pr-2 sm:table-cell">{fmtShort(r.lastMatch)}</td>
                                        <td className="py-3 text-right">{r.wins}–{r.losses}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                <section className="mt-8 rounded-2xl bg-teal-800/40 p-6 text-sm leading-relaxed text-teal-50/90">
                    <h2 className="mb-2 text-base font-semibold text-white">¿Cómo se calcula?</h2>
                    <p>
                        Todos comenzaron en 3.000. La simulación usa un Elo modificado: compara el promedio de rating de
                        cada pareja, la proporción de puntos lograda y la experiencia acumulada. Para partidos Club se
                        aplica un peso base de 0.20 y un ajuste de dobles; los ratings provisionales (menos de 20
                        partidos) se mueven más. No es un rating oficial DUPR.
                    </p>
                </section>

                {data && (
                    <footer className="mt-8 text-teal-100/80">
                        <p>W-L = victorias–derrotas · {data.matchesAnalyzed} partidos analizados</p>
                        <p className="mt-1 text-xs">
                            Excluye jugadores sin partidos en los últimos seis meses.
                            {!showProvisional && provisionalCount > 0 && <> Ocultando {provisionalCount} jugadores provisionales (menos de 20 partidos).</>}
                        </p>
                    </footer>
                )}
            </div>
        </main>
    );
}
