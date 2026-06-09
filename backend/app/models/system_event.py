import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, Enum as SAEnum
from app.db.session import Base
import enum


class EventLevel(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class SystemEvent(Base):
    __tablename__ = "system_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    level = Column(SAEnum(EventLevel), default=EventLevel.INFO)
    source = Column(String, nullable=False, index=True)
    message = Column(Text, nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
