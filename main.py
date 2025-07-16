import os
import asyncio
import logging
import json
from typing import Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from langchain_core.runnables import RunnableConfig

from branding_to_post_graph import build_graph, BrandingPostState

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(client_id)s] - %(message)s')
logger = logging.getLogger("realestate-ai")

# --- FastAPI App Setup ---
app = FastAPI(title="Real Estate AI Assistant Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("generated_images", exist_ok=True)
app.mount("/generated_images", StaticFiles(directory="generated_images"), name="generated_images")

# --- Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.states: Dict[str, BrandingPostState] = {}
        self.graph = build_graph()

    async def connect(self, client_id: str, ws: WebSocket):
        await ws.accept()
        self.active_connections[client_id] = ws
        self.states[client_id] = BrandingPostState(client_id=client_id)
        logger.info("Client connected", extra={"client_id": client_id})

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)
        self.states.pop(client_id, None)
        logger.info("Client disconnected", extra={"client_id": client_id})

    async def run_graph_part(self, client_id: str, state_update: dict):
        """Merges updates into the current state and runs the LangGraph workflow."""
        current_state = self.states.get(client_id)
        if not current_state:
            logger.error(f"No state found for client {client_id}", extra={"client_id": client_id})
            return

        # If for any reason the state is still a dict, convert it safely
        if isinstance(current_state, dict):
            try:
                current_state = BrandingPostState(**current_state)
            except Exception as e:
                logger.exception("Failed to convert dict to BrandingPostState")
                await self.active_connections[client_id].send_json({"type": "error", "message": str(e)})
                return

        try:
            self.states[client_id] = current_state = current_state.copy()
        except Exception as e:
            logger.exception("Failed to update state")
            await self.active_connections[client_id].send_json({"type": "error", "message": str(e)})
            return

        config = RunnableConfig(configurable={"client_id": client_id, "websocket": self.active_connections.get(client_id)})

        try:
            async for event in self.graph.astream_events(current_state, config, version="v1"):
                kind = event["event"]
                if kind == "on_chain_end" and event["name"] != "root":
                    node_name = event["name"]
                    output = event["data"].get("output")
                    if output:
                        if isinstance(current_state, dict):
                            current_state = BrandingPostState(**current_state)
                        self.states[client_id] = current_state = current_state.copy()
                        await self.active_connections[client_id].send_json({
                            "type": "update",
                            "step": node_name,
                            "data": output
                        })
        except Exception as e:
            logger.exception(f"Error during graph execution for client {client_id}")
            await self.active_connections[client_id].send_json({"type": "error", "message": str(e)})

manager = ConnectionManager()

# --- WebSocket Endpoint ---
@app.websocket("/chat/{client_id}")
async def chat_ws(ws: WebSocket, client_id: str):
    await manager.connect(client_id, ws)
    try:
        while True:
            raw_data = await ws.receive_text()
            message = json.loads(raw_data)

            state_update = {}
            message_type = message.get("type")

            if message_type == "initial_input":
                state_update["user_input"] = message.get("user_input")
                asyncio.create_task(manager.run_graph_part(client_id, state_update))

            elif message_type == "details_input":
                details = message.get("details", {})
                state_update.update({
                    "location": details.get("location"),
                    "price": details.get("price"),
                    "bedrooms": details.get("bedrooms"),
                    "features": [f.strip() for f in details.get("features", "").split(',')],
                    "missing_info": []
                })
                asyncio.create_task(manager.run_graph_part(client_id, state_update))

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"Unhandled error in websocket for client {client_id}: {e}")
        manager.disconnect(client_id)

# --- Root Check ---
@app.get("/")
def root():
    return {"message": "Real Estate AI Assistant Backend is running!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
