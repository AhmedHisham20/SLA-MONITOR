from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.settings import SystemSettings
from app.models.page import FacebookPage
from app.schemas.settings import SystemSettingsResponse, SystemSettingsUpdate
from app.api.deps import require_admin
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["Settings"])


def _get_or_create_settings(db: Session) -> SystemSettings:
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=SystemSettingsResponse)
def get_settings(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    settings = _get_or_create_settings(db)
    return settings


@router.put("", response_model=SystemSettingsResponse)
def update_settings(update: SystemSettingsUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    settings = _get_or_create_settings(db)
    for field, value in update.model_dump(exclude_unset=True).items():
        if value is None and field in ['whatsapp_access_token', 'facebook_access_token']:
            continue
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/pages")
def get_pages(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return db.query(FacebookPage).all()


@router.post("/pages")
def add_page(update: dict, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    page_id = update.get("page_id", "")
    page_name = update.get("page_name", "")
    access_token = update.get("access_token", "")
    existing = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Page already connected")
    page = FacebookPage(page_id=page_id, page_name=page_name, access_token=access_token or None, monitoring_enabled=False)
    db.add(page)
    db.commit()
    db.refresh(page)
    return page


@router.put("/pages/{page_id}/token")
def update_page_token(page_id: str, access_token: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page.access_token = access_token
    db.commit()
    return {"page_id": page.page_id, "page_name": page.page_name, "message": "Access token updated"}


@router.delete("/pages/{page_id}")
def remove_page(page_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page.is_connected = False
    page.monitoring_enabled = False
    db.commit()
    return {"message": "Page disconnected"}


@router.post("/pages/{page_id}/monitoring")
def toggle_monitoring(page_id: str, enabled: bool, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    page = db.query(FacebookPage).filter(FacebookPage.page_id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page.monitoring_enabled = enabled
    db.commit()
    return {
        "page_id": page.page_id,
        "page_name": page.page_name,
        "monitoring_enabled": page.monitoring_enabled,
    }
