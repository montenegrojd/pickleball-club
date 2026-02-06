'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';

export default function MatchmakingRules() {
    const [selectedMode, setSelectedMode] = useState<'rotation' | 'playoff'>('rotation');

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
                        <div className="text-sm text-gray-600 space-y-4">
                            <p className="text-gray-700 font-medium">Partnership-first matchmaking: prioritizes fresh pairings while maintaining fair rotation.</p>
                            
                            {/* Phase 1 */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">1</div>
                                    <h4 className="font-bold text-gray-800">Player Selection - Who Plays</h4>
                                </div>
                                <div className="ml-8 space-y-2">
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-gray-500">1.</span>
                                        <span><strong className="text-gray-800">Generate Combinations:</strong> All possible 4-player groups from available players (excluding those in active matches)</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-gray-500">2.</span>
                                        <span><strong className="text-gray-800">Fatigue Filter (Hard Rule):</strong> Exclude combinations with players who played last 2 consecutive matches if non-fatigued options exist</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-gray-500">3.</span>
                                        <span><strong className="text-gray-800">Fresh Partnership Priority:</strong> Among non-fatigued options, prefer combinations that can form new/unused partnerships</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-gray-500">4.</span>
                                        <span><strong className="text-gray-800">Fairness Scoring:</strong> Select combination with longest combined bench time and fewest combined games played</span>
                                    </div>
                                </div>
                            </div>

                            {/* Phase 2 */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">2</div>
                                    <h4 className="font-bold text-gray-800">Team Formation - How to Pair Them</h4>
                                </div>
                                <div className="ml-8 space-y-2">
                                    <p className="text-gray-600 mb-2">With 4 players selected, the algorithm scores all 3 possible team configurations:</p>
                                    <div className="bg-gray-50 rounded p-3 space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-700">Fresh partnership (unused pairing)</span>
                                            <span className="font-mono text-sm font-bold text-emerald-600">+150</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-700">Both teams fresh (bonus)</span>
                                            <span className="font-mono text-sm font-bold text-emerald-600">+300</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-700">Winners split to opposite teams</span>
                                            <span className="font-mono text-sm font-bold text-emerald-600">+200</span>
                                        </div>
                                        <div className="border-t border-gray-200 my-1"></div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-700">Repeated partnership</span>
                                            <span className="font-mono text-sm font-bold text-red-600">-100</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-700">Winners kept together (same team)</span>
                                            <span className="font-mono text-sm font-bold text-red-600">-300</span>
                                        </div>
                                    </div>
                                    <p className="text-gray-500 italic text-xs mt-2">Configuration with highest total score is selected</p>
                                </div>
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
