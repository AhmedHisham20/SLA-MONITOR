from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MessageEventResponse(BaseModel):
    id: str
    message_text: Optional[str] = None
    received_at: datetime
    replied_at: Optional[datetime] = None
    response_time_seconds: Optional[int] = None
    sla_exceeded: bool = False
    moderator_name: Optional[str] = None

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: str
    page_id: str
    page_name: Optional[str] = None
    conversation_id: str
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    moderator_name: Optional[str] = None
    message_content: Optional[str] = None
    message_timestamp: datetime
    first_reply_timestamp: Optional[datetime] = None
    response_time_seconds: Optional[int] = None
    sla_status: str
    delay_level: str
    is_open: bool
    alert_sent: bool
    has_human_reply: bool = False
    has_automated_reply: bool = False
    last_sender_type: str = 'customer'
    unanswered_count: int = 0
    unanswered_texts: Optional[str] = None
    waiting_minutes: int = 0
    conversation_link: str = ""
    is_working_hours: bool = True
    created_at: datetime
    message_events: List[MessageEventResponse] = []
    has_sla_violation: bool = False
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[ConversationResponse]


class ConversationFilter(BaseModel):
    page_id: Optional[str] = None
    sla_status: Optional[str] = None
    delay_level: Optional[str] = None
    is_open: Optional[bool] = None
    period: Optional[str] = None
    search: Optional[str] = None
