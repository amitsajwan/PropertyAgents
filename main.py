# main.py
from fastapi import FastAPI, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from routes.facebook.auth_router import router as facebook_auth_router  
import uvicorn
from routes.facebook.posts_router import router as facebook_posts_router
from dotenv import load_dotenv


load_dotenv()

app = FastAPI(title="Real Estate Facebook Integration")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(facebook_auth_router)
app.include_router(facebook_posts_router)
# Make sure you have these imports
from routes.facebook.posts_router import router as posts_router

# And this inclusion
app.include_router(posts_router, prefix="/api")

@app.get("/facebook/status")
async def get_facebook_status(agent_id: str):
    """Enhanced status endpoint with page info"""
    from services.facebook_token_service import token_service
    try:
        await token_service.refresh_token_if_needed(agent_id)
        agent = token_service.db.find_one({"_id": agent_id})
        
        if not agent or 'facebook' not in agent:
            return {"connected": False}
            
        return {
            "connected": True,
            "page_id": agent['facebook'].get('page_id'),
            "page_name": agent['facebook'].get('page_name'),
            "expires_at": agent['facebook'].get('token_expires'),
            "posts": agent['facebook'].get('posts', [])
        }
    except Exception as e:
        return {"connected": False, "error": str(e)}

# Import the new router
from routes.facebook.posts_router import router as posts_router

# Add this before app startup
app.include_router(
    posts_router,
    prefix="/api",  # Now routes will be /api/posts
    tags=["Posts"]
)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)