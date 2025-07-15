import logging
import os
from dotenv import load_dotenv
from typing import Optional, List, TypedDict
from fastapi import WebSocket
from langgraph.graph import StateGraph, END
from langchain_core.runnables import Runnable, RunnableLambda, RunnableConfig
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_groq import ChatGroq
import requests
import shutil

# --- Load Environment Variables ---
load_dotenv()

# --- Initialize Logger ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Initialize LLM (Groq) ---
# Make sure to set GROQ_API_KEY in your .env file
try:
    llm = ChatGroq(model="llama3-70b-8192", temperature=0.4)
except Exception as e:
    logger.error(f"Failed to initialize ChatGroq. Ensure GROQ_API_KEY is set. Error: {e}")
    llm = None # Handle case where LLM fails to load

# --- Import the Facebook posting function ---
from post_to_facebook_with_image import post_to_facebook

# --- Define State Schema for the LangGraph workflow ---
class BrandingPostState(TypedDict):
    user_input: Optional[str]
    brand_suggestions: Optional[str]
    visual_prompts: Optional[str]
    image_path: Optional[str]
    location: Optional[str]
    price: Optional[str]
    bedrooms: Optional[str]
    features: List[str]
    base_post: Optional[str]
    missing_info: List[str]
    post_result: Optional[dict]
    # For WebSocket communication
    websocket: Optional[WebSocket]
    client_id: Optional[str]

# --- Utility for sending messages over WebSocket ---
async def send_ws_message(config: RunnableConfig, message: dict):
    """Helper to send a message back to the client via WebSocket."""
    state = config["configurable"]
    ws = state.get("websocket")
    if ws:
        await ws.send_json(message)

# --- Graph Nodes ---

def create_branding_node(state: BrandingPostState) -> dict:
    """Generates brand names and slogans."""
    logger.info("Node: create_branding")
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You're an expert real estate marketer. Generate 3 distinct brand names and slogans for a real estate project based on the user's idea. Provide a brief rationale for each. Format as Markdown."),
        ("user", "Business Idea: {user_input}")
    ])
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke({"user_input": state["user_input"]})
    return {"brand_suggestions": result.strip()}

def create_visual_prompt_node(state: BrandingPostState) -> dict:
    """Generates a prompt for a logo or cover image."""
    logger.info("Node: create_visuals")
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a creative director. Based on the following branding concepts, write a single, detailed, and effective prompt for an AI image generator to create a stunning, photorealistic marketing visual. The image should be modern, high-end, and appealing."),
        ("user", "Branding Concepts:\n{brand_suggestions}")
    ])
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke({"brand_suggestions": state["brand_suggestions"]})
    return {"visual_prompts": result.strip()}

def generate_image_node(state: BrandingPostState) -> dict:
    """
    Generates an image based on the prompt.
    
    NOTE: This is a SIMULATED function. Replace the logic inside with a call
    to a real image generation API like DALL-E 3, Midjourney, or Imagen.
    """
    logger.info("Node: generate_image")
    prompt = state["visual_prompts"]
    
    # --- SIMULATION LOGIC ---
    # In a real application, you would call an image generation API here.
    # For example: `image_bytes = dall_e_api.generate(prompt)`
    # Then save the bytes to a file.
    
    # For now, we'll just copy a placeholder image.
    image_dir = "generated_images"
    os.makedirs(image_dir, exist_ok=True)
    placeholder_src = "placeholder.png" # Make sure you have this image in your root directory
    
    if not os.path.exists(placeholder_src):
        # Create a dummy placeholder if it doesn't exist
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new('RGB', (1024, 1024), color = (200, 200, 200))
        d = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("arial.ttf", 40)
        except IOError:
            font = ImageFont.load_default()
        d.text((10,10), "Placeholder Image\nReplace with Real API", fill=(0,0,0), font=font)
        img.save(placeholder_src)


    image_path = os.path.join(image_dir, f"{state['client_id']}_image.png")
    shutil.copy(placeholder_src, image_path)
    logger.info(f"Simulated image generation. Saved to {image_path}")
    
    return {"image_path": image_path}


def check_requirements_for_post_node(state: BrandingPostState) -> dict:
    """Checks if we have enough data to generate the post."""
    logger.info("Node: check_requirements")
    missing = []
    if not state.get("location"): missing.append("location")
    if not state.get("price"): missing.append("price")
    if not state.get("bedrooms"): missing.append("bedrooms")
    if not state.get("features"): missing.append("features")
    
    return {"missing_info": missing}

def generate_post_node(state: BrandingPostState) -> dict:
    """Generates the final Facebook post content."""
    logger.info("Node: generate_post")
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You're a world-class real estate copywriter. Write a catchy, emoji-rich Facebook post using the provided details. Include relevant hashtags and a strong call to action."),
        ("user", "Property in {location}, priced at {price}, with {bedrooms} bedrooms and features: {features}. Use these branding ideas: {brand_suggestions}")
    ])
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke({
        "location": state["location"],
        "price": state["price"],
        "bedrooms": state["bedrooms"],
        "features": ", ".join(state["features"]),
        "brand_suggestions": state["brand_suggestions"]
    })
    return {"base_post": result.strip()}

def post_to_facebook_node(state: BrandingPostState) -> dict:
    """Posts the content and image to Facebook."""
    logger.info("Node: post_to_facebook")
    caption = state["base_post"]
    image_path = state["image_path"]

    # This calls the function from your original file.
    # NOTE: This is a real post! Ensure your .env variables are correct.
    # For testing, you might want to comment this out.
    result = post_to_facebook(caption=caption, image_path=image_path)
    logger.info(f"Facebook post result: {result}")
    
    return {"post_result": result}

# --- Conditional Edges ---

def decide_after_requirements(state: BrandingPostState) -> str:
    """Decides the next step after checking for property details."""
    if state.get("missing_info"):
        logger.info("Decision: Missing info. Pausing for user input.")
        return "pause_for_input"  # A dummy node to signify a pause
    else:
        logger.info("Decision: All info present. Generating post.")
        return "generate_post"

# --- Build the Graph ---

def build_graph():
    if not llm:
        raise ValueError("LLM not initialized. Cannot build graph.")

    builder = StateGraph(BrandingPostState)

    # Add nodes
    builder.add_node("create_branding", create_branding_node)
    builder.add_node("create_visuals", create_visual_prompt_node)
    builder.add_node("generate_image", generate_image_node)
    builder.add_node("check_requirements", check_requirements_for_post_node)
    builder.add_node("generate_post", generate_post_node)
    builder.add_node("post_to_facebook", post_to_facebook_node)
    
    # A dummy node for clarity when we need to wait for user input
    builder.add_node("pause_for_input", lambda state: {})

    # Define the workflow edges
    builder.set_entry_point("create_branding")
    builder.add_edge("create_branding", "create_visuals")
    builder.add_edge("create_visuals", "generate_image")
    builder.add_edge("generate_image", "check_requirements")
    
    # Conditional edge: after checking requirements, either generate post or pause
    builder.add_conditional_edges(
        "check_requirements",
        decide_after_requirements,
        {
            "generate_post": "generate_post",
            "pause_for_input": "pause_for_input"
        }
    )
    
    # This edge will be triggered manually from the server after user provides details
    builder.add_edge("pause_for_input", "generate_post")

    builder.add_edge("generate_post", "post_to_facebook")
    builder.add_edge("post_to_facebook", END)

    return builder.compile()
