'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';

export default function MatchmakingRules() {
    const [selectedMode, setSelectedMode] = useState<'rotation' | 'strict-partners' | 'playoff'>('rotation');

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
            <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h3 className="font-bold text-gray-800 mb-3">How Matches Are Proposed</h3>
                    
                    {/* Mode Selector Tabs */}
                    <div className="flex gap-2 mb-4 border-b border-gray-200">
                        <button
                            onClick={() => setSelectedMode('rotation')}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                                selectedMode === 'rotation'
                                    ? 'border-emerald-600 text-emerald-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Rotation
                        </button>
                        <button
                            onClick={() => setSelectedMode('strict-partners')}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                                selectedMode === 'strict-partners'
                                    ? 'border-emerald-600 text-emerald-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            No Repeat Partners
                        </button>
                        <button
                            onClick={() => setSelectedMode('playoff')}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                                selectedMode === 'playoff'
                                    ? 'border-emerald-600 text-emerald-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Playoff
                        </button>
                    </div>

                    {/* Rotation Mode */}
                    {selectedMode === 'rotation' && (
                        <div className="text-sm text-gray-600 space-y-2">
                            <p className="text-gray-700 font-medium mb-3">Balanced matchmaking that ensures everyone plays while maintaining competitive balance.</p>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">1.</span>
                                <span><strong className="text-gray-800">Rest Period:</strong> Players who played the last 2 consecutive matches get priority to sit out</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">2.</span>
                                <span><strong className="text-gray-800">Fair Rotation:</strong> Players who sat out the longest are selected first, then those with fewest games played</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">3.</span>
                                <span><strong className="text-gray-800">Fresh Pairings:</strong> Team combinations that haven't played together are preferred (moderate penalty)</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">4.</span>
                                <span><strong className="text-gray-800">Winners Split:</strong> If both winners from the last match are playing again, they'll be on opposite teams for competitive balance</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">5.</span>
                                <span><strong className="text-gray-800">Multi-Court:</strong> Players currently in an active match won't be selected for new matches</span>
                            </div>
                        </div>
                    )}

                    {/* Strict Partners Mode */}
                    {selectedMode === 'strict-partners' && (
                        <div className="text-sm text-gray-600 space-y-2">
                            <p className="text-gray-700 font-medium mb-3">Maximizes partner variety within a session - every player gets to play with different partners.</p>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">1.</span>
                                <span><strong className="text-gray-800">Rest Period:</strong> Same as Rotation - players who played the last 2 consecutive matches get priority to sit out</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">2.</span>
                                <span><strong className="text-gray-800">Fair Rotation:</strong> Same as Rotation - players who sat out the longest are selected first, then those with fewest games played</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">3.</span>
                                <span><strong className="text-gray-800">No Repeat Partners:</strong> Any partnership that has played together before receives a heavy penalty, ensuring maximum partner variety</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">4.</span>
                                <span><strong className="text-gray-800">Winners Stay (Conditionally):</strong> Winners of the last match stay on court only if it doesn't create repeated partnerships - partner variety always takes priority</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">5.</span>
                                <span><strong className="text-gray-800">Best Use:</strong> Great for social sessions where the goal is to play with as many different people as possible</span>
                            </div>
                        </div>
                    )}

                    {/* Playoff Mode */}
                    {selectedMode === 'playoff' && (
                        <div className="text-sm text-gray-600 space-y-2">
                            <p className="text-gray-700 font-medium mb-3">Competitive seeding for end-of-session tournament matches based on session performance.</p>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">1.</span>
                                <span><strong className="text-gray-800">Performance Ranking:</strong> Players are ranked by win percentage, total wins, points scored, and points per game</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">2.</span>
                                <span><strong className="text-gray-800">Top 4 Selection:</strong> The top 4 available players (not in active matches) are selected for the playoff match</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">3.</span>
                                <span><strong className="text-gray-800">Competitive Seeding:</strong> Teams are formed as #1 & #4 vs #2 & #3, creating balanced competitive matchups</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">4.</span>
                                <span><strong className="text-gray-800">No Rotation:</strong> Fatigue and bench time are not considered - only performance matters</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold min-w-[20px] text-gray-500">5.</span>
                                <span><strong className="text-gray-800">Best Use:</strong> Perfect for championship rounds or when you want top performers to compete</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
