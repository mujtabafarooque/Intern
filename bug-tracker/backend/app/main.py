import os
import re
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import Base, SessionLocal, engine, get_db
from app.security import create_access_token, get_current_user, get_password_hash, verify_password

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

AVATAR_PALETTE = [
    "#4F46E5",
    "#0891B2",
    "#059669",
    "#D97706",
    "#DC2626",
    "#7C3AED",
    "#DB2777",
]

ALLOWED_UPLOAD_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".pdf",
    ".txt",
    ".log",
    ".md",
    ".json",
    ".zip",
}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def pick_avatar_color(seed: str) -> str:
    return AVATAR_PALETTE[sum(ord(ch) for ch in seed) % len(AVATAR_PALETTE)]


def seed_initial_data() -> None:
    db = SessionLocal()
    try:
        if db.query(models.User).count() > 0:
            return

        admin = models.User(
            email="admin@issueflow.dev",
            full_name="Aarav Mehta (Admin)",
            hashed_password=get_password_hash("Admin@123"),
            avatar_color="#4F46E5",
        )
        dev = models.User(
            email="dev@issueflow.dev",
            full_name="Riya Kulkarni (Dev)",
            hashed_password=get_password_hash("Dev@123"),
            avatar_color="#059669",
        )
        viewer = models.User(
            email="viewer@issueflow.dev",
            full_name="Kabir Joshi (Viewer)",
            hashed_password=get_password_hash("Viewer@123"),
            avatar_color="#0891B2",
        )
        db.add_all([admin, dev, viewer])
        db.flush()

        project = models.Project(
            name="IssueFlow Core Platform",
            key="IF",
            description="Primary engineering workspace for API reliability, Kanban workflow, and release tracking.",
            owner_id=admin.id,
        )
        db.add(project)
        db.flush()

        db.add_all(
            [
                models.ProjectMember(project_id=project.id, user_id=admin.id, role="admin"),
                models.ProjectMember(project_id=project.id, user_id=dev.id, role="developer"),
                models.ProjectMember(project_id=project.id, user_id=viewer.id, role="viewer"),
            ]
        )

        sample_tickets = [
            models.Ticket(
                ticket_key="IF-1",
                project_id=project.id,
                title="JWT refresh rotation returns 401 when clock skew exceeds 5s",
                description="Users behind corporate VPNs occasionally receive an invalid token error right after login. Reproduce by setting system clock +6 seconds.",
                issue_type="bug",
                status="in_progress",
                priority="critical",
                position=0,
                reporter_id=admin.id,
                assignee_id=dev.id,
                due_date="2026-12-05",
            ),
            models.Ticket(
                ticket_key="IF-2",
                project_id=project.id,
                title="Add bulk CSV export for filtered sprint issues",
                description="Product managers need a one-click CSV export respecting active priority, assignee, and status filters.",
                issue_type="feature",
                status="todo",
                priority="high",
                position=0,
                reporter_id=admin.id,
                assignee_id=dev.id,
                due_date="2026-12-12",
            ),
            models.Ticket(
                ticket_key="IF-3",
                project_id=project.id,
                title="Optimize PostgreSQL composite index on (project_id, status, position)",
                description="Ensure Kanban board column ordering executes in <5ms on boards with 5,000+ tickets.",
                issue_type="task",
                status="in_review",
                priority="medium",
                position=0,
                reporter_id=dev.id,
                assignee_id=admin.id,
                due_date="2026-12-03",
            ),
            models.Ticket(
                ticket_key="IF-4",
                project_id=project.id,
                title="Configure Swagger OpenAPI BearerAuth security scheme",
                description="Allow developers to paste their JWT directly in /docs Authorize modal.",
                issue_type="task",
                status="done",
                priority="low",
                position=0,
                reporter_id=admin.id,
                assignee_id=admin.id,
            ),
        ]
        db.add_all(sample_tickets)
        db.flush()

        root_comment = models.Comment(
            ticket_id=sample_tickets[0].id,
            author_id=admin.id,
            body="Confirmed in staging logs. Please add a 30-second leeway parameter during JWT decode verification.",
        )
        db.add(root_comment)
        db.flush()

        reply_comment = models.Comment(
            ticket_id=sample_tickets[0].id,
            author_id=dev.id,
            parent_id=root_comment.id,
            body="On it! Patching token verification and adding a unit test with mocked timestamps.",
        )
        db.add(reply_comment)
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_initial_data()
    yield


