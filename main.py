import asyncio
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from typing import Dict

from branding_to_post_graph import build_graph, BrandingPostState

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

# --- CORS Middleware ---
# Allows the frontend to connect to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your frontend's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.graphs: Dict[str, any] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.graphs[client_id] = build_graph()
        logger.info(f"Client connected: {client_id}")

    def disconnect(self, client_id: str):
        del self.active_connections[client_id]
        del self.graphs[client_id]
        logger.info(f"Client disconnected: {client_id}")

    async def send_json(self, client_id: str, data: dict):
        """Sends a JSON message to a specific client."""
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(data)

manager = ConnectionManager()

# --- WebSocket Endpoint ---
@app.websocket("/chat/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # Wait for a message from the client
            data = await websocket.receive_json()
            user_input = data.get("user_input")
            details = data.get("details")

            graph = manager.graphs[client_id]
            
            # Initial state for the graph run
            if user_input:
                initial_state = BrandingPostState(user_input=user_input, websocket=websocket, client_id=client_id)
            elif details:
                # This is for when the user submits the property details form
                initial_state = BrandingPostState(
                    location=details.get("location"),
                    price=details.get("price"),
                    bedrooms=details.get("bedrooms"),
                    features=details.get("features", "").split(','),
                    websocket=websocket,
                    client_id=client_id
                )
            else:
                await manager.send_json(client_id, {"type": "error", "message": "Invalid input"})
                continue

            # Stream the graph execution events
            async for event in graph.astream_events(initial_state, version="v1"):
                kind = event["event"]
                
                if kind == "on_chain_end":
                    node_name = event["name"]
                    output = event["data"].get("output")
                    
                    if output:
                        # Send the output of each step to the client
                        await manager.send_json(client_id, {
                            "type": "update",
                            "step": node_name,
                            "data": output
                        })

                        # If the graph is waiting for info, let the frontend know
                        if node_name == "check_requirements" and output.get("missing_info"):
                             await manager.send_json(client_id, {
                                "type": "request_input",
                                "fields": output["missing_info"]
                            })

            await manager.send_json(client_id, {"type": "final", "message": "Workflow complete."})


    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"Error for client {client_id}: {e}")
        await manager.send_json(client_id, {"type": "error", "message": str(e)})
        manager.disconnect(client_id)

# --- Root Endpoint ---
@app.get("/")
def read_root():
    return {"message": "Real Estate AI Assistant Backend is running."}

# --- Main execution ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
