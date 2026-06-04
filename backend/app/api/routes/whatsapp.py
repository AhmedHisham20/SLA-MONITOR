from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.settings import SystemSettings
from app.schemas.settings import WhatsAppSettingsUpdate
from app.api.deps import require_admin
from app.models.user import User
from app.services.whatsapp import send_whatsapp_message

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


@router.post("/test")
async def test_whatsapp(
    to: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    settings_obj = db.query(SystemSettings).first()
    if not settings_obj or not settings_obj.whatsapp_phone_number_id:
        return {"success": False, "message": "WhatsApp not configured"}

    success = await send_whatsapp_message(
        to=to,
        message="\U0001f4a1 This is a test message from Messenger SLA Monitor.\nYour WhatsApp configuration is working correctly.",
        phone_number_id=settings_obj.whatsapp_phone_number_id,
        access_token=settings_obj.whatsapp_access_token,
    )
    return {"success": success}


@router.post("/settings")
def update_whatsapp_settings(
    update: WhatsAppSettingsUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    settings_obj = db.query(SystemSettings).first()
    if not settings_obj:
        settings_obj = SystemSettings()
        db.add(settings_obj)
    settings_obj.whatsapp_phone_number_id = update.phone_number_id
    settings_obj.whatsapp_access_token = update.access_token
    settings_obj.whatsapp_recipient_number = update.recipient_number
    db.commit()
    return {"success": True, "message": "WhatsApp settings updated"}
