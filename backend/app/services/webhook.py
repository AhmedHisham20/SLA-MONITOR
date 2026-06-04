from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.conversation import Conversation, SLAStatus
from app.models.page import FacebookPage
from app.models.settings import SystemSettings
from app.core.logging import logger
from app.services.sla import check_and_update_sla, is_automated_message


async def process_webhook_event(entry: dict, db: Session):
    try:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})

            if "conversations" not in value and "messages" not in value:
                continue

            page_id = value.get("page_id") or entry.get("id")
            page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
            if not page:
                page = FacebookPage(
                    page_id=page_id,
                    page_name=value.get("page_name", f"Page {page_id}"),
                    is_connected=True,
                )
                db.add(page)
                db.commit()

            page.last_webhook_activity = datetime.now(timezone.utc)
            db.commit()

            if not page.monitoring_enabled:
                logger.info(f"Skipping SLA for page {page.page_name} - monitoring disabled")
                continue

            messages = value.get("messages", [])
            for msg in messages:
                await process_message(msg, page, value, db)

    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")


async def process_message(msg: dict, page: FacebookPage, value: dict, db: Session):
    from_id = msg.get("from", {})
    if isinstance(from_id, dict):
        sender_id = from_id.get("id", "")
        sender_name = from_id.get("name", "")
    else:
        sender_id = str(from_id)
        sender_name = value.get("participants", [{}])[0].get("name", "") if value.get("participants") else ""

    conversation_id = (
        msg.get("conversation", {}).get("id")
        or value.get("conversation_id")
        or f"conv_{msg.get('message_id', 'unknown')}"
    )

    message_text = ""
    if "message" in msg:
        message_text = msg["message"].get("text", "") if isinstance(msg["message"], dict) else str(msg["message"])

    timestamp = msg.get("timestamp", msg.get("created_time"))
    if isinstance(timestamp, (int, float)):
        message_time = datetime.fromtimestamp(timestamp, tz=timezone.utc)
    elif isinstance(timestamp, str):
        try:
            message_time = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            message_time = datetime.now(timezone.utc)
    else:
        message_time = datetime.now(timezone.utc)

    existing = db.query(Conversation).filter(
        Conversation.conversation_id == conversation_id,
        Conversation.customer_id == sender_id,
    ).first()

    is_page_sender = (sender_id == page.page_id)

    if existing:
        existing.message_count = (existing.message_count or 0) + 1

        if is_page_sender:
            is_automated = is_automated_message(msg)

            if is_automated:
                existing.has_automated_reply = True
                existing.automated_message_count = (existing.automated_message_count or 0) + 1
                db.commit()
                return

            if not existing.has_human_reply:
                existing.first_reply_timestamp = message_time
                existing.has_human_reply = True
                existing.moderator_name = sender_name or existing.moderator_name
                response_time = (message_time - existing.message_timestamp).total_seconds()
                existing.response_time_seconds = int(response_time)
                existing.is_open = False

                threshold = 5
                settings_obj = db.query(SystemSettings).first()
                if settings_obj:
                    threshold = settings_obj.sla_threshold_minutes

                if response_time <= threshold * 60:
                    existing.sla_status = SLAStatus.COMPLIANT
                else:
                    existing.sla_status = SLAStatus.DELAYED

        db.commit()
        return

    if is_page_sender:
        return

    conversation = Conversation(
        page_id=page.page_id,
        conversation_id=conversation_id,
        customer_id=sender_id,
        customer_name=sender_name or None,
        message_content=message_text,
        message_timestamp=message_time,
        is_open=True,
        sla_status=SLAStatus.PENDING,
        message_count=1,
    )
    db.add(conversation)
    db.commit()

    check_and_update_sla(conversation, db)
