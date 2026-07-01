import httpx
from datetime import datetime, timezone
from typing import Optional, Tuple
from app.core.config import settings
from app.core.logging import logger


async def validate_whatsapp_token(
    phone_number_id: str,
    access_token: str,
) -> Tuple[bool, Optional[int], Optional[str], Optional[str]]:
    url = f"{settings.WHATSAPP_API_URL}/{phone_number_id}"
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                logger.info(
                    f"Token validation | Valid: True | Status: {response.status_code} | "
                    f"Error code: N/A | Error message: N/A"
                )
                return True, response.status_code, None, None
            else:
                error_code = None
                error_message = response.text
                try:
                    err_body = response.json()
                    error_data = err_body.get("error", {})
                    error_code = error_data.get("code")
                    error_message = error_data.get("message", response.text)
                except Exception:
                    pass
                logger.error(
                    f"Token validation | Valid: False | Status: {response.status_code} | "
                    f"Error code: {error_code} | Error message: {error_message}"
                )
                return False, response.status_code, str(error_code), error_message
    except Exception as e:
        logger.exception(
            f"Token validation | Valid: False | Status: N/A | "
            f"Error code: N/A | Error message: {str(e)}"
        )
        return False, None, None, str(e)


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

    # Validate token before sending
    await validate_whatsapp_token(pn_id, token)

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
                logger.info(
                    f"Send request | Timestamp: {datetime.now(timezone.utc).isoformat()} | "
                    f"Recipient: {to} | Phone Number ID: {pn_id} | "
                    f"Response status: {response.status_code} | "
                    f"Response body: {result} | "
                    f"Success: True"
                )
                return True
            else:
                fb_error = ""
                try:
                    err_body = response.json()
                    error_data = err_body.get("error", {})
                    fb_error = error_data.get("message", response.text)
                except Exception:
                    fb_error = response.text
                logger.error(
                    f"Send request | Timestamp: {datetime.now(timezone.utc).isoformat()} | "
                    f"Recipient: {to} | Phone Number ID: {pn_id} | "
                    f"Response status: {response.status_code} | "
                    f"Response body: {response.text} | "
                    f"Success: False"
                )
                return False
        except Exception:
            logger.exception(
                f"Send request | Timestamp: {datetime.now(timezone.utc).isoformat()} | "
                f"Recipient: {to} | Phone Number ID: {pn_id} | "
                f"Response status: N/A | "
                f"Response body: N/A | "
                f"Success: False"
            )
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
