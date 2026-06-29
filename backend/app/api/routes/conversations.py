from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.conversation import Conversation, SLAStatus, DelayLevel
from app.models.page import FacebookPage
from app.models.message_event import MessageEvent
from app.schemas.conversation import (
    ConversationResponse,
    ConversationListResponse,
    MessageEventResponse,
)
from app.api.deps import get_current_user
from app.models.user import User
from app.core.datetime_utils import today_start_utc, yesterday_range_utc, days_ago_start_utc, now_egypt

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.get("", response_model=ConversationListResponse)
def list_conversations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    period: str = Query(None),
    page_id: str = Query(None),
    status: str = Query(None),
    sla_status: str = Query(None),
    last_sender_type: str = Query(None),
    delay_level: str = Query(None),
    is_open: bool = Query(None),
    search: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Conversation).join(
        FacebookPage, Conversation.page_id == FacebookPage.page_id
    ).filter(FacebookPage.monitoring_enabled == True)

    if period and period != "all":
        if period == "today":
            start = today_start_utc()
        elif period == "yesterday":
            start, end = yesterday_range_utc()
            query = query.filter(
                Conversation.message_timestamp >= start,
                Conversation.message_timestamp < end,
            )
        elif period == "7days":
            start = days_ago_start_utc(7)
        elif period == "30days":
            start = days_ago_start_utc(30)

        if period != "yesterday":
            query = query.filter(Conversation.message_timestamp >= start)

    if page_id:
        query = query.filter(Conversation.page_id == page_id)
    if status:
        if status == 'responded':
            query = query.filter(Conversation.last_sender_type == 'page')
        elif status == 'pending':
            query = query.filter(
                Conversation.last_sender_type == 'customer',
                Conversation.sla_status != SLAStatus.DELAYED,
            )
        elif status == 'delayed':
            query = query.filter(
                Conversation.last_sender_type == 'customer',
                Conversation.sla_status == SLAStatus.DELAYED,
            )
    if sla_status:
        query = query.filter(Conversation.sla_status == sla_status)
    if last_sender_type:
        query = query.filter(Conversation.last_sender_type == last_sender_type)
    if delay_level:
        query = query.filter(Conversation.delay_level == delay_level)
    if is_open is not None:
        query = query.filter(Conversation.is_open == is_open)
    if search:
        query = query.filter(
            Conversation.customer_name.ilike(f"%{search}%")
            | Conversation.customer_id.ilike(f"%{search}%")
            | Conversation.moderator_name.ilike(f"%{search}%")
        )

    total = query.count()
    items = query.order_by(Conversation.message_timestamp.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    conv_ids = [c.id for c in items]
    violation_conv_ids = set()
    if conv_ids:
        rows = db.query(MessageEvent.conversation_id).filter(
            MessageEvent.conversation_id.in_(conv_ids),
            MessageEvent.sla_exceeded == True,
        ).distinct().all()
        violation_conv_ids = {r[0] for r in rows}

    result_items = []
    for c in items:
        page_obj = db.query(FacebookPage).filter(FacebookPage.page_id == c.page_id).first()
        conv_resp = ConversationResponse.model_validate(c)
        conv_resp.page_name = page_obj.page_name if page_obj else None
        conv_resp.waiting_minutes = c.waiting_minutes
        conv_resp.conversation_link = c.conversation_link or ""
        conv_resp.has_sla_violation = (
            c.id in violation_conv_ids
            or (c.last_sender_type == 'customer' and c.sla_status == SLAStatus.DELAYED)
        )
        result_items.append(conv_resp)

    return ConversationListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=result_items,
    )


@router.patch("/{conversation_id}/review")
def review_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    c.reviewed_at = now_egypt()
    db.commit()
    return {"status": "reviewed", "id": conversation_id}


@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: str,
    include_events: bool = Query(True, description="Include message events"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    page_obj = db.query(FacebookPage).filter(FacebookPage.page_id == c.page_id).first()
    conv_resp = ConversationResponse.model_validate(c)
    conv_resp.page_name = page_obj.page_name if page_obj else None
    conv_resp.waiting_minutes = c.waiting_minutes
    conv_resp.conversation_link = c.conversation_link or ""
    if include_events:
        events = db.query(MessageEvent).filter(
            MessageEvent.conversation_id == c.id,
        ).order_by(MessageEvent.received_at.asc()).all()
        conv_resp.message_events = [MessageEventResponse.model_validate(e) for e in events]
        conv_resp.has_sla_violation = (
            any(e.sla_exceeded for e in events)
            or (c.last_sender_type == 'customer' and c.sla_status == SLAStatus.DELAYED)
        )
    return conv_resp


@router.get("/stats/status-counts")
def get_status_counts(
    period: str = Query(None),
    page_id: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Conversation).join(
        FacebookPage, Conversation.page_id == FacebookPage.page_id
    ).filter(FacebookPage.monitoring_enabled == True)

    if period and period != "all":
        if period == "today":
            start = today_start_utc()
            query = query.filter(Conversation.message_timestamp >= start)
        elif period == "yesterday":
            start, end = yesterday_range_utc()
            query = query.filter(Conversation.message_timestamp >= start, Conversation.message_timestamp < end)
        elif period == "7days":
            start = days_ago_start_utc(7)
            query = query.filter(Conversation.message_timestamp >= start)
        elif period == "30days":
            start = days_ago_start_utc(30)
            query = query.filter(Conversation.message_timestamp >= start)

    if page_id:
        query = query.filter(Conversation.page_id == page_id)

    all_count = query.count()
    responded = query.filter(Conversation.last_sender_type == 'page').count()
    pending = query.filter(
        Conversation.last_sender_type == 'customer',
        Conversation.sla_status != SLAStatus.DELAYED,
    ).count()
    delayed = query.filter(
        Conversation.last_sender_type == 'customer',
        Conversation.sla_status == SLAStatus.DELAYED,
    ).count()

    return {
        "all": all_count,
        "responded": responded,
        "pending": pending,
        "delayed": delayed,
    }


@router.get("/stats/pages")
def get_page_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pages = db.query(FacebookPage).filter(
        FacebookPage.monitoring_enabled == True,
        FacebookPage.is_connected == True,
    ).all()
    result = []
    for page in pages:
        total = db.query(Conversation).filter(Conversation.page_id == page.page_id).count()
        delayed = db.query(Conversation).filter(
            Conversation.page_id == page.page_id,
            Conversation.sla_status == SLAStatus.DELAYED,
        ).count()
        human_replied = db.query(Conversation).filter(
            Conversation.page_id == page.page_id,
            Conversation.has_human_reply == True,
            Conversation.response_time_seconds.isnot(None),
        )
        avg_resp = human_replied.with_entities(func.avg(Conversation.response_time_seconds)).scalar()
        compliance = 100.0
        if total > 0:
            compliance = round(((total - delayed) / total) * 100, 2)
        result.append({
            "page_id": page.page_id,
            "page_name": page.page_name,
            "total_conversations": total,
            "delayed_count": delayed,
            "avg_response_time": round(avg_resp, 1) if avg_resp else None,
            "sla_compliance": compliance,
        })
    return result
