"""partners, notes on any record, and owners

Revision ID: 8c41f2d7a0b3
Revises: 2781a9ab7f56
Create Date: 2026-11-07 00:40:00.000000

"""
import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8c41f2d7a0b3'
down_revision: Union[str, Sequence[str], None] = '2781a9ab7f56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('partners',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('program_id', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('website', sa.String(), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('owner_id', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('partners', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_partners_owner_id'), ['owner_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_partners_program_id'), ['program_id'], unique=False)

    op.create_table('partner_contacts',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('partner_id', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('title', sa.String(), nullable=True),
    sa.Column('email', sa.String(), nullable=True),
    sa.Column('phone', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['partner_id'], ['partners.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('partner_contacts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_partner_contacts_partner_id'), ['partner_id'], unique=False)

    op.create_table('notes',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('subject_type', sa.String(), nullable=False),
    sa.Column('subject_id', sa.String(), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('author', sa.String(), nullable=True),
    sa.Column('follow_up_date', sa.Date(), nullable=True),
    sa.Column('follow_up_done', sa.Boolean(), server_default=sa.false(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('notes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_notes_subject_id'), ['subject_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_notes_subject_type'), ['subject_type'], unique=False)

    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('partner_id', sa.String(), nullable=True))
        batch_op.create_index(batch_op.f('ix_projects_partner_id'), ['partner_id'], unique=False)
        batch_op.create_foreign_key('fk_projects_partner_id', 'partners', ['partner_id'], ['id'])

    with op.batch_alter_table('teams', schema=None) as batch_op:
        batch_op.add_column(sa.Column('owner_id', sa.String(), nullable=True))
        batch_op.create_index(batch_op.f('ix_teams_owner_id'), ['owner_id'], unique=False)
        batch_op.create_foreign_key('fk_teams_owner_id', 'users', ['owner_id'], ['id'])

    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('partner_id', sa.String(), nullable=True))
        batch_op.create_index(batch_op.f('ix_events_partner_id'), ['partner_id'], unique=False)
        batch_op.create_foreign_key('fk_events_partner_id', 'partners', ['partner_id'], ['id'])

    # Each partner name on a project becomes a partner, one per program.
    bind = op.get_bind()
    named = bind.execute(sa.text(
        """
        SELECT p.id, p.partner, c.program_id FROM projects p
        JOIN cohorts c ON c.id = p.cohort_id
        WHERE p.partner IS NOT NULL AND p.partner != ''
        """
    )).fetchall()
    partner_ids: dict[tuple[str, str], str] = {}
    for project_id, name, program_id in named:
        key = (program_id, name.strip().lower())
        if key not in partner_ids:
            base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "partner"
            partner_id = f"partner-{base}"
            taken = set(partner_ids.values())
            n = 2
            while partner_id in taken:
                partner_id, n = f"partner-{base}-{n}", n + 1
            partner_ids[key] = partner_id
            bind.execute(
                sa.text(
                    "INSERT INTO partners (id, program_id, name, created_at) "
                    "VALUES (:id, :program_id, :name, CURRENT_TIMESTAMP)"
                ),
                {"id": partner_id, "program_id": program_id, "name": name.strip()},
            )
        bind.execute(
            sa.text("UPDATE projects SET partner_id = :partner_id WHERE id = :id"),
            {"partner_id": partner_ids[key], "id": project_id},
        )

    # An event hosted by a partner was already that partner's event.
    hosted = bind.execute(sa.text(
        """
        SELECT e.id, e.host, c.program_id FROM events e
        JOIN cohorts c ON c.id = e.cohort_id
        WHERE e.host IS NOT NULL
        """
    )).fetchall()
    for event_id, host, program_id in hosted:
        partner_id = partner_ids.get((program_id, host.strip().lower()))
        if partner_id:
            bind.execute(
                sa.text("UPDATE events SET partner_id = :partner_id WHERE id = :id"),
                {"partner_id": partner_id, "id": event_id},
            )

    op.execute(
        """
        INSERT INTO notes (id, subject_type, subject_id, body, author, follow_up_done, created_at, updated_at)
        SELECT id, 'team', team_id, body, author, false, created_at, updated_at FROM team_notes
        """
    )

    with op.batch_alter_table('team_notes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_team_notes_team_id'))
    op.drop_table('team_notes')

    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_column('partner')


def downgrade() -> None:
    """Downgrade schema. Contacts, follow-ups, owners and notes on people or partners are lost."""
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('partner', sa.String(), nullable=True))
    op.execute("UPDATE projects SET partner = (SELECT name FROM partners WHERE partners.id = projects.partner_id)")

    op.create_table('team_notes',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('team_id', sa.String(), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('author', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('team_notes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_team_notes_team_id'), ['team_id'], unique=False)
    op.execute(
        """
        INSERT INTO team_notes (id, team_id, body, author, created_at, updated_at)
        SELECT id, subject_id, body, author, created_at, updated_at FROM notes WHERE subject_type = 'team'
        """
    )

    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.drop_constraint('fk_events_partner_id', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_events_partner_id'))
        batch_op.drop_column('partner_id')

    with op.batch_alter_table('teams', schema=None) as batch_op:
        batch_op.drop_constraint('fk_teams_owner_id', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_teams_owner_id'))
        batch_op.drop_column('owner_id')

    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_constraint('fk_projects_partner_id', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_projects_partner_id'))
        batch_op.drop_column('partner_id')

    with op.batch_alter_table('notes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_notes_subject_type'))
        batch_op.drop_index(batch_op.f('ix_notes_subject_id'))
    op.drop_table('notes')

    with op.batch_alter_table('partner_contacts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_partner_contacts_partner_id'))
    op.drop_table('partner_contacts')

    with op.batch_alter_table('partners', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_partners_program_id'))
        batch_op.drop_index(batch_op.f('ix_partners_owner_id'))
    op.drop_table('partners')
