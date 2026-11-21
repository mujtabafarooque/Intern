@echo off
title IssueFlow - Jira-like Bug Tracker Launcher
echo ======================================================
echo   Starting IssueFlow Bug Tracker (Backend + Frontend)
echo ======================================================

if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
)
if not exist "frontend\.env" (
    copy "frontend\.env.example" "frontend\.env" >nul
)

echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "IssueFlow Backend" cmd /k "cd backend && python -m venv .venv 2>nul & call .venv\Scripts\activate && pip install -r requirements.txt && alembic upgrade head && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [2/2] Starting React Frontend on http://localhost:5173 ...
start "IssueFlow Frontend" cmd /k "cd frontend && npm install && npm run dev -- --host"

echo.
echo Both servers are launching in separate terminals!
echo Swagger API Docs: http://localhost:8000/docs
echo Web Application : http://localhost:5173
pause
