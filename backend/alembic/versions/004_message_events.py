"""create message_events table

Revision ID: 004
Revises: 003
Create Date: 2026-06-25

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "message_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("conversation_id", sa.String(), nullable=False),
        sa.Column("customer_id", sa.String(), nullable=False),
        sa.Column("page_id", sa.String(), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("response_time_seconds", sa.Integer(), nullable=True),
        sa.Column("sla_exceeded", sa.Boolean(), default=False),
        sa.Column("moderator_name", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_message_events_conversation_id"), "message_events", ["conversation_id"])
    op.create_index(op.f("ix_message_events_customer_id"), "message_events", ["customer_id"])
    op.create_index(op.f("ix_message_events_page_id"), "message_events", ["page_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_message_events_page_id"), table_name="message_events")
    op.drop_index(op.f("ix_message_events_customer_id"), table_name="message_events")
    op.drop_index(op.f("ix_message_events_conversation_id"), table_name="message_events")
    op.drop_table("message_events")
