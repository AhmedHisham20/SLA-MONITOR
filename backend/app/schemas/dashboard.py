from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class DashboardStats(BaseModel):
    total_conversations_today: int = 0
    open_conversations: int = 0
    delayed_conversations: int = 0
    average_response_time_seconds: Optional[int] = None
    sla_compliance_percent: float = 100.0
    total_alerts_sent: int = 0
    active_pages: int = 0


class RecentConversation(BaseModel):
    id: str
    customer_name: Optional[str]
    customer_id: Optional[str] = None
    moderator_name: Optional[str] = None
    page_name: Optional[str]
    message_timestamp: datetime
    first_reply_timestamp: Optional[datetime] = None
    response_time_seconds: Optional[int] = None
    waiting_minutes: int
    sla_status: str
    delay_level: str
    is_open: bool = True
    conversation_link: str = ""

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    stats: DashboardStats
    recent_conversations: List[RecentConversation]


class ChartDataPoint(BaseModel):
    label: str
    value: float


class PageStats(BaseModel):
    page_id: str
    page_name: str
    total_conversations: int
    delayed_count: int
    avg_response_time: Optional[float] = None
    sla_compliance: float
