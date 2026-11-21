from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(120), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    avatar_color = Column(String(32), nullable=False, default="#4F46E5")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    owned_projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")
    reported_tickets = relationship(
        "Ticket",
        foreign_keys="Ticket.reporter_id",
        back_populates="reporter",
    )
    assigned_tickets = relationship(
        "Ticket",
        foreign_keys="Ticket.assignee_id",
        back_populates="assignee",
    )


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(140), nullable=False)
    key = Column(String(12), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    owner = relationship("User", back_populates="owned_projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    tickets = relationship("Ticket", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_project_user_member"),)

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False, default="developer")  # admin | developer | viewer
    joined_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="memberships")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_key = Column(String(32), unique=True, index=True, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    issue_type = Column(String(20), nullable=False, default="bug")      # bug | task | feature
    status = Column(String(20), nullable=False, default="todo", index=True)  # todo | in_progress | in_review | done
    priority = Column(String(20), nullable=False, default="medium", index=True)  # low | medium | high | critical
    position = Column(Integer, nullable=False, default=0)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    due_date = Column(String(32), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    project = relationship("Project", back_populates="tickets")
    reporter = relationship("User", foreign_keys=[reporter_id], back_populates="reported_tickets")
    assignee = relationship("User", foreign_keys=[assignee_id], back_populates="assigned_tickets")
    comments = relationship("Comment", back_populates="ticket", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="ticket", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    ticket = relationship("Ticket", back_populates="comments")
    author = relationship("User")
    replies = relationship(
        "Comment",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="Comment.created_at.asc()",
    )
    parent = relationship("Comment", remote_side=[id], back_populates="replies")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    url = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    ticket = relationship("Ticket", back_populates="attachments")
    uploaded_by = relationship("User")
