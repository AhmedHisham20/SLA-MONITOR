import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text, UniqueConstraint
from app.db.session import Base


class Lead(Base):
    __tablename__ = "leads"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    phone_number = Column(String, nullable=False, index=True)
    customer_name = Column(String, nullable=True)
    messenger_name = Column(String, nullable=True)
    facebook_psid = Column(String, nullable=True, index=True)
    conversation_id = Column(String, nullable=True, index=True)
    page_name = Column(String, nullable=True)
    first_detected_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_seen = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_message = Column(Text, nullable=True)
    detection_count = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("phone_number", name="uq_lead_phone"),
    )
