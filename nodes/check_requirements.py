from langchain_core.tools import tool
from schema import BrandingPostState

from utils import generate_image_from_prompt
import logging 
@tool

def route_after_check_requirements(state: BrandingPostState) -> str:
    """
    Determines whether to pause for input or proceed to generate_post based on missing info.
    """
    return "generate_post" if state.has_required_info() else "pause_for_input"
