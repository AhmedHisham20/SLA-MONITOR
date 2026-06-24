from datetime import datetime, timezone, timedelta
import random
from sqlalchemy.orm import Session
from app.models.page import FacebookPage
from app.models.conversation import Conversation, SLAStatus, DelayLevel
from app.models.alert import Alert, AlertType, AlertStatus
from app.models.settings import SystemSettings
from app.core.logging import logger

PAGE_NAMES = [
    ("1001", "Tech Support Hub"),
    ("1002", "Customer Care Plus"),
    ("1003", "Sales & Inquiries"),
]

CUSTOMERS = [
    ("2001", "Alice Johnson"), ("2002", "Bob Smith"), ("2003", "Carol Davis"),
    ("2004", "David Wilson"), ("2005", "Eva Martinez"), ("2006", "Frank Lee"),
    ("2007", "Grace Kim"), ("2008", "Henry Brown"), ("2009", "Iris Chen"),
    ("2010", "Jack Taylor"),
]

MODERATORS = ["Sarah Connor", "Mike Peters", "Lisa Wong", "Tom Bradley"]

AUTO_REPLIES = [
    "Thank you for reaching out! We'll get back to you shortly.",
    "Your message is important to us. A team member will respond soon.",
    "Thanks for contacting us! Our support hours are 9AM-5PM.",
    "This is an automated response. We'll connect you with a specialist.",
]

HUMAN_REPLIES = [
    "Hi there! I'd be happy to help you with that.",
    "Thanks for your patience! Let me look into this for you.",
    "I understand your concern. Let me check on that right away.",
    "Great question! Here's what I can tell you about that.",
    "I've looked into this and here's what we can do.",
    "Thank you for explaining. Let me help resolve this.",
    "I apologize for the delay. Let me prioritize this for you.",
    "I've escalated this to our team. You'll hear back soon.",
]


def seed_demo_data(db: Session):
    existing = db.query(FacebookPage).filter(
        FacebookPage.page_id.in_([p[0] for p in PAGE_NAMES])
    ).first()
    if existing:
        logger.info("Demo data already exists, skipping seed")
        return

    logger.info("Seeding demo data...")

    settings_obj = db.query(SystemSettings).first()
    if not settings_obj:
        settings_obj = SystemSettings(
            company_name="Demo SLA Monitor",
            sla_threshold_minutes=5,
            escalation_admin_minutes=10,
            escalation_critical_minutes=15,
            daily_summary_enabled=True,
            weekly_summary_enabled=True,
        )
        db.add(settings_obj)
        db.commit()

    pages = []
    for pid, pname in PAGE_NAMES:
        page = FacebookPage(
            page_id=pid,
            page_name=pname,
            is_connected=True,
            monitoring_enabled=True,
            last_webhook_activity=datetime.now(timezone.utc) - timedelta(minutes=random.randint(5, 120)),
        )
        db.add(page)
        pages.append(page)
    db.commit()

    now = datetime.now(timezone.utc)
    all_conversations = []

    for day_offset in range(7):
        day_start = now - timedelta(days=day_offset)
        day_start = day_start.replace(hour=0, minute=0, second=0, microsecond=0)

        convs_per_day = random.randint(8, 20)
        for _ in range(convs_per_day):
            page = random.choice(pages)
            customer = random.choice(CUSTOMERS)
            moderator = random.choice(MODERATORS)

            msg_hour = random.randint(0, 23)
            msg_minute = random.randint(0, 59)
            msg_time = day_start + timedelta(hours=msg_hour, minutes=msg_minute)

            is_delayed = random.random() < 0.25
            has_auto_reply = random.random() < 0.30

            sla_status = SLAStatus.PENDING
            delay_level = DelayLevel.NONE
            first_reply = None
            response_time = None
            is_open = True
            has_human = False
            has_auto = has_auto_reply
            alert_sent = False
            alert_sent_at = None
            auto_count = 1 if has_auto_reply else 0

            if is_delayed:
                wait_minutes = random.randint(5, 45)
                sla_status = SLAStatus.DELAYED
                if wait_minutes >= 15:
                    delay_level = DelayLevel.CRITICAL
                elif wait_minutes >= 10:
                    delay_level = DelayLevel.ADMIN
                else:
                    delay_level = DelayLevel.MODERATOR
                alert_sent = True
                alert_sent_at = msg_time + timedelta(minutes=wait_minutes)
            else:
                reply_delay = random.randint(30, 350)
                first_reply = msg_time + timedelta(seconds=reply_delay)
                response_time = reply_delay
                sla_status = SLAStatus.COMPLIANT if reply_delay <= 300 else SLAStatus.DELAYED
                delay_level = DelayLevel.NONE if reply_delay <= 300 else DelayLevel.MODERATOR
                is_open = False
                has_human = True

            conv = Conversation(
                page_id=page.page_id,
                conversation_id=f"demo_conv_{day_offset}_{_}",
                customer_id=customer[0],
                customer_name=customer[1],
                moderator_name=moderator if has_human else None,
                message_timestamp=msg_time,
                first_reply_timestamp=first_reply,
                response_time_seconds=response_time,
                sla_status=sla_status,
                delay_level=delay_level,
                is_open=is_open,
                alert_sent=alert_sent,
                alert_sent_at=alert_sent_at,
                is_working_hours=True,
                has_human_reply=has_human,
                has_automated_reply=has_auto,
                automated_message_count=auto_count,
                message_count=random.randint(1, 5),
            )
            db.add(conv)
            all_conversations.append(conv)
    db.commit()

    alert_count = 0
    for conv in all_conversations:
        if conv.alert_sent:
            alert = Alert(
                conversation_id=conv.id,
                alert_type=AlertType.WHATSAPP,
                recipient="demo-phone-number-id",
                message_body=f"Demo alert for {conv.customer_name} on page {conv.page_id}",
                status=AlertStatus.SENT,
                sent_at=conv.alert_sent_at or conv.message_timestamp + timedelta(minutes=5),
            )
            db.add(alert)
            alert_count += 1
    db.commit()

    logger.info(f"Demo data seeded: {len(pages)} pages, {len(all_conversations)} conversations, {alert_count} alerts")
