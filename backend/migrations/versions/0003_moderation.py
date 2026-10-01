"""moderator role, report review fields, moderation audit log

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op
revision = '0003'; down_revision = '0002'; branch_labels = None; depends_on = None

def upgrade() -> None:
    op.add_column('users', sa.Column('role', sa.String(12), nullable=False, server_default='user'))
    with op.batch_alter_table('reports') as b:
        b.add_column(sa.Column('reviewed_by', sa.Integer(), nullable=True)); b.add_column(sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))
        b.create_foreign_key('fk_reports_reviewed_by_users', 'users', ['reviewed_by'], ['id'], ondelete='SET NULL')
    op.create_table('moderation_log', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('moderator_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('moderator', sa.String(24), nullable=False), sa.Column('action', sa.String(24), nullable=False), sa.Column('report_id', sa.Integer(), nullable=True), sa.Column('target_type', sa.String(8), nullable=True),
        sa.Column('target_id', sa.Integer(), nullable=True), sa.Column('note', sa.String(500), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_moderation_log_moderator_id', 'moderation_log', ['moderator_id']); op.create_index('ix_moderation_log_created_at', 'moderation_log', ['created_at'])

def downgrade() -> None:
    op.drop_table('moderation_log')
    with op.batch_alter_table('reports') as b:
        b.drop_constraint('fk_reports_reviewed_by_users', type_='foreignkey'); b.drop_column('reviewed_at'); b.drop_column('reviewed_by')
    op.drop_column('users', 'role')
