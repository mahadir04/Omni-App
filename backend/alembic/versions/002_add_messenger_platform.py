"""Add 'messenger' to platform_connections platform check constraint.

Revision ID: 002
Revises: 001
Create Date: 2026-09-11
"""

from alembic import op

# revision identifiers, used by Alembic
revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the old constraint that excluded 'messenger'
    op.drop_constraint(
        "ck_platform_connections_platform",
        "platform_connections",
        type_="check",
    )
    # Recreate it with 'messenger' included
    op.create_check_constraint(
        "ck_platform_connections_platform",
        "platform_connections",
        "platform IN ('whatsapp','slack','email','linkedin','sms','messenger')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_platform_connections_platform",
        "platform_connections",
        type_="check",
    )
    op.create_check_constraint(
        "ck_platform_connections_platform",
        "platform_connections",
        "platform IN ('whatsapp','slack','email','linkedin','sms')",
    )
