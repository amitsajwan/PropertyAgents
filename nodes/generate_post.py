from langchain_core.tools import tool
@tool
def generate_post_node(state): return {'base_post': 'This is a sample real estate post'}