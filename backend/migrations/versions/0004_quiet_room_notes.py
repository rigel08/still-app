"""quiet room presence sessions and anonymous notes

Revision ID: 0004
Revises: 0003
"""
import sqlalchemy as sa
from alembic import op
revision = '0004'; down_revision = '0003'; branch_labels = None; depends_on = None
def upgrade() -> None:
    op.create_table('quiet_sessions', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False), sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False), sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_quiet_sessions_user_id', 'quiet_sessions', ['user_id']); op.create_index('ix_quiet_sessions_last_seen_at', 'quiet_sessions', ['last_seen_at'])
    op.create_table('notes', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('author_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('body', sa.String(280), nullable=False),
        sa.Column('status', sa.String(12), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))
    for c in ('author_id', 'status', 'created_at'): op.create_index(f'ix_notes_{c}', 'notes', [c])
def downgrade() -> None:
    op.drop_table('notes'); op.drop_table('quiet_sessions')
