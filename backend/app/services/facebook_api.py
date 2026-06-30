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
    token_preview = page_access_token[:10] + '...' + page_access_token[-5:] if len(page_access_token) > 15 else 'TOO_SHORT'
    logger.info(f"[FB_DEBUG] ===== GRAPH API CONVERSATIONS REQUEST =====")
    logger.info(f"[FB_DEBUG] URL: {url}")
    logger.info(f"[FB_DEBUG] params (masked): user_id={customer_id}, fields=id,link, access_token={token_preview}")
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url, params=params)
            body = resp.text
            logger.info(f"[FB_DEBUG] HTTP status: {resp.status_code}")
            logger.info(f"[FB_DEBUG] Full response body: {body[:2000]}")
            if resp.status_code != 200:
                logger.error(f"[FB_DEBUG] Graph API conversations error {resp.status_code}: {resp.text[:500]}")
                return None
            data = resp.json()
            convs = data.get("data", [])
            logger.info(f"[FB_DEBUG] Number of conversations returned: {len(convs)}")
            if not convs:
                logger.warning(f"[FB_DEBUG] No conversation found for user {customer_id} on page {page_id}")
                return None
            conv = convs[0]
            conv_id = conv.get("id")
            link = conv.get("link")
            logger.info(f"[FB_DEBUG] First conversation: id={conv_id}, link={'SET' if link else 'NULL'}")
            logger.info(f"[FB_DEBUG] Full first conv object: {json.dumps(conv)}")
            if not link:
                logger.warning(f"[FB_DEBUG] Graph API returned no 'link' field for user {customer_id} on page {page_id}. Full response: {json.dumps(data)}")
                return None
            logger.info(f"[FB_DEBUG] SUCCESS: conversation link = {link}")
            return link
        except Exception as e:
            logger.error(f"[FB_DEBUG] Graph API request failed: {e}")
            return None


async def fetch_customer_name(
    psid: str,
    page_access_token: str,
) -> Optional[str]:
    url = f"{settings.FACEBOOK_GRAPH_API_URL}/{psid}"
    params = {
        "fields": "name",
        "access_token": page_access_token,
    }
    # Mask token for safe logging
    token_preview = page_access_token[:10] + '...' + page_access_token[-5:] if len(page_access_token) > 15 else 'TOO_SHORT'
    logger.info(f"[CUSTOMER_NAME] === REQUEST ===")
    logger.info(f"[CUSTOMER_NAME] Full URL: {url}?fields=name&access_token={token_preview}")
    logger.info(f"[CUSTOMER_NAME] PSID: '{psid}' (length={len(psid)}, digits_only={psid.isdigit()})")
    logger.info(f"[CUSTOMER_NAME] Graph API version: {settings.FACEBOOK_GRAPH_API_VERSION}")
    logger.info(f"[CUSTOMER_NAME] Token mask: {token_preview}")
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url, params=params)
            body = resp.text
            logger.info(f"[CUSTOMER_NAME] === RESPONSE ===")
            logger.info(f"[CUSTOMER_NAME] HTTP status: {resp.status_code}")
            logger.info(f"[CUSTOMER_NAME] Response body: {body[:1000]}")
            if resp.status_code != 200:
                logger.error(f"[CUSTOMER_NAME] Graph API user profile error for PSID='{psid}': status={resp.status_code} body={body[:1000]}")
                return None
            data = resp.json()
            name = data.get("name")
            if name:
                logger.info(f"[CUSTOMER_NAME] SUCCESS: name='{name}' for PSID='{psid}'")
            else:
                logger.warning(f"[CUSTOMER_NAME] API returned OK but no 'name' field for PSID='{psid}'. Full response: {json.dumps(data)}")
            return name
        except Exception as e:
            logger.error(f"[CUSTOMER_NAME] REQUEST FAILED for PSID='{psid}': {e}")
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
        conversation.cached_conversation_link = link
        db.commit()
        logger.info(f"Cached conversation link for {conversation.customer_id}: {link}")
        return True
    logger.info(f"Could not fetch conversation link for user {conversation.customer_id} on page {page.page_id}")
    return False
