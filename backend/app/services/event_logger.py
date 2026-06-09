from datetime import datetime, timezone
from app.db.session import SessionLocal
from app.models.system_event import SystemEvent, EventLevel
from app.core.logging import logger


def log_event(level: str, source: str, message: str, details: str = None):
    db = SessionLocal()
    try:
        event = SystemEvent(
            level=level,
            source=source,
            message=message,
            details=details,
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)
        db.commit()
        log_fn = logger.info if level == "info" else logger.warning if level == "warning" else logger.error
        log_fn(f"[{source}] {message}")
    except Exception as e:
        logger.error(f"Failed to log event: {e}")
    finally:
        db.close()
