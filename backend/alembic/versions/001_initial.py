"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-02

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("role", sa.Enum("admin", "manager", name="userrole"), nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "facebook_pages",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("page_id", sa.String(), nullable=False),
        sa.Column("page_name", sa.String(), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("is_connected", sa.Boolean(), default=True),
        sa.Column("webhook_subscribed", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("page_id"),
    )
    op.create_index("ix_facebook_pages_page_id", "facebook_pages", ["page_id"])

    op.create_table(
        "conversations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("page_id", sa.String(), nullable=False),
        sa.Column("conversation_id", sa.String(), nullable=False),
        sa.Column("customer_id", sa.String(), nullable=False),
        sa.Column("customer_name", sa.String(), nullable=True),
        sa.Column("moderator_name", sa.String(), nullable=True),
        sa.Column("message_content", sa.Text(), nullable=True),
        sa.Column("message_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("first_reply_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("response_time_seconds", sa.Integer(), nullable=True),
        sa.Column("sla_status", sa.String(), default="pending"),
        sa.Column("delay_level", sa.String(), default="none"),
        sa.Column("is_open", sa.Boolean(), default=True),
        sa.Column("alert_sent", sa.Boolean(), default=False),
        sa.Column("alert_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_working_hours", sa.Boolean(), default=True),
        sa.Column("message_count", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["page_id"], ["facebook_pages.page_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_conversations_conversation_id", "conversations", ["conversation_id"])
    op.create_index("ix_conversations_customer_id", "conversations", ["customer_id"])
    op.create_index("ix_conversations_page_id", "conversations", ["page_id"])

    op.create_table(
        "alerts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("conversation_id", sa.String(), nullable=False),
        sa.Column("alert_type", sa.String(), default="whatsapp"),
        sa.Column("recipient", sa.String(), nullable=False),
        sa.Column("message_body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), default="sent"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("meta_alert_id", sa.String(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alerts_conversation_id", "alerts", ["conversation_id"])

    op.create_table(
        "system_settings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("company_name", sa.String(), default="SLA Monitor"),
        sa.Column("timezone", sa.String(), default="UTC"),
        sa.Column("working_hours_start", sa.String(), default="10:00"),
        sa.Column("working_hours_end", sa.String(), default="22:00"),
        sa.Column("sla_threshold_minutes", sa.Integer(), default=5),
        sa.Column("escalation_admin_minutes", sa.Integer(), default=10),
        sa.Column("escalation_critical_minutes", sa.Integer(), default=15),
        sa.Column("daily_summary_enabled", sa.Boolean(), default=True),
        sa.Column("daily_summary_time", sa.String(), default="23:00"),
        sa.Column("weekly_summary_enabled", sa.Boolean(), default=True),
        sa.Column("whatsapp_phone_number_id", sa.String(), nullable=True),
        sa.Column("whatsapp_access_token", sa.Text(), nullable=True),
        sa.Column("facebook_verify_token", sa.String(), nullable=True),
        sa.Column("facebook_access_token", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("system_settings")
    op.drop_table("alerts")
    op.drop_table("conversations")
    op.drop_table("facebook_pages")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS userrole")
