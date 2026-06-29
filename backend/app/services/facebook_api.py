import httpx
import json
from typing import Optional
from sqlalchemy.orm import Session
from app.models.conversation import Conversation
from app.models.page import FacebookPage
from app.core.config import settings
from app.core.logging import logger


async def fetch_conversation_link(
    page_id: str,
    page_access_token: str,
    customer_id: str,
) -> Optional[str]:
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
                return None
            data = resp.json()
            convs = data.get("data", [])
            if not convs:
                logger.warning(f"No conversation found for user {customer_id} on page {page_id}")
                return None
            conv = convs[0]
            link = conv.get("link")
            if not link:
                logger.warning(f"Graph API returned no 'link' field for user {customer_id} on page {page_id}. Full response: {json.dumps(data)}")
                return None
            return link
        except Exception as e:
            logger.error(f"Graph API request failed: {e}")
            return None


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
    link = await fetch_conversation_link(
        page.page_id, page.access_token, conversation.customer_id
    )
    if link:
        conversation.conversation_link = link
        db.commit()
        logger.info(f"Cached conversation link for {conversation.customer_id}: {link}")
        return True
    logger.info(f"Could not fetch conversation link for user {conversation.customer_id} on page {page.page_id}")
    return False
