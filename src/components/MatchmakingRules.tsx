'use client';

import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export default function MatchmakingRules() {
    const [selectedMode, setSelectedMode] = useState<'rotation' | 'playoff'>('rotation');
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
            <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <h3 className="font-bold text-gray-800">How Matches Are Proposed</h3>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {isExpanded && (
                <div className="mt-4">
                    {/* Mode Selector Tabs */}
                    <div className="flex gap-2 mb-4 border-b border-gray-200">
                        <button
                            onClick={(e) => { e.stopPropagation(); setSelectedMode('rotation'); }}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                                selectedMode === 'rotation'
                                    ? 'border-emerald-600 text-emerald-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Rotation
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSelectedMode('playoff'); }}
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
                            <p className="text-gray-500 italic text-xs">Players in active matches are always excluded before either mode runs.</p>

                            {/* Comparison table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="text-left p-2 font-semibold text-gray-700 border border-gray-200 w-1/3">Aspect</th>
                                            <th className="text-left p-2 font-semibold text-blue-700 border border-gray-200 w-1/3">Rotation</th>
                                            <th className="text-left p-2 font-semibold text-emerald-700 border border-gray-200 w-1/3">Strict Rotation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="p-2 border border-gray-200 text-gray-600">Player selection</td>
                                            <td className="p-2 border border-gray-200">Best-scoring 4-player combination</td>
                                            <td className="p-2 border border-gray-200">Top 4 by bench time, always</td>
                                        </tr>
                                        <tr className="bg-gray-50">
                                            <td className="p-2 border border-gray-200 text-gray-600">Fatigue filter</td>
                                            <td className="p-2 border border-gray-200">Yes — avoids players who played 2 in a row</td>
                                            <td className="p-2 border border-gray-200">No — queue is strictly respected</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 border border-gray-200 text-gray-600">Fresh partnership priority</td>
                                            <td className="p-2 border border-gray-200">Yes — filters out combinations with no fresh pairings</td>
                                            <td className="p-2 border border-gray-200">No — bench time wins</td>
                                        </tr>
                                        <tr className="bg-gray-50">
                                            <td className="p-2 border border-gray-200 text-gray-600">Tie-break</td>
                                            <td className="p-2 border border-gray-200">Longest combined wait + fewest games</td>
                                            <td className="p-2 border border-gray-200">Fewest games played</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 border border-gray-200 text-gray-600">Team formation</td>
                                            <td className="p-2 border border-gray-200" colSpan={2}>Same for both — scored by fresh partnerships and winner split</td>
                                        </tr>
                                        <tr className="bg-gray-50">
                                            <td className="p-2 border border-gray-200 text-gray-600">Best for</td>
                                            <td className="p-2 border border-gray-200">Maximizing variety of matchups</td>
                                            <td className="p-2 border border-gray-200">Guaranteeing equal court time</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Team formation scoring */}
                            <div>
                                <h4 className="font-bold text-gray-800 mb-2">Team Formation Scoring</h4>
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
                                        <span className="text-gray-700">Winners kept together</span>
                                        <span className="font-mono text-sm font-bold text-red-600">-300</span>
                                    </div>
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
            )}
        </div>
    );
}
