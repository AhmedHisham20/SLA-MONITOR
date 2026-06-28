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
    logger.info("Running SLA check for pending conversations...")
    db = SessionLocal()
    try:
        settings_obj = db.query(SystemSettings).first()
        pending_convs = db.query(Conversation).join(
            FacebookPage, Conversation.page_id == FacebookPage.page_id
        ).filter(
            Conversation.is_open == True,
            FacebookPage.monitoring_enabled == True,
            Conversation.alert_sent == False,
            Conversation.last_sender_type == 'customer',
        ).all()

        for conv in pending_convs:
            triggered, body = check_and_update_sla(conv, db, settings_obj)
            if triggered and body and settings_obj:
                recipient = settings_obj.whatsapp_recipient_number
                pn_id = settings_obj.whatsapp_phone_number_id
                token = settings_obj.whatsapp_access_token
                if recipient and pn_id and token:
                    await send_whatsapp_message(
                        to=recipient,
                        message=body,
                        phone_number_id=pn_id,
                        access_token=token,
                    )

        logger.info(f"Checked {len(pending_convs)} pending conversations")
    except Exception as e:
        logger.error(f"SLA check error: {str(e)}")
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
    except Exception as e:
        logger.error(f"Daily summary error: {str(e)}")
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
