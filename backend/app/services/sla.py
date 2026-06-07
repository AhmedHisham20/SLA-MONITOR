from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.conversation import Conversation, SLAStatus, DelayLevel
from app.models.alert import Alert, AlertType, AlertStatus
from app.models.settings import SystemSettings
from app.models.page import FacebookPage
from app.core.config import settings
from app.core.logging import logger


def check_and_update_sla(
    conversation: Conversation,
    db: Session,
    settings_obj: Optional[SystemSettings] = None,
) -> Tuple[bool, Optional[str]]:
    if not settings_obj:
        settings_obj = db.query(SystemSettings).first()

    threshold = (settings_obj.sla_threshold_minutes if settings_obj
                 else settings.SLA_DELAY_THRESHOLD_MINUTES)

    now = datetime.now(timezone.utc)
    elapsed = (now - conversation.message_timestamp).total_seconds() / 60

    if conversation.has_human_reply and conversation.first_reply_timestamp:
        response_time = (conversation.first_reply_timestamp - conversation.message_timestamp).total_seconds()
        conversation.response_time_seconds = int(response_time)
        if response_time <= threshold * 60:
            conversation.sla_status = SLAStatus.COMPLIANT
            conversation.delay_level = DelayLevel.NONE
        else:
            conversation.sla_status = SLAStatus.DELAYED
            determine_delay_level(conversation, elapsed, settings_obj)
        conversation.is_open = False
        db.commit()
        return False, None

    if elapsed >= threshold and not conversation.alert_sent:
        conversation.sla_status = SLAStatus.DELAYED
        determine_delay_level(conversation, elapsed, settings_obj)

        page = db.query(FacebookPage).filter(
            FacebookPage.page_id == conversation.page_id
        ).first()
        page_name = page.page_name if page else conversation.page_id

        alert_body = build_delay_alert_sync(
            page_name=page_name,
            customer_name=conversation.customer_name or conversation.customer_id,
            received_time=conversation.message_timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
            waiting_minutes=int(elapsed),
            conversation_link=conversation.conversation_link,
        )

        conversation.alert_sent = True
        conversation.alert_sent_at = now

        recipient = settings_obj.whatsapp_recipient_number or "not-configured"
        alert = Alert(
            conversation_id=conversation.id,
            alert_type=AlertType.WHATSAPP,
            recipient=recipient,
            message_body=alert_body,
            status=AlertStatus.SENT,
        )
        db.add(alert)
        db.commit()
        return True, alert_body

    if elapsed >= threshold:
        conversation.sla_status = SLAStatus.DELAYED
        determine_delay_level(conversation, elapsed, settings_obj)
        db.commit()

    return False, None


def determine_delay_level(conversation: Conversation, elapsed_minutes: float, settings_obj: SystemSettings):
    admin_threshold = settings_obj.escalation_admin_minutes if settings_obj else 10
    critical_threshold = settings_obj.escalation_critical_minutes if settings_obj else 15
    mod_threshold = settings_obj.sla_threshold_minutes if settings_obj else 5

    if elapsed_minutes >= critical_threshold:
        conversation.delay_level = DelayLevel.CRITICAL
    elif elapsed_minutes >= admin_threshold:
        conversation.delay_level = DelayLevel.ADMIN
    elif elapsed_minutes >= mod_threshold:
        conversation.delay_level = DelayLevel.MODERATOR


def build_delay_alert_sync(
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


def is_automated_message(msg: dict) -> bool:
    if not isinstance(msg, dict):
        return False

    message_data = msg.get("message", {})
    if isinstance(message_data, dict):
        if message_data.get("is_echo") is True:
            return True
        if message_data.get("is_automated") is True:
            return True
        if message_data.get("source") == "business":
            automation_labels = {"automated", "welcome", "away", "instant_reply", "saved"}
            msg_labels = message_data.get("labels", []) or []
            if isinstance(msg_labels, list) and any(
                isinstance(l, str) and l.lower() in automation_labels for l in msg_labels
            ):
                return True

    if msg.get("is_echo") is True:
        return True

    tags = msg.get("tags") or msg.get("tag") or []
    if isinstance(tags, str):
        tags = [tags]
    automated_tags = {
        "automated", "welcome_message", "instant_reply", "away_message",
        "saved_reply", "message_delivery", "business", "customer_channel",
        "messenger_bot", "chatbot", "ai_generated", "automated_response",
    }
    if isinstance(tags, list):
        for tag in tags:
            if isinstance(tag, str) and tag.lower() in automated_tags:
                return True

    app_id = msg.get("app_id")
    if app_id and str(app_id) == "263902037430900":
        return True

    metadata = msg.get("metadata", {}) or {}
    if metadata.get("is_automated") is True:
        return True
    if metadata.get("automation_type") is not None:
        return True

    return False
