
'use client';

import Leaderboard from '@/components/Leaderboard';
import Link from 'next/link';
import { Home } from 'lucide-react';

export default function HallOfFamePage() {
    return (
        <>
            {/* Header */}
            <header className="bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-md">
                <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-extrabold text-white tracking-tight">Pickleball Club</h1>
                            <p className="text-emerald-100">Hall of Fame - All-Time Statistics</p>
                        </div>
                        <Link 
                            href="/"
                            className="flex items-center gap-2 text-white hover:text-emerald-100 transition-colors"
                        >
                            <Home className="w-5 h-5" />
                            <span className="font-semibold">Home</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="min-h-screen bg-gray-50 p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
                <div className="max-w-2xl mx-auto">
                    <Leaderboard range="all" />
                </div>
            </main>
        </>
    );
}
