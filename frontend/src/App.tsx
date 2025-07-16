import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';

// --- UI Components ---

const Spinner = () => (
  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

const ChatBubble = ({ message, from }) => (
  <div className={`flex w-full ${from === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
    <div
      className={`rounded-lg px-4 py-2 max-w-lg shadow-md ${
        from === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
      }`}
      // Use dangerouslySetInnerHTML because `marked` returns HTML
      dangerouslySetInnerHTML={{ __html: marked.parse(message || '') as string }}
    ></div>
  </div>
);

const StageDisplay = ({ title, data, isLoading }) => {
  if (!data && !isLoading) return null;
  return (
    <div className="bg-white p-4 rounded-lg shadow-lg mb-4 border border-gray-200 animate-fade-in">
      <h3 className="font-bold text-lg mb-2 text-gray-800">{title}</h3>
      {isLoading && !data && <div className="text-gray-500 italic">Generating...</div>}
      {data && (
        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(data) as string }} />
      )}
    </div>
  );
};

const ImageDisplay = ({ title, imageUrl, isLoading }) => {
  if (!imageUrl && !isLoading) return null;
  return (
    <div className="bg-white p-4 rounded-lg shadow-lg mb-4 border border-gray-200 animate-fade-in">
      <h3 className="font-bold text-lg mb-2 text-gray-800">{title}</h3>
      <div className="w-full aspect-square bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
        {isLoading && <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>}
        {imageUrl && (
          <img
            // Add a timestamp to prevent browser caching issues
            src={`http://localhost:8000${imageUrl}?t=${new Date().getTime()}`}
            alt="Generated property visual"
            className="rounded-md object-cover w-full h-full"
          />
        )}
      </div>
    </div>
  );
};

