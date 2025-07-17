import { useState } from "react";
import { FacebookPage } from "../../types";

export default function PageSelector({ pages, onSelect, isLoading, error }) {
  const [localError, setLocalError] = useState('');

  const handleSelect = async (page: FacebookPage) => {
    try {
      setLocalError('');
      await onSelect(page);
    } catch (err) {
      setLocalError('Failed to select page. Please try again.');
    }
  }; 
  return (
    <div className="bg-white rounded-lg shadow p-4 animate-fade-in">
      <h3 className="font-medium text-gray-800 mb-3">Select a Facebook Page</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => onSelect(page)}
            className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
          >
            <div className="bg-blue-100 text-blue-600 p-2 rounded-full mr-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">{page.name}</p>
              <p className="text-xs text-gray-500">Page ID: {page.id}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3 text-xs text-gray-500">
        <p>Select the page where properties should be posted</p>
      </div>
    </div>
  );
}