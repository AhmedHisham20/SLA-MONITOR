import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, Enum as SAEnum
from app.db.session import Base
import enum


class AlertType(str, enum.Enum):
    WHATSAPP = "whatsapp"


class AlertStatus(str, enum.Enum):
    SENT = "sent"
    FAILED = "failed"


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, nullable=False, index=True)
    alert_type = Column(SAEnum(AlertType), default=AlertType.WHATSAPP)
    recipient = Column(String, nullable=False)
    message_body = Column(Text, nullable=False)
    status = Column(SAEnum(AlertStatus), default=AlertStatus.SENT)
    error_message = Column(Text, nullable=True)
    meta_alert_id = Column(String, nullable=True)
    sent_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
