import csv
import io
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.lead import Lead
from app.schemas.lead import LeadResponse, LeadStats

router = APIRouter(prefix="/leads", tags=["Leads CRM"])


def _lead_to_response(l: Lead) -> LeadResponse:
    return LeadResponse(
        id=l.id,
        phone_number=l.phone_number,
        customer_name=l.customer_name,
        messenger_name=l.messenger_name,
        facebook_psid=l.facebook_psid,
        conversation_id=l.conversation_id,
        page_name=l.page_name,
        first_detected_at=l.first_detected_at,
        last_seen=l.last_seen,
        last_message=l.last_message,
        detection_count=l.detection_count,
        created_at=l.created_at,
        updated_at=l.updated_at,
    )


def _build_query(db: Session, q: str | None, page_id: str | None, period: str | None,
                 start_date: str | None, end_date: str | None, sort_by: str):
    query = db.query(Lead)

    if q:
        pattern = f"%{q}%"
        query = query.filter(
            Lead.phone_number.ilike(pattern)
            | Lead.customer_name.ilike(pattern)
            | Lead.messenger_name.ilike(pattern)
            | Lead.conversation_id.ilike(pattern)
            | Lead.facebook_psid.ilike(pattern)
            | Lead.page_name.ilike(pattern)
        )

    if page_id:
        query = query.filter(Lead.page_name == page_id)

    now = datetime.now(timezone.utc)

    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.filter(Lead.created_at >= start)
    elif period == "yesterday":
        start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.filter(Lead.created_at >= start, Lead.created_at < end)
    elif period == "7d":
        query = query.filter(Lead.created_at >= now - timedelta(days=7))
    elif period == "30d":
        query = query.filter(Lead.created_at >= now - timedelta(days=30))
    elif period == "custom":
        if start_date:
            try:
                sd = datetime.fromisoformat(start_date)
                query = query.filter(Lead.created_at >= sd)
            except ValueError:
                pass
        if end_date:
            try:
                ed = datetime.fromisoformat(end_date)
                query = query.filter(Lead.created_at <= ed)
            except ValueError:
                pass

    if sort_by == "oldest":
        query = query.order_by(Lead.created_at.asc())
    elif sort_by == "last_updated":
        query = query.order_by(Lead.updated_at.desc())
    elif sort_by == "detection_count":
        query = query.order_by(Lead.detection_count.desc())
    else:
        query = query.order_by(Lead.created_at.desc())

    return query


@router.get("", response_model=dict)
def list_leads(
    q: str = None,
    page_id: str = None,
    period: str = None,
    start_date: str = None,
    end_date: str = None,
    sort_by: str = "newest",
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = _build_query(db, q, page_id, period, start_date, end_date, sort_by)
    total = query.count()
    leads = query.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "data": [_lead_to_response(l) for l in leads],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }


@router.get("/stats", response_model=LeadStats)
def lead_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    total = db.query(Lead).count()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today = db.query(Lead).filter(Lead.created_at >= today_start).count()
    repeated = db.query(Lead).filter(Lead.detection_count > 1).count()
    return LeadStats(total_leads=total, today_leads=today, repeated_detections=repeated)


@router.get("/pages")
def lead_pages(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    results = db.query(Lead.page_name, func.count(Lead.id).label("count")).filter(
        Lead.page_name.isnot(None)
    ).group_by(Lead.page_name).order_by(func.count(Lead.id).desc()).all()
    return [{"page_name": r[0], "count": r[1]} for r in results]


@router.get("/export/csv")
def export_leads_csv(
    q: str = None,
    page_id: str = None,
    period: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = _build_query(db, q, page_id, period, start_date, end_date, "newest")
    leads = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Phone", "Customer Name", "Messenger Name", "Page", "First Detected", "Last Seen", "Detection Count", "Conversation ID", "Last Message"])
    for l in leads:
        writer.writerow([
            l.phone_number,
            l.customer_name or "",
            l.messenger_name or "",
            l.page_name or "",
            l.first_detected_at.isoformat() if l.first_detected_at else "",
            l.last_seen.isoformat() if l.last_seen else "",
            l.detection_count,
            l.conversation_id or "",
            l.last_message or "",
        ])

    output.seek(0)
    now_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=leads_{now_str}.csv"},
    )


@router.post("/scan")
def scan_leads_now(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.services.lead_extractor import scan_and_create_leads
    count = scan_and_create_leads(db)
    db.commit()
    return {"scanned": True, "new_leads": count}
