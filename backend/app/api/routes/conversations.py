from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.conversation import Conversation, SLAStatus, DelayLevel
from app.models.page import FacebookPage
from app.schemas.conversation import ConversationResponse, ConversationListResponse, ConversationFilter
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.get("", response_model=ConversationListResponse)
def list_conversations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    period: str = Query(None),
    page_id: str = Query(None),
    sla_status: str = Query(None),
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
        now = datetime.now(timezone.utc)
        if period == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "yesterday":
            start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            end = now.replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(
                Conversation.message_timestamp >= start,
                Conversation.message_timestamp < end,
            )
        elif period == "7days":
            start = now - timedelta(days=7)
        elif period == "30days":
            start = now - timedelta(days=30)

        if period != "yesterday":
            query = query.filter(Conversation.message_timestamp >= start)

    if page_id:
        query = query.filter(Conversation.page_id == page_id)
    if sla_status:
        query = query.filter(Conversation.sla_status == sla_status)
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

    result_items = []
    for c in items:
        page_obj = db.query(FacebookPage).filter(FacebookPage.page_id == c.page_id).first()
        conv_resp = ConversationResponse.model_validate(c)
        conv_resp.page_name = page_obj.page_name if page_obj else None
        conv_resp.waiting_minutes = c.waiting_minutes
        conv_resp.conversation_link = c.conversation_link
        result_items.append(conv_resp)

    return ConversationListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=result_items,
    )


@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(conversation_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    page_obj = db.query(FacebookPage).filter(FacebookPage.page_id == c.page_id).first()
    conv_resp = ConversationResponse.model_validate(c)
    conv_resp.page_name = page_obj.page_name if page_obj else None
    conv_resp.waiting_minutes = c.waiting_minutes
    conv_resp.conversation_link = c.conversation_link
    return conv_resp


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
