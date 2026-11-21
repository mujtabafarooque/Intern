from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

RoleType = Literal["admin", "developer", "viewer"]
IssueType = Literal["bug", "task", "feature"]
StatusType = Literal["todo", "in_progress", "in_review", "done"]
PriorityType = Literal["low", "medium", "high", "critical"]


# ---------- Auth & Users ----------
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=120)
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    avatar_color: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Projects & Members ----------
class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=140)
    key: str = Field(..., min_length=2, max_length=10, pattern=r"^[A-Za-z][A-Za-z0-9]*$")
    description: Optional[str] = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=140)
    description: Optional[str] = None


class MemberAdd(BaseModel):
    email: EmailStr
    role: RoleType = "developer"


class MemberRoleUpdate(BaseModel):
    role: RoleType


class ProjectMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    role: RoleType
    joined_at: datetime
    user: UserOut


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    key: str
    description: Optional[str]
    owner_id: int
    created_at: datetime
    current_user_role: RoleType
    ticket_count: int = 0
    members: List[ProjectMemberOut] = []


# ---------- Comments & Attachments ----------
class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)
    parent_id: Optional[int] = None


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    author_id: int
    parent_id: Optional[int]
    body: str
    created_at: datetime
    updated_at: datetime
    author: UserOut
    replies: List["CommentOut"] = []


CommentOut.model_rebuild()


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    uploaded_by_id: int
    original_filename: str
    content_type: str
    file_size: int
    url: str
    created_at: datetime
    uploaded_by: UserOut


# ---------- Tickets ----------
class TicketCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = ""
    issue_type: IssueType = "bug"
    status: StatusType = "todo"
    priority: PriorityType = "medium"
    assignee_id: Optional[int] = None
    due_date: Optional[str] = None


class TicketUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    issue_type: Optional[IssueType] = None
    status: Optional[StatusType] = None
    priority: Optional[PriorityType] = None
    assignee_id: Optional[int] = None
    clear_assignee: Optional[bool] = False
    due_date: Optional[str] = None
    position: Optional[int] = None


class TicketReorderRequest(BaseModel):
    status: StatusType
    position: int = 0


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_key: str
    project_id: int
    title: str
    description: Optional[str]
    issue_type: IssueType
    status: StatusType
    priority: PriorityType
    position: int
    reporter_id: int
    assignee_id: Optional[int]
    due_date: Optional[str]
    created_at: datetime
    updated_at: datetime
    reporter: UserOut
    assignee: Optional[UserOut] = None
    comment_count: int = 0
    attachment_count: int = 0


class TicketDetailOut(TicketOut):
    comments: List[CommentOut] = []
    attachments: List[AttachmentOut] = []
