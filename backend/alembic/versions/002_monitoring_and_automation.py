"""add monitoring_enabled, has_human_reply, has_automated_reply fields

Revision ID: 002
Revises: 001
Create Date: 2026-06-02

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("facebook_pages", sa.Column("monitoring_enabled", sa.Boolean(), default=False, server_default="false"))
    op.add_column("facebook_pages", sa.Column("last_webhook_activity", sa.DateTime(timezone=True), nullable=True))

    op.add_column("conversations", sa.Column("has_human_reply", sa.Boolean(), default=False, server_default="false"))
    op.add_column("conversations", sa.Column("has_automated_reply", sa.Boolean(), default=False, server_default="false"))
    op.add_column("conversations", sa.Column("automated_message_count", sa.Integer(), default=0, server_default="0"))


def downgrade() -> None:
    op.drop_column("conversations", "automated_message_count")
    op.drop_column("conversations", "has_automated_reply")
    op.drop_column("conversations", "has_human_reply")
    op.drop_column("facebook_pages", "last_webhook_activity")
    op.drop_column("facebook_pages", "monitoring_enabled")