app = FastAPI(
    title="IssueFlow Bug & Issue Tracker API",
    description="Jira-like Issue Tracker with JWT Auth, Role-Based Access Control, Kanban Workflow, Threaded Comments, and Attachments.",
    version="1.0.0",
    lifespan=lifespan,
)

raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


# ---------- Helper Utilities ----------
def get_membership_or_403(db: Session, project_id: int, user_id: int) -> models.ProjectMember:
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    member = (
        db.query(models.ProjectMember)
        .filter(
            models.ProjectMember.project_id == project_id,
            models.ProjectMember.user_id == user_id,
        )
        .first()
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project",
        )
    return member


def require_roles(member: models.ProjectMember, allowed_roles: tuple[str, ...]) -> None:
    if member.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: requires role {', '.join(allowed_roles)} (your role: {member.role})",
        )


def serialize_project(db: Session, project: models.Project, role: str) -> schemas.ProjectOut:
    members = (
        db.query(models.ProjectMember)
        .options(joinedload(models.ProjectMember.user))
        .filter(models.ProjectMember.project_id == project.id)
        .order_by(models.ProjectMember.joined_at.asc())
        .all()
    )
    ticket_count = (
        db.query(func.count(models.Ticket.id))
        .filter(models.Ticket.project_id == project.id)
        .scalar()
        or 0
    )
    return schemas.ProjectOut(
        id=project.id,
        name=project.name,
        key=project.key,
        description=project.description,
        owner_id=project.owner_id,
        created_at=project.created_at,
        current_user_role=role,
        ticket_count=ticket_count,
        members=members,
    )


def serialize_ticket(db: Session, ticket: models.Ticket) -> schemas.TicketOut:
    comment_count = (
        db.query(func.count(models.Comment.id))
        .filter(models.Comment.ticket_id == ticket.id)
        .scalar()
        or 0
    )
    attachment_count = (
        db.query(func.count(models.Attachment.id))
        .filter(models.Attachment.ticket_id == ticket.id)
        .scalar()
        or 0
    )
    return schemas.TicketOut(
        id=ticket.id,
        ticket_key=ticket.ticket_key,
        project_id=ticket.project_id,
        title=ticket.title,
        description=ticket.description,
        issue_type=ticket.issue_type,
        status=ticket.status,
        priority=ticket.priority,
        position=ticket.position,
        reporter_id=ticket.reporter_id,
        assignee_id=ticket.assignee_id,
        due_date=ticket.due_date,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        reporter=ticket.reporter,
        assignee=ticket.assignee,
        comment_count=comment_count,
        attachment_count=attachment_count,
    )


def build_comment_tree(comments: List[models.Comment]) -> List[schemas.CommentOut]:
    nodes: dict[int, schemas.CommentOut] = {}
    for c in comments:
        nodes[c.id] = schemas.CommentOut(
            id=c.id,
            ticket_id=c.ticket_id,
            author_id=c.author_id,
            parent_id=c.parent_id,
            body=c.body,
            created_at=c.created_at,
            updated_at=c.updated_at,
            author=c.author,
            replies=[],
        )
    roots: List[schemas.CommentOut] = []
    for c in comments:
        node = nodes[c.id]
        if c.parent_id and c.parent_id in nodes:
            nodes[c.parent_id].replies.append(node)
        else:
            roots.append(node)
    return roots


def generate_next_ticket_key(db: Session, project: models.Project) -> str:
    existing_keys = (
        db.query(models.Ticket.ticket_key)
        .filter(models.Ticket.project_id == project.id)
        .all()
    )
    max_num = 0
    prefix = f"{project.key}-"
    for (k,) in existing_keys:
        if k.startswith(prefix):
            suffix = k[len(prefix) :]
            if suffix.isdigit():
                max_num = max(max_num, int(suffix))
    return f"{project.key}-{max_num + 1}"


