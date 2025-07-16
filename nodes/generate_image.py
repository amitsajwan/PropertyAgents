from langchain_core.tools import tool
from schema import BrandingPostState
from utils import generate_image_from_prompt
import logging

logger = logging.getLogger(__name__)

@tool
def generate_image_node(state: BrandingPostState) -> BrandingPostState:
    logger.info("Node: generate_image (via Hugging Face SDXL API)")
    logger.info(f"Incoming state: {state.dict()}")
    image_path = generate_image_from_prompt(state.visual_prompts, state.client_id)
    logger.info(f"Image saved to {image_path}")
    state.image_path = image_path
    return state