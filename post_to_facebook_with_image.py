import os
import requests
from dotenv import load_dotenv

load_dotenv()

FB_PAGE_ID = os.getenv("FB_PAGE_ID")
FB_PAGE_ACCESS_TOKEN = os.getenv("FB_PAGE_ACCESS_TOKEN")

def post_to_facebook(caption: str, image_path: str):
    """
    Posts a photo with a caption to a Facebook Page.
    """
    try:
        if not all([FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN]):
            return {"status": "error", "message": "Facebook credentials (FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN) not set in .env file."}
        
        if not os.path.exists(image_path):
            return {"status": "error", "message": f"Image not found at path: {image_path}"}

        post_url = f"https://graph.facebook.com/v18.0/{FB_PAGE_ID}/photos"

        with open(image_path, "rb") as image_file:
            files = {"source": image_file}
            data = {"caption": caption, "access_token": FB_PAGE_ACCESS_TOKEN}
            
            response = requests.post(post_url, files=files, data=data)
            result = response.json()

        if "id" in result:
            return {
                "status": "success",
                "message": "✅ Posted successfully to Facebook!",
                "post_id": result["id"]
            }
        else:
            return {
                "status": "error",
                "message": "❌ Failed to post to Facebook.",
                "details": result.get("error", "No error details provided.")
            }

    except Exception as e:
        return {"status": "error", "message": str(e)}