# ---------- Health Check ----------
@app.get("/api/health", tags=["System"])
def health_check():
    return {"status": "ok", "service": "IssueFlow API"}


# ---------- Auth Routes ----------
@app.post("/api/auth/register", response_model=schemas.TokenResponse, status_code=status.HTTP_201_CREATED, tags=["Auth"])
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    existing = db.query(models.User).filter(models.User.email == normalized_email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already registered")

    user = models.User(
        email=normalized_email,
        full_name=payload.full_name.strip(),
        hashed_password=get_password_hash(payload.password),
        avatar_color=pick_avatar_color(normalized_email),
    )
    db.add(user)
    db.flush()

    # Auto-create a personal starter workspace so new users immediately have a working board
    base_key = re.sub(r"[^A-Z]", "", payload.full_name.upper())[:3] or "PRJ"
    candidate_key = base_key
    counter = 1
    while db.query(models.Project).filter(models.Project.key == candidate_key).first():
        candidate_key = f"{base_key}{counter}"
        counter += 1

    starter_project = models.Project(
        name=f"{payload.full_name.strip().split()[0]}'s Workspace",
        key=candidate_key,
        description="Default workspace created on registration.",
        owner_id=user.id,
    )
    db.add(starter_project)
    db.flush()
    db.add(models.ProjectMember(project_id=starter_project.id, user_id=user.id, role="admin"))

    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return schemas.TokenResponse(access_token=token, user=user)


@app.post("/api/auth/login", response_model=schemas.TokenResponse, tags=["Auth"])
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == normalized_email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token = create_access_token({"sub": str(user.id)})
    return schemas.TokenResponse(access_token=token, user=user)


@app.get("/api/auth/me", response_model=schemas.UserOut, tags=["Auth"])
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@app.get("/api/users", response_model=List[schemas.UserOut], tags=["Users"])
def list_users(
    q: Optional[str] = Query(None, description="Search users by name or email"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.User)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(models.User.full_name.ilike(term), models.User.email.ilike(term))
        )
    return query.order_by(models.User.full_name.asc()).limit(50).all()


# ---------- Project & Team Management Routes ----------
@app.get("/api/projects", response_model=List[schemas.ProjectOut], tags=["Projects"])
def list_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = (
        db.query(models.ProjectMember)
        .options(joinedload(models.ProjectMember.project))
        .filter(models.ProjectMember.user_id == current_user.id)
        .order_by(models.ProjectMember.joined_at.asc())
        .all()
    )
    return [serialize_project(db, m.project, m.role) for m in memberships]


@app.post("/api/projects", response_model=schemas.ProjectOut, status_code=status.HTTP_201_CREATED, tags=["Projects"])
def create_project(
    payload: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    clean_key = payload.key.strip().upper()
    if db.query(models.Project).filter(models.Project.key == clean_key).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project key '{clean_key}' already exists",
        )

    project = models.Project(
        name=payload.name.strip(),
        key=clean_key,
        description=(payload.description or "").strip(),
        owner_id=current_user.id,
    )
    db.add(project)
    db.flush()

    membership = models.ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role="admin",
    )
    db.add(membership)
    db.commit()
    db.refresh(project)
    return serialize_project(db, project, "admin")


@app.get("/api/projects/{project_id}", response_model=schemas.ProjectOut, tags=["Projects"])
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = get_membership_or_403(db, project_id, current_user.id)
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    return serialize_project(db, project, member.role)


@app.patch("/api/projects/{project_id}", response_model=schemas.ProjectOut, tags=["Projects"])
def update_project(
    project_id: int,
    payload: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = get_membership_or_403(db, project_id, current_user.id)
    require_roles(member, ("admin",))

    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.description is not None:
        project.description = payload.description.strip()

    db.commit()
    db.refresh(project)
    return serialize_project(db, project, member.role)


@app.delete("/api/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Projects"])
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = get_membership_or_403(db, project_id, current_user.id)
    require_roles(member, ("admin",))

    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    db.delete(project)
    db.commit()
    return None


