# services/facebook_poster.py
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.page import Page
from services.facebook_token_service import token_service
from fastapi import HTTPException
import logging
from datetime import datetime
from typing import Dict, Any
from pymongo.errors import PyMongoError

logger = logging.getLogger(__name__)

class FacebookPoster:
    def __init__(self):
        self.api_version = "v18.0"

    async def _verify_connection(self, agent_id: str) -> Dict[str, Any]:
        """Verifies all required connection exists"""
        try:
            agent = await token_service.db.find_one({"_id": agent_id})
            
            if not agent:
                raise ValueError("Agent not found")
            if 'facebook' not in agent:
                raise ValueError("No Facebook connection found")
            if 'page_id' not in agent['facebook']:
                raise ValueError("No Facebook page selected")
            if 'page_token' not in agent['facebook']:
                raise ValueError("Missing page access token")

            return agent
        except PyMongoError as e:
            logger.error(f"Database error verifying connection: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error")

    async def post_to_page(self, agent_id: str, content: Dict[str, Any]) -> Dict[str, Any]:
        """Posts content to the agent's connected Facebook page"""
        try:
            # Validate content
            if not content.get('text'):
                raise ValueError("Post text is required")
            
            # Verify connection first
            agent = await self._verify_connection(agent_id)
            
            # Get page access token
            page_token = token_service.cipher.decrypt(
                agent['facebook']['page_token']
            ).decode()
            page_id = agent['facebook']['page_id']
            
            # Initialize Facebook SDK
            FacebookAdsApi.init(
                app_id=token_service.app_id,
                app_secret=token_service.app_secret,
                access_token=page_token,
                crash_log=False
            )
            
            # Prepare post parameters
            params = {
                'message': content['text'],
                'published': True
            }
            
            if 'url' in content:
                params['link'] = content['url']
            if 'media_ids' in content:
                params['attached_media'] = content['media_ids']
            
            # Create the post
            result = Page(page_id).create_feed(
                fields=['id', 'post_id', 'created_time'],
                params=params
            )
            
            # Update post in database
            post_data = {
                "id": result.get("id"),
                "text": content['text'],
                "url": f"https://facebook.com/{result.get('post_id')}",
                "created_at": datetime.now()
            }
            
            await token_service.db.update_one(
                {"_id": agent_id},
                {"$push": {"facebook.posts": post_data}}
            )
            
            return {
                "post_id": result.get("id"),
                "url": f"https://facebook.com/{result.get('post_id')}",
                "created_time": result.get("created_time")
            }

        except ValueError as e:
            logger.warning(f"Validation error: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"Facebook posting failed: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500, 
                detail="Failed to post to Facebook page"
            )

# Singleton instance
facebook_poster = FacebookPoster()