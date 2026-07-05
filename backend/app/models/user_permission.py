import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from app.db.session import Base


ALL_PERMISSIONS = [
    "home",
    "dashboard",
    "conversations",
    "reports",
    "facebook_pages",
    "whatsapp",
    "logs",
    "backup",
    "settings",
    "user_management",
    "leads_crm",
]


class UserPermission(Base):
    __tablename__ = "user_permissions"
    __table_args__ = (
        UniqueConstraint("user_id", "permission", name="uq_user_permission"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
