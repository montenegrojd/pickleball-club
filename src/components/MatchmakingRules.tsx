'use client';

import { Info } from 'lucide-react';

export default function MatchmakingRules() {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
            <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                    <h3 className="font-bold text-gray-800 mb-3">How Matches Are Proposed</h3>
                    <div className="text-sm text-gray-600 space-y-2">
                        <div className="flex gap-2">
                            <span className="font-semibold min-w-[20px] text-gray-500">1.</span>
                            <span><strong className="text-gray-800">Rest Period:</strong> Players who played the last 2 consecutive matches get priority to sit out</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="font-semibold min-w-[20px] text-gray-500">2.</span>
                            <span><strong className="text-gray-800">Fair Rotation:</strong> Players who sat out the longest are selected first</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="font-semibold min-w-[20px] text-gray-500">3.</span>
                            <span><strong className="text-gray-800">Winners Split:</strong> If both winners from the last match are playing again, they'll be on opposite teams</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="font-semibold min-w-[20px] text-gray-500">4.</span>
                            <span><strong className="text-gray-800">Multi-Court:</strong> Players currently in an active match won't be selected for new matches</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
