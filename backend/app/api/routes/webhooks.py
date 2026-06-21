from fastapi import APIRouter, Request, HTTPException, Query
from sqlalchemy.orm import Session
from fastapi import Depends
from app.db.session import get_db
from app.core.config import settings
from app.core.logging import logger
from app.models.settings import SystemSettings
from app.services.webhook import process_webhook_event
from app.services.event_logger import log_event

router = APIRouter(prefix="/webhook", tags=["Webhooks"])


@router.get("/facebook")
async def verify_webhook(
    db: Session = Depends(get_db),
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    settings_obj = db.query(SystemSettings).first()
    expected_token = settings_obj.facebook_verify_token if (settings_obj and settings_obj.facebook_verify_token) else settings.FACEBOOK_VERIFY_TOKEN

    logger.info(f"Webhook verify: mode={hub_mode!r}, token={hub_verify_token!r}, expected={expected_token!r}, challenge={hub_challenge!r}")
    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        log_event("info", "webhook", "Webhook verified successfully")
        logger.info("Webhook verified successfully")
        return int(hub_challenge)
    log_event("error", "webhook", f"Verification failed", f"mode={hub_mode}, token={hub_verify_token}, expected={expected_token}")
    logger.warning(f"Webhook verification failed: mode={hub_mode!r}, token={hub_verify_token!r}, expected={expected_token!r}")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/facebook")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
        logger.debug(f"Webhook received: {body}")

        entry = body.get("entry", [])
        log_event("info", "webhook", f"Received {len(entry)} entries")
        for e in entry:
            await process_webhook_event(e, db)

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        log_event("error", "webhook", f"Webhook POST handler error", str(e)[:200])
        return {"status": "error", "message": str(e)}
