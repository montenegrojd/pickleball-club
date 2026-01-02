import { Lock } from 'lucide-react';

export default function Unauthorized() {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                        <Lock className="w-8 h-8 text-red-600" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-3">
                    Access Restricted
                </h1>

                <p className="text-gray-600 mb-6">
                    This application is private and requires authentication to access.
                </p>

                <div className="bg-gray-50 rounded-lg p-4 text-left">
                    <p className="text-sm text-gray-700 mb-2">
                        <strong>To gain access:</strong>
                    </p>
                    <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                        <li>Contact your league administrator</li>
                        <li>Request the authentication link</li>
                        <li>Click the link to authenticate</li>
                    </ol>
                </div>

                <p className="text-xs text-gray-500 mt-6">
                    Pickleball Club • Tuesday Night League
                </p>
            </div>
        </div>
    );
}
