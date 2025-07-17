import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FacebookPost, FacebookPage } from '../types';
import PostHistory from '../components/facebook/PostHistory';
import ConnectionPanel from '../components/facebook/ConnectionPanel';
import PostCreator from '../components/facebook/PostCreator';
import PageSelector from '../components/facebook/PageSelector';
import api from '../lib/api';

export default function FacebookIntegrationPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availablePages, setAvailablePages] = useState<FacebookPage[]>([]);
  const [pageInfo, setPageInfo] = useState<{name?: string, id?: string}>({});

  // Check connection status on load
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.get(`/facebook/status?agent_id=${agentId}`);
        setStatus(res.data.connected ? 'connected' : 'disconnected');
        if (res.data.connected) {
          setPosts(res.data.posts || []);
          setPageInfo({
            name: res.data.page_name,
            id: res.data.page_id
          });
        }
      } catch (err) {
        console.error('Status check failed:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkStatus();
  }, [agentId]);

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pages = urlParams.get('pages');
    
    if (pages) {
      try {
        setAvailablePages(JSON.parse(decodeURIComponent(pages)));
        navigate(window.location.pathname, { replace: true });
      } catch (e) {
        console.error('Failed to parse pages', e);
      }
    }
  }, [navigate]);

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await api.post('/facebook/disconnect', { agentId });
      setStatus('disconnected');
      setPosts([]);
      setPageInfo({});
    } catch (err) {
      console.error('Disconnect failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

 const handlePageSelect = async (page: FacebookPage) => {
  setIsLoading(true);
  try {
    const response = await api.post('/facebook/select-page', {
      agentId,
      page_id: page.id,
      page_name: page.name,
      page_token: page.access_token
    });

    // Update local state with the full response
    setStatus('connected');
    setPageInfo({
      name: response.data.page_name,
      id: response.data.page_id
    });
    setAvailablePages([]);
    
    // Refresh posts
    const statusRes = await api.get(`/facebook/status?agent_id=${agentId}`);
    setPosts(statusRes.data.posts || []);
    
  } catch (error) {
    console.error('Page selection failed:', error);
    // Show error to user
  } finally {
    setIsLoading(false);
  }
};
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Facebook Integration {pageInfo.name && `- ${pageInfo.name}`}
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Connection Status */}
        <div className="lg:col-span-1 space-y-4">
          <ConnectionPanel 
            status={status}
            agentId={agentId!}
            onDisconnect={handleDisconnect}
            isLoading={isLoading}
            pageName={pageInfo.name}
          />
          
          {availablePages.length > 0 && (
            <PageSelector
              pages={availablePages}
              onSelect={handlePageSelect} isLoading={undefined} error={undefined}            />
          )}
        </div>

        {/* Right Column - Content */}
        <div className="lg:col-span-2 space-y-6">
          {status === 'connected' ? (
            <>
              <PostCreator 
                agentId={agentId!}
                onNewPost={(newPost) => setPosts([newPost, ...posts])}
              />
              <PostHistory posts={posts} />
            </>
          ) : (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-yellow-700">
                {availablePages.length > 0 
                  ? "Select a Facebook page to connect"
                  : "Connect your Facebook page to start posting"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}