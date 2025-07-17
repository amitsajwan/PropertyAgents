# # tests/test_facebook_posting.py
# async def test_facebook_post():
#     test_agent = {
#         "_id": "test_agent_123",
#         "facebook": {
#             "token": "valid_test_token",
#             "page_id": "test_page_123"
#         }
#     }
    
#     with patch('facebook_business.api.FacebookAdsApi.init'), \
#          patch('facebook_business.adobjects.page.Page.create_feed') as mock_post:
        
#         mock_post.return_value = {"id": "post_123"}
#         result = await facebook_poster.post_to_page(test_agent["_id"], {
#             "text": "Test property listing",
#             "url": "https://example.com/listings/123"
#         })
        
#         assert result['post_id'] == "post_123"