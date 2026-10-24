"""deadlines can be crossed off

Revision ID: b7d2e4f19c60
Revises: 5e0c7b1d9a42
Create Date: 2026-11-07 12:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d2e4f19c60'
down_revision: Union[str, Sequence[str], None] = '5e0c7b1d9a42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('completed', sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.drop_column('completed')
