"""project briefs and nudges

Revision ID: c4e8a1f2b905
Revises: b7d2e4f19c60
Create Date: 2026-11-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4e8a1f2b905'
down_revision: Union[str, Sequence[str], None] = 'b7d2e4f19c60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('description', sa.String(), nullable=True))
    op.create_table(
        'nudges',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('cohort_id', sa.String(), nullable=False),
        sa.Column('requirement_id', sa.String(), nullable=True),
        sa.Column('subject_id', sa.String(), nullable=False),
        sa.Column('sent_by', sa.String(), nullable=True),
        sa.Column('sent_on', sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(['cohort_id'], ['cohorts.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('nudges', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_nudges_cohort_id'), ['cohort_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_nudges_requirement_id'), ['requirement_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_nudges_subject_id'), ['subject_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('nudges', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_nudges_subject_id'))
        batch_op.drop_index(batch_op.f('ix_nudges_requirement_id'))
        batch_op.drop_index(batch_op.f('ix_nudges_cohort_id'))
    op.drop_table('nudges')
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_column('description')
