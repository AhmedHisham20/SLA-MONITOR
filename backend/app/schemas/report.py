from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ReportMetrics(BaseModel):
    total_messages: int = 0
    total_conversations: int = 0
    average_response_time_seconds: Optional[int] = None
    delayed_conversations: int = 0
    sla_compliance_rate: float = 100.0
    total_alerts_sent: int = 0


class ReportChartData(BaseModel):
    messages_per_day: List[dict] = []
    response_time_trend: List[dict] = []
    delayed_trend: List[dict] = []
    sla_trend: List[dict] = []


class ReportResponse(BaseModel):
    period: str
    start_date: datetime
    end_date: datetime
    metrics: ReportMetrics
    charts: ReportChartData


class ReportFilter(BaseModel):
    period: str = "daily"
    page_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ModeratorPerformance(BaseModel):
    moderator_name: str
    total_replies: int = 0
    average_response_time_seconds: float = 0.0
    delayed_replies: int = 0
    sla_score: float = 100.0
    total_conversations: int = 0


class ModeratorPerformanceList(BaseModel):
    moderators: List[ModeratorPerformance]
