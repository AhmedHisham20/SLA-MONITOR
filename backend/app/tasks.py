from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.settings import SystemSettings
from app.models.conversation import Conversation
from app.services.report import get_report_metrics, format_duration
from app.services.whatsapp import send_whatsapp_message, build_daily_summary
from app.services.sla import check_and_update_sla
from app.models.page import FacebookPage
from app.core.logging import logger
from app.core.datetime_utils import yesterday_range_utc

scheduler = AsyncIOScheduler()


async def check_pending_sla():
    logger.info("SLA Scheduler Started")
    db = SessionLocal()
    try:
        settings_obj = db.query(SystemSettings).first()

        # === DIAGNOSTIC: enumerate all open conversations ===
        all_open = db.query(Conversation, FacebookPage).join(
            FacebookPage, Conversation.page_id == FacebookPage.page_id
        ).filter(Conversation.is_open == True).all()

        logger.info(f"Conversations checked: {len(all_open)}")

        delayed_count = 0
        already_sent_count = 0
        page_replied_count = 0
        monitoring_disabled_count = 0

        for conv, page in all_open:
            if not page.monitoring_enabled:
                monitoring_disabled_count += 1
                logger.info(f"Conversation {conv.id} Skipped Reason: monitoring disabled")
            elif conv.alert_sent:
                already_sent_count += 1
                logger.info(f"Conversation {conv.id} Skipped Reason: alert_sent=True")
            elif conv.last_sender_type == 'page':
                page_replied_count += 1
                logger.info(f"Conversation {conv.id} Skipped Reason: last_sender_type=page")
            else:
                delayed_count += 1

        logger.info(f"Delayed conversations: {delayed_count}")
        logger.info(f"Already alert_sent: {already_sent_count}")
        logger.info(f"Skipped because page replied: {page_replied_count}")
        logger.info(f"Skipped because monitoring disabled: {monitoring_disabled_count}")

        # === ORIGINAL PROCESSING (unchanged) ===
        pending_convs = db.query(Conversation).join(
            FacebookPage, Conversation.page_id == FacebookPage.page_id
        ).filter(
            Conversation.is_open == True,
            FacebookPage.monitoring_enabled == True,
            Conversation.alert_sent == False,
            Conversation.last_sender_type == 'customer',
        ).all()

        eligible_count = 0
        alerts_sent_count = 0

        for conv in pending_convs:
            triggered, body = check_and_update_sla(conv, db, settings_obj)
            if triggered and body and settings_obj:
                eligible_count += 1
                recipient = settings_obj.whatsapp_recipient_number
                pn_id = settings_obj.whatsapp_phone_number_id
                token = settings_obj.whatsapp_access_token
                if recipient and pn_id and token:
                    logger.info(f"WhatsApp send attempt | Timestamp: {datetime.now(timezone.utc).isoformat()} | Conversation: {conv.id} | Customer ID: {conv.customer_id}")
                    success = await send_whatsapp_message(
                        to=recipient,
                        message=body,
                        phone_number_id=pn_id,
                        access_token=token,
                    )
                    logger.info(f"WhatsApp send result | Conversation: {conv.id} | Success: {success}")
                    if success:
                        alerts_sent_count += 1

        logger.info(f"Eligible for alert: {eligible_count}")
        logger.info(f"Alerts actually sent: {alerts_sent_count}")
        logger.info("Scheduler Finished")
    except Exception:
        logger.exception("SLA check error")
    finally:
        db.close()


async def send_daily_summary():
    logger.info("Generating daily summary...")
    db = SessionLocal()
    try:
        settings_obj = db.query(SystemSettings).first()
        if not settings_obj or not settings_obj.daily_summary_enabled:
            return

        start, end = yesterday_range_utc()

        metrics = get_report_metrics(db, start, end)
        avg_time_str = format_duration(metrics.average_response_time_seconds) if metrics.average_response_time_seconds else "N/A"

        message = build_daily_summary(
            total_messages=metrics.total_messages,
            avg_response_time=avg_time_str,
            delayed_count=metrics.delayed_conversations,
            sla_compliance=metrics.sla_compliance_rate,
        )

        pn_id = settings_obj.whatsapp_phone_number_id
        token = settings_obj.whatsapp_access_token
        recipient = settings_obj.whatsapp_recipient_number
        if pn_id and token and recipient:
            await send_whatsapp_message(
                to=recipient,
                message=message,
                phone_number_id=pn_id,
                access_token=token,
            )
            logger.info("Daily summary sent")
    except Exception:
        logger.exception("Daily summary error")
    finally:
        db.close()


def start_scheduler():
    scheduler.add_job(
        check_pending_sla,
        CronTrigger(second="*/30"),
        id="check_sla",
        name="Check pending SLA every 30 seconds",
        replace_existing=True,
    )

    scheduler.add_job(
        send_daily_summary,
        CronTrigger(hour=23, minute=0),
        id="daily_summary",
        name="Send daily summary at 23:00",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started")
