from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.db.session import get_db
from app.models.system_event import SystemEvent
from app.api.deps import require_admin
from app.models.user import User

router = APIRouter(prefix="/logs", tags=["Logs"])


@router.get("")
def get_logs(
    limit: int = Query(50, ge=1, le=200),
    source: str = None,
    level: str = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = db.query(SystemEvent)
    if source:
        q = q.filter(SystemEvent.source == source)
    if level:
        q = q.filter(SystemEvent.level == level)
    q = q.order_by(desc(SystemEvent.created_at)).limit(limit)
    return q.all()
