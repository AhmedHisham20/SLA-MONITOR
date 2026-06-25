from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.conversation import Conversation, SLAStatus
from app.models.alert import Alert
from app.models.page import FacebookPage
from app.schemas.dashboard import DashboardStats, DashboardResponse, RecentConversation
from app.api.deps import get_current_user
from app.models.user import User
from app.services.cache import cache_get_json, cache_set_json

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _base_monitored_query(db):
    return db.query(Conversation).join(
        FacebookPage, Conversation.page_id == FacebookPage.page_id
    ).filter(FacebookPage.monitoring_enabled == True)


@router.get("/stats", response_model=DashboardResponse)
async def get_dashboard(
    page_id: str = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    cache_key = f"dashboard:stats:{page_id or 'all'}:{date_from or 'none'}:{date_to or 'none'}"
    cached = await cache_get_json(cache_key)
    if cached:
        return DashboardResponse(**cached)

    base = _base_monitored_query(db)
    if page_id:
        base = base.filter(Conversation.page_id == page_id)

    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            base = base.filter(Conversation.message_timestamp >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc) + timedelta(days=1)
            base = base.filter(Conversation.message_timestamp < dt_to)
        except ValueError:
            pass

    has_date_filter = bool(date_from or date_to)
    if has_date_filter:
        total_in_range = base.count()
    else:
        total_in_range = base.filter(Conversation.message_timestamp >= today_start).count()

    awaiting = base.filter(Conversation.last_sender_type == 'customer').count()
    awaiting_delayed = base.filter(
        Conversation.last_sender_type == 'customer',
        Conversation.sla_status == SLAStatus.DELAYED,
    ).count()

    avg_response = base.filter(
        Conversation.has_human_reply == True,
        Conversation.response_time_seconds.isnot(None),
    ).with_entities(func.avg(Conversation.response_time_seconds)).scalar()
    avg_response = int(avg_response) if avg_response else None

    replied = base.filter(Conversation.has_human_reply == True).count()
    sla_compliance = 100.0
    if replied > 0:
        on_time = base.filter(
            Conversation.has_human_reply == True,
            Conversation.sla_status == SLAStatus.COMPLIANT,
        ).count()
        sla_compliance = round((on_time / replied) * 100, 2)

    base_pages = db.query(FacebookPage).filter(FacebookPage.monitoring_enabled == True)
    if page_id:
        base_pages = base_pages.filter(FacebookPage.page_id == page_id)
    monitored_pages_count = base_pages.count()

    alerts_count = db.query(Alert).count()

    recent_query = _base_monitored_query(db)
    if page_id:
        recent_query = recent_query.filter(Conversation.page_id == page_id)
    if date_from:
        try:
            recent_query = recent_query.filter(Conversation.message_timestamp >= datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc))
        except ValueError:
            pass
    if date_to:
        try:
            recent_query = recent_query.filter(Conversation.message_timestamp < datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc) + timedelta(days=1))
        except ValueError:
            pass
    recent = recent_query.order_by(Conversation.message_timestamp.desc()).limit(10).all()

    recent_items = []
    for c in recent:
        page = db.query(FacebookPage).filter(FacebookPage.page_id == c.page_id).first()
        recent_items.append(RecentConversation(
            id=c.id,
            customer_name=c.customer_name,
            customer_id=c.customer_id,
            moderator_name=c.moderator_name,
            page_name=page.page_name if page else None,
            message_timestamp=c.message_timestamp,
            first_reply_timestamp=c.first_reply_timestamp,
            response_time_seconds=c.response_time_seconds,
            waiting_minutes=c.waiting_minutes,
            sla_status=c.sla_status.value if c.sla_status else "pending",
            delay_level=c.delay_level.value if c.delay_level else "none",
            is_open=c.is_open,
            last_sender_type=c.last_sender_type or 'customer',
            is_awaiting_reply=(c.last_sender_type == 'customer'),
            conversation_link=c.conversation_link,
        ))

    stats = DashboardStats(
        total_conversations_today=total_in_range,
        open_conversations=awaiting,
        delayed_conversations=awaiting_delayed,
        average_response_time_seconds=avg_response,
        sla_compliance_percent=sla_compliance,
        total_alerts_sent=alerts_count,
        active_pages=monitored_pages_count,
    )

    result = DashboardResponse(stats=stats, recent_conversations=recent_items)
    await cache_set_json(cache_key, result.model_dump(), ttl=30)
    return result
