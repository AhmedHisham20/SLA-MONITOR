import json
from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.conversation import Conversation, SLAStatus, DelayLevel
from app.models.alert import Alert, AlertType, AlertStatus
from app.models.settings import SystemSettings
from app.models.page import FacebookPage
from app.models.message_event import MessageEvent
from app.core.config import settings as app_settings
from app.core.logging import logger
from app.core.datetime_utils import EGYPT_TZ


def _flag_pending_events_as_exceeded(conversation_id: str, db: Session):
    pending = db.query(MessageEvent).filter(
        MessageEvent.conversation_id == conversation_id,
        MessageEvent.replied_at == None,
    ).all()
    for event in pending:
        event.sla_exceeded = True
    if pending:
        db.commit()


def check_and_update_sla(
    conversation: Conversation,
    db: Session,
    settings_obj: Optional[SystemSettings] = None,
) -> Tuple[bool, Optional[str]]:
    if not settings_obj:
        settings_obj = db.query(SystemSettings).first()

    threshold = (settings_obj.sla_threshold_minutes if settings_obj
                 else app_settings.SLA_DELAY_THRESHOLD_MINUTES)

    now = datetime.now(timezone.utc)
    elapsed = (now - conversation.message_timestamp).total_seconds() / 60

    if conversation.last_sender_type == 'page':
        return False, None

    if elapsed >= threshold and not conversation.alert_sent:
        db.refresh(conversation)
        if conversation.alert_sent:
            return False, None
        conversation.sla_status = SLAStatus.DELAYED
        determine_delay_level(conversation, elapsed, settings_obj)

        _flag_pending_events_as_exceeded(conversation.id, db)

        page = db.query(FacebookPage).filter(
            FacebookPage.page_id == conversation.page_id
        ).first()
        page_name = page.page_name if page else conversation.page_id

        last_msg = None
        if conversation.unanswered_texts:
            try:
                texts = json.loads(conversation.unanswered_texts)
                if isinstance(texts, list) and texts:
                    last_msg = texts[-1]
                elif isinstance(texts, str) and texts:
                    last_msg = texts
            except (json.JSONDecodeError, TypeError):
                pass
        if not last_msg and conversation.message_content:
            last_msg = conversation.message_content

        alert_body = build_delay_alert_sync(
            page_name=page_name,
            customer_name=conversation.customer_name or conversation.customer_id,
            waiting_minutes=int(elapsed),
            customer_message=last_msg,
            received_at=conversation.message_timestamp,
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
        _flag_pending_events_as_exceeded(conversation.id, db)
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
    waiting_minutes: int,
    customer_message: Optional[str],
    received_at: datetime,
    conversation_link: str,
) -> str:
    egypt_time = received_at.astimezone(EGYPT_TZ)
    received_fmt = egypt_time.strftime("%d/%m/%Y %I:%M %p")

    msg = f"\U0001f6a8 SLA Alert\n\n"
    msg += f"Page: {page_name}\n\n"
    msg += f"Customer: {customer_name}\n\n"
    msg += f"Waiting Time: {waiting_minutes} minutes\n\n"
    if customer_message:
        msg += f"Unanswered Customer Message:\n\"{customer_message}\"\n\n"
    msg += f"Received:\n{received_fmt}\n\n"
    msg += f"Open Chat:\n{conversation_link}\n\n"
    msg += f"Dashboard:\n{app_settings.FRONTEND_URL}"
    return msg


def is_automated_message(msg: dict) -> bool:
    if not isinstance(msg, dict):
        return False

    message_data = msg.get("message", {})
    if isinstance(message_data, dict):
        if message_data.get("is_automated") is True:
            return True
        if message_data.get("source") == "business":
            automation_labels = {"automated", "welcome", "away", "instant_reply", "saved"}
            msg_labels = message_data.get("labels", []) or []
            if isinstance(msg_labels, list) and any(
                isinstance(l, str) and l.lower() in automation_labels for l in msg_labels
            ):
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

    metadata = msg.get("metadata", {}) or {}
    if metadata.get("is_automated") is True:
        return True
    if metadata.get("automation_type") is not None:
        return True

    return False
