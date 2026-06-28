import httpx
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.conversation import Conversation
from app.models.page import FacebookPage
from app.core.config import settings
from app.core.logging import logger


async def fetch_conversation_by_user_id(
    page_id: str,
    page_access_token: str,
    customer_id: str,
) -> Tuple[Optional[str], Optional[str]]:
    url = f"{settings.FACEBOOK_GRAPH_API_URL}/{page_id}/conversations"
    params = {
        "user_id": customer_id,
        "fields": "id,link",
        "access_token": page_access_token,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                logger.error(f"Graph API conversations error {resp.status_code}: {resp.text[:200]}")
                return None, None
            data = resp.json()
            convs = data.get("data", [])
            if not convs:
                logger.warning(f"No conversation found for user {customer_id} on page {page_id}")
                return None, None
            conv = convs[0]
            conv_id = conv.get("id")
            conv_link = conv.get("link")
            return conv_id, conv_link
        except Exception as e:
            logger.error(f"Graph API request failed: {e}")
            return None, None


async def fetch_and_cache_conversation_link(
    conversation: Conversation,
    page: FacebookPage,
    db: Session,
) -> bool:
    if not page.access_token:
        logger.warning(f"No access token for page {page.page_id}, cannot fetch conversation link")
        return False
    if not conversation.customer_id:
        return False
    conv_id, conv_link = await fetch_conversation_by_user_id(
        page.page_id, page.access_token, conversation.customer_id
    )
    updated = False
    if conv_link:
        conversation.facebook_link = conv_link
        updated = True
    if conv_id:
        conversation.conversation_id = conv_id
        updated = True
    if updated:
        db.commit()
        logger.info(f"Cached conversation link for {conversation.customer_id}: {conv_link}")
    return updated
