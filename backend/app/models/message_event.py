import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base


class MessageEvent(Base):
    __tablename__ = "message_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False, index=True)
    customer_id = Column(String, nullable=False, index=True)
    page_id = Column(String, nullable=False, index=True)
    message_text = Column(Text, nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=False)
    replied_at = Column(DateTime(timezone=True), nullable=True)
    response_time_seconds = Column(Integer, nullable=True)
    sla_exceeded = Column(Boolean, default=False)
    moderator_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    conversation = relationship("Conversation", backref="message_events")
