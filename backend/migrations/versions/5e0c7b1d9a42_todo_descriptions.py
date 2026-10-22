"""todo descriptions

Revision ID: 5e0c7b1d9a42
Revises: 88a94cc2ac07
Create Date: 2026-11-07 12:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e0c7b1d9a42'
down_revision: Union[str, Sequence[str], None] = '88a94cc2ac07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('personal_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('personal_items', schema=None) as batch_op:
        batch_op.drop_column('description')
