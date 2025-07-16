from typing import Optional, List
from pydantic import BaseModel

class BrandingPostState(BaseModel):
    user_input: Optional[str]
    brand_suggestions: Optional[str]
    visual_prompts: Optional[str]
    image_path: Optional[str]
    location: Optional[str]
    price: Optional[str]
    bedrooms: Optional[str]
    features: Optional[List[str]]
    base_post: Optional[str]
    post_result: Optional[dict]

    def has_required_info(self):
        return all([self.location, self.price, self.bedrooms, self.features])