@app.post("/api/projects/{project_id}/members", response_model=schemas.ProjectOut, tags=["Team"])
def add_project_member(
    project_id: int,
    payload: schemas.MemberAdd,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = get_membership_or_403(db, project_id, current_user.id)
    require_roles(member, ("admin",))

    target_user = (
        db.query(models.User)
        .filter(models.User.email == payload.email.strip().lower())
        .first()
    )
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user found with that email address. Ask them to register first.",
        )

    existing_member = (
        db.query(models.ProjectMember)
        .filter(
            models.ProjectMember.project_id == project_id,
            models.ProjectMember.user_id == target_user.id,
        )
        .first()
    )
    if existing_member:
        existing_member.role = payload.role
    else:
        db.add(
            models.ProjectMember(
                project_id=project_id,
                user_id=target_user.id,
                role=payload.role,
            )
        )

    db.commit()
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    return serialize_project(db, project, member.role)


@app.patch("/api/projects/{project_id}/members/{user_id}", response_model=schemas.ProjectOut, tags=["Team"])
def update_project_member_role(
    project_id: int,
    user_id: int,
    payload: schemas.MemberRoleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    caller = get_membership_or_403(db, project_id, current_user.id)
    require_roles(caller, ("admin",))

    target_member = (
        db.query(models.ProjectMember)
        .filter(
            models.ProjectMember.project_id == project_id,
            models.ProjectMember.user_id == user_id,
        )
        .first()
    )
    if not target_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in project")

    if target_member.role == "admin" and payload.role != "admin":
        admin_count = (
            db.query(func.count(models.ProjectMember.id))
            .filter(
                models.ProjectMember.project_id == project_id,
                models.ProjectMember.role == "admin",
            )
            .scalar()
        )
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project must retain at least one Admin",
            )

    target_member.role = payload.role
    db.commit()
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    return serialize_project(db, project, caller.role)


@app.delete("/api/projects/{project_id}/members/{user_id}", response_model=schemas.ProjectOut, tags=["Team"])
def remove_project_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    caller = get_membership_or_403(db, project_id, current_user.id)
    require_roles(caller, ("admin",))

    target_member = (
        db.query(models.ProjectMember)
        .filter(
            models.ProjectMember.project_id == project_id,
            models.ProjectMember.user_id == user_id,
        )
        .first()
    )
    if not target_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in project")

    if target_member.role == "admin":
        admin_count = (
            db.query(func.count(models.ProjectMember.id))
            .filter(
                models.ProjectMember.project_id == project_id,
                models.ProjectMember.role == "admin",
            )
            .scalar()
        )
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last Admin from a project",
            )

    db.delete(target_member)
    db.commit()
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    return serialize_project(db, project, caller.role)


# ---------- Ticket CRUD, Filters, Search & Kanban Reorder ----------
@app.get("/api/projects/{project_id}/tickets", response_model=List[schemas.TicketOut], tags=["Tickets"])
def list_tickets(
    project_id: int,
    search: Optional[str] = Query(None, description="Keyword search across key, title, and description"),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    issue_type: Optional[str] = Query(None),
    assignee_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_membership_or_403(db, project_id, current_user.id)

    query = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.reporter),
            joinedload(models.Ticket.assignee),
        )
        .filter(models.Ticket.project_id == project_id)
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Ticket.ticket_key.ilike(term),
                models.Ticket.title.ilike(term),
                models.Ticket.description.ilike(term),
            )
        )
    if status_filter and status_filter != "all":
        query = query.filter(models.Ticket.status == status_filter)
    if priority and priority != "all":
        query = query.filter(models.Ticket.priority == priority)
    if issue_type and issue_type != "all":
        query = query.filter(models.Ticket.issue_type == issue_type)
    if assignee_id is not None:
        if assignee_id == 0:
            query = query.filter(models.Ticket.assignee_id.is_(None))
        else:
            query = query.filter(models.Ticket.assignee_id == assignee_id)

    tickets = query.order_by(models.Ticket.position.asc(), models.Ticket.id.desc()).all()
    return [serialize_ticket(db, t) for t in tickets]


