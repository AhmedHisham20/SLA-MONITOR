"""add unanswered_count and unanswered_texts to conversations

Revision ID: 003
Revises: 002
Create Date: 2026-06-25

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("conversations", sa.Column("unanswered_count", sa.Integer(), default=0, server_default="0"))
    op.add_column("conversations", sa.Column("unanswered_texts", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("conversations", "unanswered_texts")
    op.drop_column("conversations", "unanswered_count")
