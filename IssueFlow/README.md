# IssueFlow — Jira-like Bug & Issue Tracker

A full-stack, industry-grade Issue & Bug Tracking System built with **FastAPI**, **SQLAlchemy**, **Alembic**, **PostgreSQL** (with zero-config SQLite fallback for instant local dev), **React**, **Tailwind CSS**, and **@dnd-kit**.

## Features Implemented (All 10 PDF Use Cases)
1. **Secure User Authentication & JWT Validation**: Registration, login, bcrypt password hashing, OAuth2 Bearer JWT tokens, and demo account quick-login.
2. **Project Creation & Team Management**: Create projects with unique keys (e.g., `CORE`, `WEB`), add/remove members by email, and assign project roles (`Admin`, `Developer`, `Viewer`).
3. **Ticket Creation**: Create `Bug`, `Task`, or `Feature` tickets with priority (`Low`, `Medium`, `High`, `Critical`), status, assignee, and due date.
4. **Assigning Tickets to Users**: Assign or reassign tickets to any member of the project team.
5. **Kanban-Based Status Tracking**: Interactive drag-and-drop Kanban board powered by `@dnd-kit/core` across `To Do`, `In Progress`, `In Review`, and `Done` columns (plus dropdown fallback for Viewers/accessibility).
6. **Threaded Comments on Tickets**: Nested parent/reply comment threads with real-time refresh and permission-checked deletion.
7. **Advanced Filters & Keyword Search**: Filter tickets by keyword (`title`/`description`/`key`), status, priority, issue type, and assignee.
8. **Edit/Delete with Permission Checks**: Strict server-side & UI authorization enforcement.
9. **Role-Based Access Control (RBAC)**:
   - **Admin**: Full project control, manage team members & roles, edit/delete any ticket or comment, delete project.
   - **Developer**: Create/edit tickets, drag-and-drop status changes, upload attachments, post/delete own comments, delete own tickets.
   - **Viewer**: Read-only access to board, tickets, comments, and attachments.
10. **Screenshot & File Uploads**: Multipart image/file attachment upload and preview gallery on tickets.

---

## Quick Start (Local Development — Zero Extra Setup)

### Option A: One-Click Windows Script
Double-click `START-WINDOWS.bat` in the project root. By default, `.env.example` uses SQLite (`sqlite:///./issueflow.db`) so it runs immediately without needing PostgreSQL installed locally, while remaining 100% compatible with PostgreSQL in production/Docker.

### Option B: Manual Setup

#### 1. Backend (FastAPI)
```bash
cd backend
cp .env.example .env
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```
- **API Base URL**: `http://localhost:8000`
- **Interactive Swagger UI**: `http://localhost:8000/docs`

#### 2. Frontend (React + Vite + Tailwind + dnd-kit)
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
- **Frontend App**: `http://localhost:5173`

### Option C: Full Docker Compose (PostgreSQL + FastAPI + React)
```bash
docker-compose up --build
```

---

## Seeded Demo Accounts
When the backend starts on an empty database, it automatically seeds a sample workspace (`IssueFlow Platform` - `IF`) and three users so you can immediately test Role-Based Access Control:
- **Admin**: `admin@issueflow.dev` / `Admin@123`
- **Developer**: `dev@issueflow.dev` / `Dev@123`
- **Viewer**: `viewer@issueflow.dev` / `Viewer@123`
