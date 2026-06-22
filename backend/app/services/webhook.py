from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.conversation import Conversation, SLAStatus
from app.models.page import FacebookPage
from app.models.settings import SystemSettings
from app.core.logging import logger
from app.services.sla import check_and_update_sla, is_automated_message


async def process_webhook_event(entry: dict, db: Session):
    try:
        from app.services.event_logger import log_event
        log_event("info", "webhook", f"Entry keys: {list(entry.keys())}, entry id: {entry.get('id')}")

        messaging = entry.get("messaging", [])
        if messaging:
            log_event("info", "webhook", f"Processing {len(messaging)} messaging entries")
            for msg in messaging:
                try:
                    sender_id = msg.get("sender", {}).get("id", "")
                    page_id = msg.get("recipient", {}).get("id", "")
                    message_data = msg.get("message", {})
                    log_event("info", "webhook", f"Messaging: sender={sender_id}, page={page_id}, text={message_data.get('text', '')[:80]}")
                    await process_messaging_entry(msg, page_id, db)
                except Exception as e:
                    log_event("error", "webhook", f"Error processing messaging entry", str(e)[:200])
            return

        changes = entry.get("changes", [])

        for change in changes:
            try:
                value = change.get("value", {})
                log_event("info", "webhook", f"Change field: {change.get('field')}, value keys: {list(value.keys())[:5]}")

                if "conversations" not in value and "messages" not in value:
                    log_event("warning", "webhook", f"Skipping - no conversations/messages in value. keys: {list(value.keys())[:8]}")
                    continue

                page_id = value.get("page_id") or entry.get("id")
                page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
                if not page:
                    page = FacebookPage(
                        page_id=page_id,
                        page_name=value.get("page_name", f"Page {page_id}"),
                        is_connected=True,
                        monitoring_enabled=True,
                    )
                    db.add(page)
                    db.commit()
                    page.last_webhook_activity = datetime.now(timezone.utc)
                    db.commit()
                else:
                    if not page.monitoring_enabled:
                        page.monitoring_enabled = True
                        log_event("info", "webhook", f"Auto-enabled monitoring for page {page.page_name} (changes)")
                    if not page.is_connected:
                        page.is_connected = True
                    page.last_webhook_activity = datetime.now(timezone.utc)
                    db.commit()

                messages = value.get("messages", [])
                for msg in messages:
                    await process_message(msg, page, value, db)
            except Exception as e:
                log_event("error", "webhook", f"Error processing change entry", str(e)[:200])

    except Exception as e:
        log_event("error", "webhook", f"Webhook processing error", str(e)[:200])


async def process_message(msg: dict, page: FacebookPage, value: dict, db: Session):
    try:
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

        if not existing and is_page_sender:
            customer_id = msg.get("from", {}).get("id", "") if isinstance(msg.get("from"), dict) else str(msg.get("from", ""))
            existing = db.query(Conversation).filter(
                Conversation.customer_id == customer_id,
                Conversation.page_id == page.page_id,
                Conversation.is_open == True,
            ).order_by(Conversation.message_timestamp.desc()).first()

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
    except Exception as e:
        from app.services.event_logger import log_event
        log_event("error", "webhook", f"Error in process_message", str(e)[:200])


async def process_messaging_entry(msg: dict, page_id: str, db: Session):
    from app.services.event_logger import log_event
    try:
        sender_id = msg.get("sender", {}).get("id", "")
        sender_name = msg.get("sender", {}).get("name", "") or msg.get("sender", {}).get("first_name", "")
        message_data = msg.get("message", {})
        if not sender_id or not message_data:
            return

        page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
        if not page:
            page = FacebookPage(page_id=page_id, page_name=f"Page {page_id}", is_connected=True, monitoring_enabled=True)
            db.add(page)
            db.commit()
            page.last_webhook_activity = datetime.now(timezone.utc)
            db.commit()
        else:
            if not page.monitoring_enabled:
                page.monitoring_enabled = True
                log_event("info", "webhook", f"Auto-enabled monitoring for page {page.page_name}")
            if not page.is_connected:
                page.is_connected = True
            page.last_webhook_activity = datetime.now(timezone.utc)
            db.commit()

        message_text = message_data.get("text", "") or ""

        timestamp = msg.get("timestamp", 0)
        if isinstance(timestamp, (int, float)):
            message_time = datetime.fromtimestamp(timestamp / 1000 if timestamp > 1e12 else timestamp, tz=timezone.utc)
        else:
            message_time = datetime.now(timezone.utc)

        is_page_sender = (sender_id == page_id)

        if is_page_sender:
            customer_id = msg.get("recipient", {}).get("id", "")
            if not customer_id:
                return

            existing = db.query(Conversation).filter(
                Conversation.customer_id == customer_id,
                Conversation.page_id == page_id,
                Conversation.is_open == True,
            ).order_by(Conversation.message_timestamp.desc()).first()

            if not existing:
                return

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

        existing = db.query(Conversation).filter(
            Conversation.customer_id == sender_id,
            Conversation.page_id == page_id,
            Conversation.is_open == True,
        ).order_by(Conversation.message_timestamp.desc()).first()

        if existing:
            existing.message_count = (existing.message_count or 0) + 1
            existing.message_timestamp = message_time
            if existing.alert_sent:
                existing.alert_sent = False
                existing.alert_sent_at = None
                existing.sla_status = SLAStatus.PENDING
                log_event("info", "webhook", f"Reset alert for conversation {existing.id}, sender {sender_id[:20]}")
            db.commit()
            log_event("info", "webhook", f"Appended msg to conversation {existing.id}, sender {sender_id[:20]}")
            return

        new_conv_id = f"conv_{sender_id}_{page_id}_{int(datetime.now(timezone.utc).timestamp())}"

        conversation = Conversation(
            page_id=page.page_id,
            conversation_id=new_conv_id,
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

        log_event("info", "webhook", f"Created conversation {conversation.id} for page {page.page_name}, sender {sender_id[:20]}")

        check_and_update_sla(conversation, db)
    except Exception as e:
        log_event("error", "webhook", f"Error in process_messaging_entry", str(e)[:200])
