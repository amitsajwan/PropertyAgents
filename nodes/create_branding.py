from langchain_core.tools import tool
@tool
def create_branding_node(state): return {'brand_suggestions': 'Brand X, Brand Y'}