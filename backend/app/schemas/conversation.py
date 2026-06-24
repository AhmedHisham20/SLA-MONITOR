from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ConversationResponse(BaseModel):
    id: str
    page_id: str
    page_name: Optional[str] = None
    conversation_id: str
    customer_id: str
    customer_name: Optional[str] = None
    moderator_name: Optional[str] = None
    message_timestamp: datetime
    first_reply_timestamp: Optional[datetime] = None
    response_time_seconds: Optional[int] = None
    sla_status: str
    delay_level: str
    is_open: bool
    alert_sent: bool
    has_human_reply: bool = False
    has_automated_reply: bool = False
    waiting_minutes: int = 0
    conversation_link: str = ""
    is_working_hours: bool = True
    created_at: datetime

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
