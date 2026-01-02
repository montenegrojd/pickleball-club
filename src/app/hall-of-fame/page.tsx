
'use client';

import Leaderboard from '@/components/Leaderboard';
import { ArrowLeft } from 'lucide-react';

export default function HallOfFamePage() {
    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
            <div className="max-w-2xl mx-auto">
                <header className="mb-8">
                    <a href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-4 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Session
                    </a>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Hall of Fame</h1>
                    <p className="text-gray-500">All-time league statistics</p>
                </header>

                <Leaderboard range="all" />
            </div>
        </main>
    );
}
