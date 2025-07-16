from langchain_core.tools import tool
@tool
def post_to_facebook_node(state): return {'post_result': {'status': 'Posted'}}