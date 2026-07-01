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

        # Collect all unanswered messages with timestamps
        unanswered_events = db.query(MessageEvent).filter(
            MessageEvent.conversation_id == conversation.id,
            MessageEvent.replied_at == None,
            MessageEvent.message_text != None,
            MessageEvent.message_text != '',
        ).order_by(MessageEvent.received_at.asc()).all()

        unanswered_messages = [(e.message_text, e.received_at) for e in unanswered_events]

        # Fallback: if no MessageEvent rows exist, try unanswered_texts
        if not unanswered_messages and conversation.unanswered_texts:
            try:
                texts = json.loads(conversation.unanswered_texts)
                if isinstance(texts, list) and texts:
                    for t in texts:
                        if isinstance(t, str) and t.strip():
                            unanswered_messages.append((t, conversation.message_timestamp))
                elif isinstance(texts, str) and texts.strip():
                    unanswered_messages.append((texts, conversation.message_timestamp))
            except (json.JSONDecodeError, TypeError):
                pass

        # Calculate display waiting time from oldest unanswered message
        display_waiting_minutes = int(elapsed)
        if unanswered_messages:
            oldest_ts = unanswered_messages[0][1]
            display_waiting_minutes = int((now - oldest_ts).total_seconds() / 60)

        page = db.query(FacebookPage).filter(
            FacebookPage.page_id == conversation.page_id
        ).first()
        page_name = page.page_name if page else conversation.page_id

        alert_body = build_delay_alert_sync(
            page_name=page_name,
            customer_id=conversation.customer_id,
            waiting_minutes=display_waiting_minutes,
            unanswered_messages=unanswered_messages,
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
    customer_id: str,
    waiting_minutes: int,
    unanswered_messages: list[tuple[str, datetime]],
) -> str:
    msg = f"\U0001f6a8 Messenger SLA Alert\n\n"
    msg += f"\U0001f4c4 Page:\n{page_name}\n\n"
    msg += f"\U0001f464 Customer ID:\n{customer_id}\n\n"
    msg += f"\U0001f552 Waiting Time:\n{waiting_minutes} minutes\n\n"

    if unanswered_messages:
        first_ts = unanswered_messages[0][1]
        egypt_first = first_ts.astimezone(EGYPT_TZ)
        received_fmt = egypt_first.strftime("%d/%m/%Y %I:%M %p")
        msg += f"\U0001f4c5 First Message Received:\n{received_fmt}\n"
        msg += f"(Egypt Time)\n\n"

    msg += f"\u2501" * 18 + "\n\n"

    if unanswered_messages:
        msg += f"\U0001f4ac Unanswered Messages\n\n"
        for i, (text, ts) in enumerate(unanswered_messages, start=1):
            egypt_ts = ts.astimezone(EGYPT_TZ)
            ts_fmt = egypt_ts.strftime("%d/%m/%Y %I:%M %p")
            msg += f"{i}.\n{ts_fmt}\n{text}\n\n"

    msg += f"\u2501" * 18 + "\n\n"

    msg += f"\U0001f310 Open Meta Business Inbox\n\n"
    msg += f"https://business.facebook.com/latest/inbox\n\n"

    msg += f"\u2501" * 18 + "\n\n"

    msg += f"\U0001f4ca Dashboard\n\n"
    msg += f"{app_settings.FRONTEND_URL}/dashboard"
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
