# routes/facebook/posts_router.py
from fastapi import APIRouter, Form, UploadFile, File, HTTPException
from services.facebook_poster import facebook_poster
from typing import List, Optional
import logging
import os
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

# Image upload configuration
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def validate_image(file: UploadFile):
    """Validates an image file"""
    # Check extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"File type {ext} not allowed. Use: {ALLOWED_EXTENSIONS}")
    
    # Check size
    if file.size > MAX_FILE_SIZE:
        raise ValueError(f"File too large. Max size: {MAX_FILE_SIZE/1024/1024}MB")

@router.post("/posts")
async def create_post(
    agent_id: str = Form(...),
    text: str = Form(...),
    url: Optional[str] = Form(None),
    images: Optional[List[UploadFile]] = File(None),
):
    """Endpoint for creating Facebook posts"""
    try:
        content = {"text": text}
        if url:
            content["url"] = url
        
        # Handle image uploads
        if images:
            media_ids = []
            for image in images:
                validate_image(image)
                
                # Save file locally (in production, upload to S3/CDN)
                file_ext = os.path.splitext(image.filename)[1]
                filename = f"{datetime.now().timestamp()}{file_ext}"
                filepath = os.path.join(UPLOAD_DIR, filename)
                
                with open(filepath, "wb") as buffer:
                    buffer.write(await image.read())
                
                # In a real implementation, you would:
                # 1. Upload to CDN
                # 2. Get media ID from Facebook API
                # For now we'll just store the local path
                media_ids.append({"image_hash": filename})
            
            content["media_ids"] = media_ids
        
        result = await facebook_poster.post_to_page(agent_id, content)
        return {
            "status": "success",
            "data": result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Post creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))