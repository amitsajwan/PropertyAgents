import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { AxiosError } from 'axios';

interface PostCreatorProps {
  agentId: string;
  onNewPost: (post: any) => void;
}

interface ConnectionStatus {
  status: 'loading' | 'connected' | 'disconnected' | 'no_page_selected' | 'error';
  pageName?: string;
  error?: string;
}

interface FacebookPost {
  id: string;
  text: string;
  url: string;
  created_at?: string;
  images?: string[];
}

export default function PostCreator({ agentId, onNewPost }: PostCreatorProps) {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [connection, setConnection] = useState<ConnectionStatus>({ 
    status: 'loading' 
  });
  const navigate = useNavigate();

  // Check and verify Facebook connection status
  const checkConnection = async () => {
    try {
      setConnection(prev => ({ ...prev, status: 'loading' }));
      
      const response = await api.get(`/facebook/verify-connection/${agentId}`);
      
      if (response.data.status === 'connected') {
        setConnection({
          status: 'connected',
          pageName: response.data.page_name,
          error: undefined
        });
      } else {
        setConnection({
          status: response.data.status || 'disconnected',
          error: response.data.detail,
          pageName: undefined
        });
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      setConnection({
        status: 'error',
        error: axiosError.response?.data?.detail || 'Failed to check connection',
        pageName: undefined
      });
    }
  };

  useEffect(() => {
    checkConnection();
  }, [agentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || connection.status !== 'connected') return;

    setIsPosting(true);
    setConnection(prev => ({ ...prev, error: undefined }));

    try {
      const formData = new FormData();
      formData.append('agent_id', agentId);
      formData.append('text', content);
      
      // Add images if present
      images.forEach((img, index) => {
        formData.append(`images`, img);
      });

      const response = await api.post<FacebookPost>('/api/posts', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      onNewPost(response.data);
      setContent('');
      setImages([]);
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      
      // If unauthorized, check connection again
      if (axiosError.response?.status === 401) {
        await checkConnection();
      }

      setConnection(prev => ({
        ...prev,
        error: axiosError.response?.data?.detail || 'Failed to create post'
      }));
    } finally {
      setIsPosting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      
      // Basic client-side validation
      const validFiles = files.filter(file => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const isValid = ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
        if (!isValid) {
          setConnection(prev => ({
            ...prev,
            error: `File type .${ext} not supported`
          }));
        }
        return isValid;
      });
      
      setImages(validFiles);
    }
  };

  const handleConnect = () => {
    navigate(`/facebook/connect?agent_id=${agentId}`);
  };

  const handleSelectPage = () => {
    navigate(`/facebook/select-page?agent_id=${agentId}`);
  };

  const renderConnectionStatus = () => {
    switch (connection.status) {
      case 'loading':
        return (
          <div className="flex items-center p-4 bg-gray-50 rounded-lg mb-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
            <span>Checking Facebook connection...</span>
          </div>
        );
        
      case 'connected':
        return (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4 rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="font-medium">
                Connected to: <span className="text-green-700">{connection.pageName}</span>
              </p>
            </div>
          </div>
        );
        
      case 'disconnected':
        return (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-yellow-700">
                  {connection.error || 'Facebook account not connected'}
                </p>
              </div>
              <button
                onClick={handleConnect}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm font-medium"
              >
                Connect
              </button>
            </div>
          </div>
        );
        
      case 'no_page_selected':
        return (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-700">
                  {connection.error || 'Please select a Facebook page'}
                </p>
              </div>
              <button
                onClick={handleSelectPage}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium"
              >
                Select Page
              </button>
            </div>
          </div>
        );
        
      case 'error':
      default:
        return (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-red-700 font-medium">
                  Connection Error
                </p>
                <p className="text-red-600 text-sm mt-1">
                  {connection.error || 'Unable to verify Facebook connection'}
                </p>
              </div>
              <button
                onClick={checkConnection}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Create Facebook Post
        </h2>
        <p className="text-gray-600 mb-6">
          Share your property listings on Facebook
        </p>

        {renderConnectionStatus()}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="post-content" className="block text-sm font-medium text-gray-700 mb-1">
              Post Content
            </label>
            <textarea
              id="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe your property..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              disabled={connection.status !== 'connected' || isPosting}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Images (Optional)
            </label>
            <div className="flex items-center">
              <label className="flex flex-col items-center px-4 py-6 bg-white text-blue-500 rounded-lg border border-dashed border-gray-300 cursor-pointer hover:bg-gray-50">
                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-center">
                  {images.length > 0 
                    ? `${images.length} file(s) selected`
                    : 'Click to upload images'}
                </span>
                <input 
                  type="file" 
                  className="hidden"
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={connection.status !== 'connected' || isPosting}
                />
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Supports JPG, PNG, WEBP (Max 5MB each)
            </p>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, index) => (
                <div key={index} className="relative group">
                  <img 
                    src={URL.createObjectURL(img)} 
                    alt={`Preview ${index}`}
                    className="h-24 w-full object-cover rounded border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => setImages(prev => prev.filter((_, i) => i !== index))}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={connection.status !== 'connected' || isPosting || !content.trim()}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                connection.status !== 'connected' || isPosting || !content.trim()
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {isPosting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Posting...
                </>
              ) : 'Post to Facebook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}