from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LeadResponse(BaseModel):
    id: str
    phone_number: str
    customer_name: Optional[str] = None
    messenger_name: Optional[str] = None
    facebook_psid: Optional[str] = None
    conversation_id: Optional[str] = None
    page_name: Optional[str] = None
    first_detected_at: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    last_message: Optional[str] = None
    detection_count: int = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeadStats(BaseModel):
    total_leads: int
    today_leads: int
    repeated_detections: int
