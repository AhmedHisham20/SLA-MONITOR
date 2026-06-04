import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text
from app.db.session import Base


class FacebookPage(Base):
    __tablename__ = "facebook_pages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    page_id = Column(String, unique=True, nullable=False, index=True)
    page_name = Column(String, nullable=False)
    access_token = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    is_connected = Column(Boolean, default=True)
    webhook_subscribed = Column(Boolean, default=False)
    monitoring_enabled = Column(Boolean, default=False)
    last_webhook_activity = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