const DetailsForm = ({ onSubmit, isLoading }) => {
  const [details, setDetails] = useState({ location: '', price: '', bedrooms: '', features: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDetails({ ...details, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(details);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-xl mb-4 border-2 border-indigo-500 animate-fade-in">
      <h3 className="font-bold text-lg mb-3 text-indigo-600">Action Required: Provide Property Details</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input name="location" value={details.location} onChange={handleChange} placeholder="Location (e.g., Kharadi, Pune)" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-400" required />
        <input name="price" value={details.price} onChange={handleChange} placeholder="Price (e.g., 1.5 Cr)" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-400" required />
        <input name="bedrooms" value={details.bedrooms} onChange={handleChange} placeholder="Bedrooms (e.g., 2 BHK)" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-400" required />
        <input name="features" value={details.features} onChange={handleChange} placeholder="Key Features (comma-separated)" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-400" required />
        <button type="submit" className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 font-semibold flex items-center justify-center" disabled={isLoading}>
          {isLoading ? <Spinner /> : 'Generate & Post'}
        </button>
      </form>
    </div>
  );
};


// --- Main App Component ---

const App = () => {
  const [clientId] = useState(uuidv4());
  const [messages, setMessages] = useState<{from: string, text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showDetailsForm, setShowDetailsForm] = useState(false);
  
  // A single state object to hold all workflow results
  const [workflowState, setWorkflowState] = useState<any>({});
  // A single loading object to track active steps
  const [loadingStates, setLoadingStates] = useState<any>({});

  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket(`ws://localhost:8000/chat/${clientId}`);

    ws.current.onopen = () => {
      console.log('WebSocket Connected');
      setMessages([{ from: 'assistant', text: 'Hi! What\'s the core idea for your new project or brand? For example, "luxury villas in Goa".' }]);
    };

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("Received WS Message:", msg);

        switch (msg.type) {
          case 'update':
            // Stop loading for the completed step
            setLoadingStates(prev => ({ ...prev, [msg.step]: false }));
            // Add new data to the workflow state
            setWorkflowState(prev => ({ ...prev, ...msg.data }));
            break;
          case 'request_input':
            setShowDetailsForm(true);
            setMessages(prev => [...prev, { from: 'assistant', text: 'Branding complete! Now I need a few more details to create the post. Please fill out the form on the right.' }]);
            break;
          case 'error':
            setMessages(prev => [...prev, { from: 'assistant', text: `**Error:** ${msg.message}` }]);
            // Clear all loading states on error
            setLoadingStates({});
            break;
          case 'final':
            setMessages(prev => [...prev, { from: 'assistant', text: msg.message || '✅ All done!' }]);
            setLoadingStates(prev => ({ ...prev, post_to_facebook: false }));
            break;
          default:
            console.warn("Unhandled WebSocket message type:", msg.type);
            break;
        }
      } catch (e) {
        console.error("Invalid JSON received:", event.data, e);
      }
    };

    ws.current.onclose = () => console.log('WebSocket Disconnected');
    ws.current.onerror = (error) => console.error('WebSocket Error:', error);

    return () => {
      if(ws.current) ws.current.close();
    };
  }, [clientId]);

  const handleSendInitialInput = () => {
    if (input.trim() === '') return;
    
    // Reset state for a new run
    setWorkflowState({});
    setShowDetailsForm(false);
    setMessages(prev => [...prev, { from: 'user', text: input }]);
    
    ws.current?.send(JSON.stringify({ type: "initial_input", user_input: input }));
    setInput('');
    
    // Set loading states for the initial branding stages
    setLoadingStates({ create_branding: true, create_visuals: true, generate_image: true });
  };

  const handleDetailsSubmit = (details: any) => {
    ws.current?.send(JSON.stringify({ type: "details_input", details }));
    setShowDetailsForm(false);
    setMessages(prev => [...prev, { from: 'user', text: `Here are the property details.` }]);
    
    // Set loading states for the posting stages
    setLoadingStates(prev => ({ ...prev, generate_post: true, post_to_facebook: true }));
  };

  return (
    <div className="flex h-screen font-sans bg-gray-100">
      {/* Left Panel: Chat */}
      <div className="w-1/2 bg-white flex flex-col p-4 border-r">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">AI Assistant</h2>
        <div className="flex-grow overflow-y-auto pr-2 space-y-4">
          {messages.map((msg, i) => <ChatBubble key={i} message={msg.text} from={msg.from} />)}
        </div>
        <div className="mt-4 flex border-t pt-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendInitialInput()}
            className="flex-grow p-3 border rounded-l-md focus:ring-2 focus:ring-indigo-500"
            placeholder="Type your business idea..."
            disabled={Object.keys(workflowState).length > 0} // Disable after first message
          />
          <button onClick={handleSendInitialInput} className="bg-indigo-600 text-white px-6 py-3 rounded-r-md font-semibold" disabled={Object.keys(workflowState).length > 0}>
            Start
          </button>
        </div>
      </div>

      {/* Right Panel: Workflow Status & Form */}
      <div className="w-1/2 p-6 overflow-y-auto bg-gray-50">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Workflow Status</h2>
        {Object.keys(workflowState).length === 0 && Object.keys(loadingStates).length === 0 && (
          <div className="text-center text-gray-500 mt-16 p-8 bg-white rounded-lg shadow-inner">
            <p>Your generated content will appear here step-by-step.</p>
          </div>
        )}
        <StageDisplay title="1. Branding Suggestions" data={workflowState.brand_suggestions} isLoading={loadingStates.create_branding} />
        <ImageDisplay title="2. Visual Concept" imageUrl={workflowState.image_path} isLoading={loadingStates.generate_image} />
        {showDetailsForm && <DetailsForm onSubmit={handleDetailsSubmit} isLoading={loadingStates.generate_post} />}
        <StageDisplay title="3. Final Post Content" data={workflowState.base_post} isLoading={loadingStates.generate_post} />
        <StageDisplay title="4. Publishing Status" data={workflowState.post_result?.message} isLoading={loadingStates.post_to_facebook} />
      </div>
    </div>
  );
};

export default App;
