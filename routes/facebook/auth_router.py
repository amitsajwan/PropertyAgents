# routes/facebook/auth_router.py
from fastapi import APIRouter, Request, Query, Form, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from services.facebook_token_service import token_service
import requests
import logging
from datetime import datetime
from typing import List, Dict, Any
from pymongo.errors import PyMongoError

router = APIRouter(prefix="/facebook", tags=["Facebook"])
logger = logging.getLogger(__name__)

@router.get("/connect")
async def start_facebook_auth(agent_id: str):
    """Initiates the Facebook OAuth flow"""
    try:
        if not agent_id:
            raise ValueError("Agent ID is required")
            
        return RedirectResponse(
            f"https://www.facebook.com/v18.0/dialog/oauth?"
            f"client_id={token_service.app_id}&"
            f"redirect_uri={token_service.redirect_uri}&"
            f"state={agent_id}&"
            f"scope=pages_manage_posts,pages_read_engagement"
        )
    except Exception as e:
        logger.error(f"Auth initiation failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/callback")
async def handle_facebook_callback(
    code: str = Query(..., min_length=10),
    state: str = Query(..., min_length=1)
) -> Dict[str, Any]:
    """Handles the Facebook OAuth callback"""
    try:
        if not code or not state:
            raise ValueError("Missing required parameters")
            
        # Exchange code for token
        token_result = await token_service.exchange_code_for_token(code, state)
        access_token = token_service.cipher.decrypt(
            token_result['encrypted_token']
        ).decode()
        
        # Get user's pages
        pages = await get_facebook_pages(access_token)
        
        if not pages:
            raise HTTPException(
                status_code=400,
                detail="No Facebook pages found with required permissions"
            )
            
        return {
            "status": "success",
            "token_data": token_result,
            "pages": pages
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Callback failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail="Facebook authentication failed")

async def get_facebook_pages(access_token: str) -> List[Dict[str, Any]]:
    """Fetch pages the user can manage"""
    try:
        response = requests.get(
            f"https://graph.facebook.com/v18.0/me/accounts",
            params={"access_token": access_token},
            timeout=10
        )
        response.raise_for_status()
        
        return [
            {
                "id": page["id"],
                "name": page["name"],
                "access_token": page["access_token"]
            }
            for page in response.json().get('data', [])
        ]
    except Exception as e:
        logger.error(f"Failed to get pages: {str(e)}")
        return []

@router.post("/select-page")
async def select_page(
    page_id: str = Form(..., min_length=5),
    page_name: str = Form(..., min_length=1),
    page_token: str = Form(..., min_length=10),
    agent_id: str = Form(..., min_length=1)
) -> Dict[str, Any]:
    try:
        # Validate inputs
        if not all([page_id, page_name, page_token, agent_id]):
            raise ValueError("All fields are required")
            
        # Encrypt page token
        encrypted_page_token = token_service.cipher.encrypt(page_token.encode())
        
        # Update database with page info
        result = await token_service.db.update_one(
            {"_id": agent_id},
            {"$set": {
                "facebook.page_id": page_id,
                "facebook.page_name": page_name,
                "facebook.page_token": encrypted_page_token,
                "facebook.connected_at": datetime.now()
            }}
        )
        
        if not result.modified_count:
            raise HTTPException(status_code=404, detail="Agent not found")
            
        return {
            "status": "success",
            "page_id": page_id,
            "page_name": page_name
        }
    except PyMongoError as e:
        logger.error(f"Database error selecting page: {str(e)}")
        raise HTTPException(status_code=500, detail="Database operation failed")
    except Exception as e:
        logger.error(f"Page selection failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/disconnect")
async def disconnect_facebook(agent_id: str = Form(..., min_length=1)) -> Dict[str, str]:
    """Revokes Facebook access"""
    try:
        success = await token_service.disconnect_facebook(agent_id)
        return {"status": "success" if success else "error"}
    except Exception as e:
        logger.error(f"Disconnect failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to disconnect Facebook")

@router.get("/verify-connection/{agent_id}")
async def verify_connection(agent_id: str) -> Dict[str, Any]:
    """Verify if agent has a connected Facebook page"""
    try:
        # Verify agent exists
        agent = token_service.db.find_one({"_id": agent_id})
        if not agent:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "detail": "Agent not found"}
            )

        # Check Facebook connection
        if 'facebook' not in agent:
            return {
                "status": "disconnected",
                "detail": "No Facebook connection found"
            }

        # Check page selection
        if 'page_id' not in agent['facebook']:
            return {
                "status": "no_page_selected",
                "detail": "Connected but no page selected"
            }

        # Verify token exists
        if 'page_token' not in agent['facebook']:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "detail": "Missing page access token"
                }
            )

        # Return success
        return {
            "status": "connected",
            "page_id": agent['facebook']['page_id'],
            "page_name": agent['facebook'].get('page_name'),
            "connected_at": agent['facebook'].get('connected_at')
        }

    except PyMongoError as e:
        logger.error(f"Database error verifying connection: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        logger.error(f"Connection verification failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during verification"
        )