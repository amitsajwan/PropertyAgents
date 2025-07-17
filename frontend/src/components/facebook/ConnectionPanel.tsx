

// src/components/facebook/ConnectionPanel.tsx
import { FacebookConnectionStatus } from '../../types';

interface ConnectionPanelProps {
  status: 'connected' | 'disconnected';
  agentId: string;
  onDisconnect: () => void;
  isLoading: boolean;
  pageName?: string;
}

export default function ConnectionPanel({
  status,
  agentId,
  onDisconnect,
  isLoading,
  pageName
}: ConnectionPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Connection Status</h2>
      
      <div className="flex items-center mb-4">
        <div className={`w-3 h-3 rounded-full mr-2 ${
          status === 'connected' ? 'bg-green-500' : 'bg-gray-400'
        }`}></div>
        <div>
          <span className="capitalize">{status}</span>
          {status === 'connected' && pageName && (
            <p className="text-sm text-gray-600">{pageName}</p>
          )}
        </div>
      </div>

      {status === 'connected' ? (
        <button
          onClick={onDisconnect}
          disabled={isLoading}
          className="w-full bg-red-50 text-red-600 hover:bg-red-100 py-2 px-4 rounded-md text-sm font-medium transition disabled:opacity-50"
        >
          {isLoading ? 'Disconnecting...' : 'Disconnect Facebook'}
        </button>
      ) : (
        <a
          href={`${import.meta.env.VITE_API_URL}/facebook/connect?agent_id=${agentId}`}
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium text-center transition"
        >
          Connect Page
        </a>
      )}

      <div className="mt-4 text-xs text-gray-500">
        {status === 'connected' ? (
          <p>Your page is connected. You can now post directly.</p>
        ) : (
          <p>You'll be redirected to Facebook to authorize access.</p>
        )}
      </div>
    </div>
  );
}