from pydantic import BaseModel
from typing import Optional


class SystemSettingsResponse(BaseModel):
    company_name: str
    timezone: str
    working_hours_start: str
    working_hours_end: str
    sla_threshold_minutes: int
    escalation_admin_minutes: int
    escalation_critical_minutes: int
    daily_summary_enabled: bool
    daily_summary_time: str
    weekly_summary_enabled: bool
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_access_token: Optional[str] = None
    whatsapp_recipient_number: Optional[str] = None
    facebook_verify_token: Optional[str] = None
    facebook_access_token: Optional[str] = None

    class Config:
        from_attributes = True


class SystemSettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    timezone: Optional[str] = None
    working_hours_start: Optional[str] = None
    working_hours_end: Optional[str] = None
    sla_threshold_minutes: Optional[int] = None
    escalation_admin_minutes: Optional[int] = None
    escalation_critical_minutes: Optional[int] = None
    daily_summary_enabled: Optional[bool] = None
    daily_summary_time: Optional[str] = None
    weekly_summary_enabled: Optional[bool] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_access_token: Optional[str] = None
    whatsapp_recipient_number: Optional[str] = None
    facebook_verify_token: Optional[str] = None
    facebook_access_token: Optional[str] = None


class WhatsAppSettingsUpdate(BaseModel):
    phone_number_id: str
    access_token: str
    recipient_number: Optional[str] = None


class FacebookSettingsUpdate(BaseModel):
    verify_token: str
    access_token: str