@app.post(
    "/api/projects/{project_id}/tickets",
    response_model=schemas.TicketOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Tickets"],
)
def create_ticket(
    project_id: int,
    payload: schemas.TicketCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = get_membership_or_403(db, project_id, current_user.id)
    require_roles(member, ("admin", "developer"))

    project = db.query(models.Project).filter(models.Project.id == project_id).first()

    if payload.assignee_id is not None:
        assignee_member = (
            db.query(models.ProjectMember)
            .filter(
                models.ProjectMember.project_id == project_id,
                models.ProjectMember.user_id == payload.assignee_id,
            )
            .first()
        )
        if not assignee_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee must be a member of this project",
            )

    max_pos = (
        db.query(func.max(models.Ticket.position))
        .filter(
            models.Ticket.project_id == project_id,
            models.Ticket.status == payload.status,
        )
        .scalar()
    )
    next_pos = (max_pos + 1) if max_pos is not None else 0

    ticket = models.Ticket(
        ticket_key=generate_next_ticket_key(db, project),
        project_id=project_id,
        title=payload.title.strip(),
        description=(payload.description or "").strip(),
        issue_type=payload.issue_type,
        status=payload.status,
        priority=payload.priority,
        position=next_pos,
        reporter_id=current_user.id,
        assignee_id=payload.assignee_id,
        due_date=payload.due_date if payload.due_date else None,
    )
    db.add(ticket)
    db.commit()

    created = (
        db.query(models.Ticket)
        .options(joinedload(models.Ticket.reporter), joinedload(models.Ticket.assignee))
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    return serialize_ticket(db, created)


@app.get("/api/tickets/{ticket_id}", response_model=schemas.TicketDetailOut, tags=["Tickets"])
def get_ticket_detail(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ticket = (
        db.query(models.Ticket)
        .options(joinedload(models.Ticket.reporter), joinedload(models.Ticket.assignee))
        .filter(models.Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    get_membership_or_403(db, ticket.project_id, current_user.id)

    comments = (
        db.query(models.Comment)
        .options(joinedload(models.Comment.author))
        .filter(models.Comment.ticket_id == ticket.id)
        .order_by(models.Comment.created_at.asc())
        .all()
    )
    attachments = (
        db.query(models.Attachment)
        .options(joinedload(models.Attachment.uploaded_by))
        .filter(models.Attachment.ticket_id == ticket.id)
        .order_by(models.Attachment.created_at.desc())
        .all()
    )

    base_data = serialize_ticket(db, ticket).model_dump()
    base_data["comments"] = build_comment_tree(comments)
    base_data["attachments"] = attachments
    return schemas.TicketDetailOut(**base_data)


@app.patch("/api/tickets/{ticket_id}", response_model=schemas.TicketOut, tags=["Tickets"])
def update_ticket(
    ticket_id: int,
    payload: schemas.TicketUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    member = get_membership_or_403(db, ticket.project_id, current_user.id)
    require_roles(member, ("admin", "developer"))

    if payload.title is not None:
        ticket.title = payload.title.strip()
    if payload.description is not None:
        ticket.description = payload.description.strip()
    if payload.issue_type is not None:
        ticket.issue_type = payload.issue_type
    if payload.status is not None:
        ticket.status = payload.status
    if payload.priority is not None:
        ticket.priority = payload.priority
    if payload.position is not None:
        ticket.position = payload.position
    if payload.due_date is not None:
        ticket.due_date = payload.due_date if payload.due_date != "" else None

    if payload.clear_assignee:
        ticket.assignee_id = None
    elif payload.assignee_id is not None:
        assignee_member = (
            db.query(models.ProjectMember)
            .filter(
                models.ProjectMember.project_id == ticket.project_id,
                models.ProjectMember.user_id == payload.assignee_id,
            )
            .first()
        )
        if not assignee_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee must be a member of this project",
            )
        ticket.assignee_id = payload.assignee_id

    db.commit()
    refreshed = (
        db.query(models.Ticket)
        .options(joinedload(models.Ticket.reporter), joinedload(models.Ticket.assignee))
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    return serialize_ticket(db, refreshed)


@app.patch("/api/tickets/{ticket_id}/move", response_model=schemas.TicketOut, tags=["Kanban"])
def move_ticket_kanban(
    ticket_id: int,
    payload: schemas.TicketReorderRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    member = get_membership_or_403(db, ticket.project_id, current_user.id)
    require_roles(member, ("admin", "developer"))

    ticket.status = payload.status
    ticket.position = max(0, payload.position)
    db.commit()

    refreshed = (
        db.query(models.Ticket)
        .options(joinedload(models.Ticket.reporter), joinedload(models.Ticket.assignee))
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    return serialize_ticket(db, refreshed)


@app.delete("/api/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Tickets"])
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    member = get_membership_or_403(db, ticket.project_id, current_user.id)
    # Admins can delete any ticket; Developers can delete tickets they reported
    if member.role == "viewer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewers cannot delete tickets")
    if member.role == "developer" and ticket.reporter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developers can only delete tickets they created; Admins can delete any ticket",
        )

    db.delete(ticket)
    db.commit()
    return None


# ---------- Threaded Comments Routes ----------
@app.post(
    "/api/tickets/{ticket_id}/comments",
    response_model=schemas.CommentOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Comments"],
)
def add_comment(
    ticket_id: int,
    payload: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    member = get_membership_or_403(db, ticket.project_id, current_user.id)
    require_roles(member, ("admin", "developer"))

    if payload.parent_id is not None:
        parent = (
            db.query(models.Comment)
            .filter(
                models.Comment.id == payload.parent_id,
                models.Comment.ticket_id == ticket_id,
            )
            .first()
        )
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent comment not found on this ticket",
            )

    comment = models.Comment(
        ticket_id=ticket_id,
        author_id=current_user.id,
        parent_id=payload.parent_id,
        body=payload.body.strip(),
    )
    db.add(comment)
    db.commit()

    saved = (
        db.query(models.Comment)
        .options(joinedload(models.Comment.author))
        .filter(models.Comment.id == comment.id)
        .first()
    )
    return schemas.CommentOut(
        id=saved.id,
        ticket_id=saved.ticket_id,
        author_id=saved.author_id,
        parent_id=saved.parent_id,
        body=saved.body,
        created_at=saved.created_at,
        updated_at=saved.updated_at,
        author=saved.author,
        replies=[],
    )


@app.delete("/api/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Comments"])
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    ticket = db.query(models.Ticket).filter(models.Ticket.id == comment.ticket_id).first()
    member = get_membership_or_403(db, ticket.project_id, current_user.id)

    if member.role == "viewer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewers cannot delete comments")
    if member.role != "admin" and comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own comments unless you are a project Admin",
        )

    db.delete(comment)
    db.commit()
    return None


# ---------- Screenshot & File Attachments Routes ----------
@app.post(
    "/api/tickets/{ticket_id}/attachments",
    response_model=schemas.AttachmentOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Attachments"],
)
async def upload_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    member = get_membership_or_403(db, ticket.project_id, current_user.id)
    require_roles(member, ("admin", "developer"))

    original_name = Path(file.filename or "upload.bin").name
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext}'. Allowed: {', '.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}",
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 10 MB limit",
        )

    stored_name = f"{uuid.uuid4().hex}{ext}"
    destination = UPLOAD_DIR / stored_name
    destination.write_bytes(content)

    attachment = models.Attachment(
        ticket_id=ticket_id,
        uploaded_by_id=current_user.id,
        original_filename=original_name,
        stored_filename=stored_name,
        content_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        url=f"/uploads/{stored_name}",
    )
    db.add(attachment)
    db.commit()

    saved = (
        db.query(models.Attachment)
        .options(joinedload(models.Attachment.uploaded_by))
        .filter(models.Attachment.id == attachment.id)
        .first()
    )
    return saved


@app.delete("/api/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Attachments"])
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    attachment = db.query(models.Attachment).filter(models.Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    ticket = db.query(models.Ticket).filter(models.Ticket.id == attachment.ticket_id).first()
    member = get_membership_or_403(db, ticket.project_id, current_user.id)

    if member.role == "viewer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewers cannot delete attachments")
    if member.role != "admin" and attachment.uploaded_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the uploader or a project Admin can delete this attachment",
        )

    file_path = UPLOAD_DIR / attachment.stored_filename
    if file_path.exists():
        file_path.unlink()

    db.delete(attachment)
    db.commit()
    return None
