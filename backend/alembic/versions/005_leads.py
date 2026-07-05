"""create leads table

Revision ID: 005
Revises: 004
Create Date: 2026-07-05

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("phone_number", sa.String(), nullable=False),
        sa.Column("customer_name", sa.String(), nullable=True),
        sa.Column("messenger_name", sa.String(), nullable=True),
        sa.Column("facebook_psid", sa.String(), nullable=True),
        sa.Column("conversation_id", sa.String(), nullable=True),
        sa.Column("page_name", sa.String(), nullable=True),
        sa.Column("first_detected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_message", sa.Text(), nullable=True),
        sa.Column("detection_count", sa.Integer(), default=1),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("phone_number", name="uq_lead_phone"),
    )
    op.create_index(op.f("ix_leads_phone_number"), "leads", ["phone_number"])
    op.create_index(op.f("ix_leads_facebook_psid"), "leads", ["facebook_psid"])
    op.create_index(op.f("ix_leads_conversation_id"), "leads", ["conversation_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_leads_conversation_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_facebook_psid"), table_name="leads")
    op.drop_index(op.f("ix_leads_phone_number"), table_name="leads")
    op.drop_table("leads")
