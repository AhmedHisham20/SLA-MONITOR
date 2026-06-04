import httpx
from typing import Optional
from app.core.config import settings
from app.core.logging import logger


async def send_whatsapp_message(
    to: str,
    message: str,
    phone_number_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> bool:
    pn_id = phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID
    token = access_token or settings.WHATSAPP_ACCESS_TOKEN

    if not pn_id or not token:
        logger.error("WhatsApp not configured: missing phone_number_id or access_token")
        return False

    url = f"{settings.WHATSAPP_API_URL}/{pn_id}/messages"

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"body": message},
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code in [200, 201]:
                result = response.json()
                logger.info(f"WhatsApp API response: {result}")
                return True
            else:
                logger.error(f"WhatsApp API error: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.error(f"WhatsApp request failed: {str(e)}")
            return False


async def build_delay_alert(
    page_name: str,
    customer_name: str,
    received_time: str,
    waiting_minutes: int,
    conversation_link: str,
) -> str:
    return (
        f"\U0001f6a8 Delayed Reply Alert\n"
        f"Page Name: {page_name}\n"
        f"Customer Name: {customer_name}\n"
        f"Received At: {received_time}\n"
        f"Current Delay: {waiting_minutes} Minutes\n"
        f"Conversation Link: {conversation_link}"
    )


async def build_daily_summary(
    total_messages: int,
    avg_response_time: str,
    delayed_count: int,
    sla_compliance: float,
) -> str:
    return (
        f"\U0001f4ca Daily Performance Report\n"
        f"Messages: {total_messages}\n"
        f"Average Response Time: {avg_response_time}\n"
        f"Delayed Conversations: {delayed_count}\n"
        f"SLA Compliance: {sla_compliance:.1f}%"
    )
