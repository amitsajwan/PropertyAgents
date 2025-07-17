# services/facebook_token_service.py
import os
import requests
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from pymongo import MongoClient
from fastapi import HTTPException
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class FacebookTokenService:
    def __init__(self):
        self.app_id = os.getenv('FB_APP_ID')
        self.app_secret = os.getenv('FB_APP_SECRET')
        self.redirect_uri = os.getenv('FB_REDIRECT_URI')
        self.encryption_key = os.getenv('ENCRYPTION_KEY')
        
        if not all([self.app_id, self.app_secret, self.encryption_key]):
            raise ValueError("Missing Facebook API credentials")
            
        self.cipher = Fernet(self.encryption_key.encode())
        self.db = MongoClient(os.getenv('MONGO_URI')).real_estate.agents

    async def exchange_code_for_token(self, code: str, agent_id: str) -> dict:
        """Handles the OAuth callback from Facebook"""
        try:
            # Step 1: Get short-lived token
            token_url = (
                f"https://graph.facebook.com/v18.0/oauth/access_token?"
                f"client_id={self.app_id}&"
                f"redirect_uri={self.redirect_uri}&"
                f"client_secret={self.app_secret}&"
                f"code={code}"
            )
            response = requests.get(token_url)
            response.raise_for_status()
            short_token = response.json()['access_token']

            # Step 2: Convert to long-lived token
            long_token_url = (
                f"https://graph.facebook.com/v18.0/oauth/access_token?"
                f"grant_type=fb_exchange_token&"
                f"client_id={self.app_id}&"
                f"client_secret={self.app_secret}&"
                f"fb_exchange_token={short_token}"
            )
            long_response = requests.get(long_token_url)
            long_response.raise_for_status()
            token_data = long_response.json()

            # Encrypt and store
            encrypted_token = self.cipher.encrypt(token_data['access_token'].encode())
            expires_at = datetime.now() + timedelta(seconds=token_data.get('expires_in', 5184000))

            self.db.update_one(
                {"_id": agent_id},
                {"$set": {
                    "facebook.user_token": encrypted_token,
                    "facebook.token_expires": expires_at,
                    "facebook.last_updated": datetime.now()
                }},
                upsert=True
            )

            return {
                "status": "success",
                "encrypted_token": encrypted_token.decode(),
                "expires_at": expires_at.isoformat()
            }

        except Exception as e:
            logger.error(f"Token exchange failed: {str(e)}")
            raise HTTPException(status_code=400, detail="Facebook token exchange failed")

    async def refresh_token_if_needed(self, agent_id: str) -> bool:
        """Checks and refreshes token if expiring soon"""
        agent = self.db.find_one({"_id": agent_id})
        if not agent or 'facebook' not in agent:
            return False

        expires_at = agent['facebook']['token_expires']
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)

        if (expires_at - datetime.now()).days < 7:
            try:
                token = self.cipher.decrypt(agent['facebook']['user_token']).decode()
                new_token = requests.get(
                    f"https://graph.facebook.com/v18.0/oauth/access_token?"
                    f"grant_type=fb_exchange_token&"
                    f"client_id={self.app_id}&"
                    f"client_secret={self.app_secret}&"
                    f"fb_exchange_token={token}"
                ).json()
                
                self.db.update_one(
                    {"_id": agent_id},
                    {"$set": {
                        "facebook.user_token": self.cipher.encrypt(new_token['access_token'].encode()),
                        "facebook.token_expires": datetime.now() + timedelta(seconds=new_token['expires_in'])
                    }}
                )
                return True
            except Exception as e:
                logger.error(f"Token refresh failed: {str(e)}")
        return False

    async def get_valid_token(self, agent_id: str) -> str:
        """Retrieves page token for API calls"""
        await self.refresh_token_if_needed(agent_id)
        agent = self.db.find_one({"_id": agent_id})
        
        if not agent or 'facebook' not in agent or 'page_token' not in agent['facebook']:
            raise HTTPException(status_code=404, detail="No Facebook page connected")

        try:
            return self.cipher.decrypt(agent['facebook']['page_token']).decode()
        except Exception as e:
            logger.error(f"Token decryption failed: {str(e)}")
            raise HTTPException(status_code=500, detail="Token decryption error")

    async def disconnect_facebook(self, agent_id: str) -> bool:
        """Revokes Facebook access"""
        try:
            agent = self.db.find_one({"_id": agent_id})
            if agent and 'facebook' in agent:
                # Revoke user token
                if 'user_token' in agent['facebook']:
                    user_token = self.cipher.decrypt(agent['facebook']['user_token']).decode()
                    requests.delete(
                        f"https://graph.facebook.com/v18.0/me/permissions",
                        params={"access_token": user_token}
                    )
                
                # Remove all Facebook data
                self.db.update_one(
                    {"_id": agent_id},
                    {"$unset": {"facebook": ""}}
                )
            return True
        except Exception as e:
            logger.error(f"Disconnection failed: {str(e)}")
            return False
        
# services/facebook_token_service.py
async def get_connection_status(self, agent_id: str):
    """Safe method to get connection status"""
    try:
        agent = self.db.find_one({"_id": agent_id})
        if not agent:
            return {"status": "agent_not_found"}
            
        fb_data = agent.get('facebook', {})
        
        if not fb_data:
            return {"status": "disconnected"}
            
        if not fb_data.get('page_id'):
            return {"status": "no_page_selected"}
            
        if not fb_data.get('page_token'):
            return {"status": "missing_token"}
            
        return {
            "status": "connected",
            "page_id": fb_data['page_id'],
            "page_name": fb_data.get('page_name')
        }
        
    except Exception as e:
        logger.error(f"Connection check failed: {str(e)}")
        return {"status": "error", "detail": str(e)}

token_service = FacebookTokenService()