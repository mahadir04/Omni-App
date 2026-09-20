"""Add device_connections table and metadata column to conversations.

Revision ID: 003
Revises: 002
Create Date: 2026-09-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── device_connections ────────────────────────────────────────────────
    op.create_table(
        "device_connections",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("device_id", sa.Text(), nullable=False, unique=True),
        sa.Column("device_secret_hash", sa.Text(), nullable=False),
        sa.Column("device_name", sa.Text(), nullable=False, server_default="Android Device"),
        sa.Column("is_online", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_seen_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "metadata", postgresql.JSONB(), nullable=False, server_default="{}"
        ),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── Add metadata_ JSONB to conversations ──────────────────────────────
    # Stores phone bridge routing info: source, device_id, notification_key, app_package
    op.add_column(
        "conversations",
        sa.Column(
            "metadata", postgresql.JSONB(), nullable=False, server_default="{}"
        ),
    )


def downgrade() -> None:
    op.drop_column("conversations", "metadata")
    op.drop_table("device_connections")
