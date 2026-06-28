import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer
from app.db.session import Base


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_name = Column(String, default="SLA Monitor")
    timezone = Column(String, default="Africa/Cairo")
    working_hours_start = Column(String, default="10:00")
    working_hours_end = Column(String, default="22:00")
    sla_threshold_minutes = Column(Integer, default=5)
    escalation_admin_minutes = Column(Integer, default=10)
    escalation_critical_minutes = Column(Integer, default=15)
    daily_summary_enabled = Column(Boolean, default=True)
    daily_summary_time = Column(String, default="23:00")
    weekly_summary_enabled = Column(Boolean, default=True)
    whatsapp_phone_number_id = Column(String, nullable=True)
    whatsapp_access_token = Column(Text, nullable=True)
    whatsapp_recipient_number = Column(String, nullable=True)
    facebook_verify_token = Column(String, nullable=True)
    facebook_access_token = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
