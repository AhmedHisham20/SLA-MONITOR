import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, Float, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.db.session import Base
import enum


class SLAStatus(str, enum.Enum):
    COMPLIANT = "compliant"
    DELAYED = "delayed"
    PENDING = "pending"
    OUTSIDE_HOURS = "outside_hours"


class DelayLevel(str, enum.Enum):
    NONE = "none"
    MODERATOR = "moderator"
    ADMIN = "admin"
    CRITICAL = "critical"


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    page_id = Column(String, ForeignKey("facebook_pages.page_id"), nullable=False, index=True)
    conversation_id = Column(String, nullable=False, index=True)
    customer_id = Column(String, nullable=False, index=True)
    customer_name = Column(String, nullable=True)
    moderator_name = Column(String, nullable=True)
    message_content = Column(Text, nullable=True)
    message_timestamp = Column(DateTime(timezone=True), nullable=False)
    unanswered_count = Column(Integer, default=0)
    unanswered_texts = Column(Text, nullable=True)
    first_reply_timestamp = Column(DateTime(timezone=True), nullable=True)
    response_time_seconds = Column(Integer, nullable=True)
    sla_status = Column(SAEnum(SLAStatus), default=SLAStatus.PENDING)
    delay_level = Column(SAEnum(DelayLevel), default=DelayLevel.NONE)
    is_open = Column(Boolean, default=True)
    last_sender_type = Column(String, default='customer')
    alert_sent = Column(Boolean, default=False)
    alert_sent_at = Column(DateTime(timezone=True), nullable=True)
    is_working_hours = Column(Boolean, default=True)
    has_human_reply = Column(Boolean, default=False)
    has_automated_reply = Column(Boolean, default=False)
    automated_message_count = Column(Integer, default=0)
    message_count = Column(Integer, default=0)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    cached_conversation_link = Column("conversation_link", Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    page = relationship("FacebookPage", backref="conversations")

    @property
    def conversation_link(self) -> str:
        if self.cached_conversation_link:
            return self.cached_conversation_link
        if self.customer_id and self.conversation_id and self.conversation_id.startswith("t_"):
            return f"https://business.facebook.com/latest/inbox/all?selected_item_id={self.conversation_id}"
        if self.customer_id:
            return f"https://business.facebook.com/latest/inbox/all?selected_item_id=t_{self.page_id}_{self.customer_id}"
        return "https://business.facebook.com/latest/inbox/all"

    @property
    def waiting_minutes(self) -> int:
        if self.last_sender_type == 'page':
            return 0
        return int((datetime.now(timezone.utc) - self.message_timestamp).total_seconds() / 60)
