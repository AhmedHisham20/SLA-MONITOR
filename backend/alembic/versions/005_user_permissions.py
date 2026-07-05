"""create user_permissions table

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
        "user_permissions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("permission", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "permission", name="uq_user_permission"),
    )
    op.create_index(op.f("ix_user_permissions_user_id"), "user_permissions", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_user_permissions_user_id"), table_name="user_permissions")
    op.drop_table("user_permissions")
