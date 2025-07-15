import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';

// --- Helper Components ---

const Spinner = () => (
  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

const ChatBubble = ({ message, from }) => (
  <div className={`flex ${from === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
    <div
      className={`rounded-lg px-4 py-2 max-w-lg ${
        from === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'
      }`}
      dangerouslySetInnerHTML={{ __html: marked(message) }}
    ></div>
  </div>
);

const StageDisplay = ({ title, stepKey, data, isLoading }) => {
  if (!data && !isLoading) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-4 border border-gray-200">
      <h3 className="font-bold text-lg mb-2 text-gray-700">{title}</h3>
      {isLoading && !data && <div className="text-gray-500">Generating...</div>}
      {data && (
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: marked(data) }} />
      )}
    </div>
  );
};

const ImageDisplay = ({ title, prompt, imageUrl, isLoading }) => {
    if (!prompt && !isLoading) return null;
    return (
        <div className="bg-white p-4 rounded-lg shadow-md mb-4 border border-gray-200">
            <h3 className="font-bold text-lg mb-2 text-gray-700">{title}</h3>
            {prompt && <p className="text-sm text-gray-600 bg-gray-100 p-2 rounded-md mb-2"><strong>Prompt:</strong> {prompt}</p>}
            <div className="w-full aspect-square bg-gray-100 rounded-md flex items-center justify-center">
                {isLoading && <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>}
                {imageUrl && <img src={`http://localhost:8000/${imageUrl}?t=${new Date().getTime()}`} alt="Generated Visual" className="rounded-md object-cover w-full h-full" />}
            </div>
        </div>
    );
};


const DetailsForm = ({ onSubmit }) => {
  const [details, setDetails] = useState({ location: '', price: '', bedrooms: '', features: '' });

  const handleChange = (e) => {
    setDetails({ ...details, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(details);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-4 border-2 border-blue-500">
      <h3 className="font-bold text-lg mb-2 text-blue-600">Action Required: Provide Property Details</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input name="location" value={details.location} onChange={handleChange} placeholder="Location (e.g., Kharadi, Pune)" className="w-full p-2 border rounded" required />
        <input name="price" value={details.price} onChange={handleChange} placeholder="Price (e.g., 1.5 Cr)" className="w-full p-2 border rounded" required />
        <input name="bedrooms" value={details.bedrooms} onChange={handleChange} placeholder="Bedrooms (e.g., 2 BHK)" className="w-full p-2 border rounded" required />
        <input name="features" value={details.features} onChange={handleChange} placeholder="Key Features (comma-separated)" className="w-full p-2 border rounded" required />
        <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Generate Post</button>
      </form>
    </div>
  );
};


// --- Main App Component ---

const App = () => {
  const [clientId] = useState(uuidv4());
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showDetailsForm, setShowDetailsForm] = useState(false);

  const [workflowState, setWorkflowState] = useState({});
  const [loadingStates, setLoadingStates] = useState({});

  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket(`ws://localhost:8000/chat/${clientId}`);

    ws.current.onopen = () => {
        console.log('WebSocket Connected');
        setMessages([{ from: 'assistant', text: 'Hi! What\'s the core idea for your new project or brand? For example, "luxury villas in Goa".' }]);
    };

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log("Received:", msg);

      switch (msg.type) {
        case 'update':
          handleWorkflowUpdate(msg.step, msg.data);
          break;
        case 'request_input':
          setShowDetailsForm(true);
          setMessages(prev => [...prev, { from: 'assistant', text: 'I need a few more details to proceed. Please fill out the form on the right.' }]);
          break;
        case 'error':
           setMessages(prev => [...prev, { from: 'assistant', text: `**Error:** ${msg.message}` }]);
           break;
        default:
           break;
      }
    };

    return () => ws.current.close();
  }, [clientId]);

  const handleWorkflowUpdate = (step, data) => {
    setLoadingStates(prev => ({ ...prev, [step]: false }));
    
    // The data from the graph contains the state key and its value
    const stateKey = Object.keys(data)[0];
    const value = data[stateKey];

    setWorkflowState(prev => ({ ...prev, [stateKey]: value }));
  };

  const handleSend = () => {
    if (input.trim() === '') return;
    setIsSending(true);
    ws.current.send(JSON.stringify({ user_input: input }));
    setMessages(prev => [...prev, { from: 'user', text: input }]);
    setInput('');

    // Set initial loading states
    setLoadingStates({
        create_branding: true,
        create_visuals: true,
        generate_image: true,
    });
    
    // Clear previous workflow results
    setWorkflowState({});
    setShowDetailsForm(false);
    
    setIsSending(false);
  };
  
  const handleDetailsSubmit = (details) => {
      ws.current.send(JSON.stringify({ details }));
      setShowDetailsForm(false);
      setMessages(prev => [...prev, { from: 'user', text: `Provided Details:\n- Location: ${details.location}\n- Price: ${details.price}` }]);
      setLoadingStates(prev => ({...prev, generate_post: true, post_to_facebook: true }));
  }

  return (
    <div className="flex h-screen font-sans bg-gray-100">
      {/* Left Column: Chat Interface */}
      <div className="w-1/3 bg-white flex flex-col p-4 border-r">
        <h2 className="text-xl font-bold mb-4">AI Assistant</h2>
        <div className="flex-grow overflow-y-auto pr-2">
          {messages.map((msg, i) => <ChatBubble key={i} message={msg.text} from={msg.from} />)}
        </div>
        <div className="mt-4 flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            className="flex-grow p-2 border rounded-l-md"
            placeholder="Type your idea..."
            disabled={isSending || Object.keys(workflowState).length > 0}
          />
          <button onClick={handleSend} className="bg-blue-500 text-white px-4 py-2 rounded-r-md" disabled={isSending || Object.keys(workflowState).length > 0}>
            {isSending ? <Spinner /> : 'Send'}
          </button>
        </div>
      </div>

      {/* Right Column: Workflow Stages */}
      <div className="w-2/3 p-6 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Marketing Content Generation</h2>
        
        {Object.keys(workflowState).length === 0 && !isSending && (
            <div className="text-center text-gray-500 mt-16">
                <p>Your generated content will appear here step-by-step.</p>
            </div>
        )}

        <StageDisplay title="1. Branding Suggestions" stepKey="brand_suggestions" data={workflowState.brand_suggestions} isLoading={loadingStates.create_branding} />
        <ImageDisplay title="2. Visual Concept" prompt={workflowState.visual_prompts} imageUrl={workflowState.image_path} isLoading={loadingStates.generate_image}/>
        
        {showDetailsForm && <DetailsForm onSubmit={handleDetailsSubmit} />}

        <StageDisplay title="3. Final Post Content" stepKey="base_post" data={workflowState.base_post} isLoading={loadingStates.generate_post} />
        <StageDisplay title="4. Publishing Status" stepKey="post_result" data={workflowState.post_result?.message} isLoading={loadingStates.post_to_facebook} />
      </div>
    </div>
  );
};

export default App;
