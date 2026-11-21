import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  FolderKanban,
  GripVertical,
  Image as ImageIcon,
  Layers,
  ListTodo,
  LogOut,
  MessageSquare,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import api, { API_BASE_URL } from "./api";

const COLUMNS = [
  { id: "todo", title: "To Do", accent: "border-slate-500", dot: "bg-slate-400" },
  { id: "in_progress", title: "In Progress", accent: "border-indigo-500", dot: "bg-indigo-400" },
  { id: "in_review", title: "In Review", accent: "border-amber-500", dot: "bg-amber-400" },
  { id: "done", title: "Done", accent: "border-emerald-500", dot: "bg-emerald-400" },
];

const PRIORITY_BADGES = {
  low: "bg-slate-800 text-slate-300 border-slate-700",
  medium: "bg-sky-950/80 text-sky-300 border-sky-800",
  high: "bg-amber-950/80 text-amber-300 border-amber-800",
  critical: "bg-rose-950/80 text-rose-300 border-rose-800",
};

const TYPE_META = {
  bug: { label: "Bug", icon: Bug, color: "text-rose-400 bg-rose-950/70 border-rose-800/70" },
  feature: { label: "Feature", icon: Sparkles, color: "text-violet-400 bg-violet-950/70 border-violet-800/70" },
  task: { label: "Task", icon: CheckCircle2, color: "text-emerald-400 bg-emerald-950/70 border-emerald-800/70" },
};

const ROLE_BADGES = {
  admin: "bg-indigo-950 text-indigo-300 border-indigo-700",
  developer: "bg-emerald-950 text-emerald-300 border-emerald-700",
  viewer: "bg-slate-800 text-slate-300 border-slate-600",
};

function Avatar({ user, size = "sm" }) {
  if (!user) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-600 text-[10px] text-slate-400">
        ?
      </span>
    );
  }
  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const dims = size === "md" ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";
  return (
    <span
      title={`${user.full_name} (${user.email})`}
      style={{ backgroundColor: user.avatar_color || "#4F46E5" }}
      className={`inline-flex ${dims} shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm`}
    >
      {initials}
    </span>
  );
}

// ---------- Auth Screen ----------
function AuthPage({ onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegister
        ? { email, full_name: fullName, password }
        : { email, password };
      const { data } = await api.post(endpoint, payload);
      localStorage.setItem("issueflow_token", data.access_token);
      localStorage.setItem("issueflow_user", JSON.stringify(data.user));
      onAuthSuccess(data.user);
    } catch (err) {
      setError(err.response?.data?.detail || "Authentication failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const quickDemoLogin = async (demoEmail, demoPassword) => {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", {
        email: demoEmail,
        password: demoPassword,
      });
      localStorage.setItem("issueflow_token", data.access_token);
      localStorage.setItem("issueflow_user", JSON.stringify(data.user));
      onAuthSuccess(data.user);
    } catch (err) {
      setError(err.response?.data?.detail || "Demo login failed. Is the FastAPI backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
            <Bug className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">IssueFlow</h1>
            <p className="text-xs text-slate-400">Jira-like Bug & Issue Tracker</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-950 p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError("");
            }}
            className={`rounded-md py-2 font-medium transition ${
              !isRegister ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setError("");
            }}
            className={`rounded-md py-2 font-medium transition ${
              isRegister ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-800 bg-rose-950/60 p-3 text-xs text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submitAuth} className="space-y-4">
          {isRegister && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ananya Sharma"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Please wait..." : isRegister ? "Create Account & Workspace" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800 pt-5">
          <p className="mb-2.5 text-center text-xs font-medium text-slate-400">
            Instant RBAC Demo Accounts (1-Click Login)
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => quickDemoLogin("admin@issueflow.dev", "Admin@123")}
              className="rounded-lg border border-indigo-800/70 bg-indigo-950/50 px-2 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-900/60"
            >
              Admin
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => quickDemoLogin("dev@issueflow.dev", "Dev@123")}
              className="rounded-lg border border-emerald-800/70 bg-emerald-950/50 px-2 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-900/60"
            >
              Developer
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => quickDemoLogin("viewer@issueflow.dev", "Viewer@123")}
              className="rounded-lg border border-slate-700 bg-slate-800/70 px-2 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Viewer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Kanban Card & Column ----------
function TicketCard({ ticket, canEdit, onOpen, isOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ticket-${ticket.id}`,
    data: { ticket },
    disabled: !canEdit || isOverlay,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const typeInfo = TYPE_META[ticket.issue_type] || TYPE_META.bug;
  const TypeIcon = typeInfo.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onOpen(ticket.id)}
      className={`group relative cursor-pointer rounded-xl border border-slate-800 bg-slate-900 p-3.5 shadow-sm transition hover:border-indigo-500/60 hover:bg-slate-900/95 ${
        isDragging ? "opacity-35" : ""
      } ${isOverlay ? "rotate-2 border-indigo-500 shadow-2xl" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${typeInfo.color}`}
          >
            <TypeIcon className="h-3 w-3" />
            {typeInfo.label}
          </span>
          <span className="font-mono text-xs font-semibold text-slate-400">
            {ticket.ticket_key}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              PRIORITY_BADGES[ticket.priority] || PRIORITY_BADGES.medium
            }`}
          >
            {ticket.priority}
          </span>
          {canEdit && (
            <button
              type="button"
              {...listeners}
              {...attributes}
              onClick={(e) => e.stopPropagation()}
              title="Drag to move column"
              className="cursor-grab rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200 active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <h4 className="mb-3 line-clamp-2 text-sm font-medium leading-snug text-slate-100 group-hover:text-white">
        {ticket.title}
      </h4>

      <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1" title="Comments">
            <MessageSquare className="h-3.5 w-3.5" />
            {ticket.comment_count}
          </span>
          <span className="inline-flex items-center gap-1" title="Attachments">
            <Paperclip className="h-3.5 w-3.5" />
            {ticket.attachment_count}
          </span>
          {ticket.due_date && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Clock className="h-3 w-3" />
              {ticket.due_date}
            </span>
          )}
        </div>
        <Avatar user={ticket.assignee} />
      </div>
    </div>
  );
}

function KanbanColumn({ column, tickets, canEdit, onOpenTicket }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[540px] flex-col rounded-2xl border bg-slate-900/50 p-3 transition ${
        isOver ? "border-indigo-500 bg-indigo-950/20" : "border-slate-800/90"
      }`}
    >
      <div className={`mb-3 flex items-center justify-between border-b-2 pb-2.5 ${column.accent}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${column.dot}`} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {column.title}
          </h3>
        </div>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
          {tickets.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            canEdit={canEdit}
            onOpen={onOpenTicket}
          />
        ))}
        {tickets.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
            Drop ticket here
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Threaded Comment Item ----------
function CommentNode({
  comment,
  depth = 0,
  canComment,
  currentUser,
  isAdmin,
  onReply,
  onDelete,
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onReply(replyText, comment.id);
      setReplyText("");
      setReplyOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const canDelete = isAdmin || comment.author_id === currentUser.id;

  return (
    <div className={`${depth > 0 ? "ml-6 border-l-2 border-slate-800 pl-3.5" : ""} mt-3`}>
      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Avatar user={comment.author} />
            <span className="text-xs font-semibold text-slate-200">
              {comment.author?.full_name}
            </span>
            <span className="text-[11px] text-slate-500">
              {new Date(comment.created_at).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canComment && (
              <button
                type="button"
                onClick={() => setReplyOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-400"
              >
                <Reply className="h-3 w-3" />
                Reply
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                title="Delete comment"
                className="text-slate-500 hover:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm text-slate-300">{comment.body}</p>

        {replyOpen && (
          <form onSubmit={handleReplySubmit} className="mt-2.5 flex gap-2">
            <input
              type="text"
              required
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a threaded reply..."
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Reply
            </button>
          </form>
        )}
      </div>

      {comment.replies?.map((child) => (
        <CommentNode
          key={child.id}
          comment={child}
          depth={depth + 1}
          canComment={canComment}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onReply={onReply}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

// ---------- Ticket Detail & Edit Modal ----------
function TicketDetailModal({
  ticketId,
  project,
  currentUser,
  onClose,
  onChanged,
}) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [error, setError] = useState("");

  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [issueType, setIssueType] = useState("bug");
  const [statusVal, setStatusVal] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const role = project?.current_user_role || "viewer";
  const canEdit = role === "admin" || role === "developer";
  const isAdmin = role === "admin";

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/api/tickets/${ticketId}`);
      setTicket(data);
      setTitle(data.title);
      setDescription(data.description || "");
      setIssueType(data.issue_type);
      setStatusVal(data.status);
      setPriority(data.priority);
      setAssigneeId(data.assignee_id ? String(data.assignee_id) : "");
      setDueDate(data.due_date || "");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load ticket details");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError("");
    try {
      await api.patch(`/api/tickets/${ticketId}`, {
        title,
        description,
        issue_type: issueType,
        status: statusVal,
        priority,
        assignee_id: assigneeId ? Number(assigneeId) : null,
        clear_assignee: assigneeId === "",
        due_date: dueDate,
      });
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update ticket");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!window.confirm(`Delete ${ticket.ticket_key} permanently?`)) return;
    try {
      await api.delete(`/api/tickets/${ticketId}`);
      onChanged();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Permission denied while deleting ticket");
    }
  };

  const handleAddComment = async (bodyText, parentId = null) => {
    if (!bodyText.trim()) return;
    try {
      await api.post(`/api/tickets/${ticketId}/comments`, {
        body: bodyText,
        parent_id: parentId,
      });
      if (!parentId) setCommentBody("");
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to post comment");
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/api/comments/${commentId}`);
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.detail || "Cannot delete comment");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/api/tickets/${ticketId}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.detail || "Screenshot upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (attId) => {
    try {
      await api.delete(`/api/attachments/${attId}`);
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete attachment");
    }
  };

  const canDeleteThisTicket =
    ticket && (isAdmin || (role === "developer" && ticket.reporter_id === currentUser.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-indigo-950 px-2.5 py-1 font-mono text-xs font-bold text-indigo-300 border border-indigo-800">
              {ticket?.ticket_key || "Loading..."}
            </span>
            {role === "viewer" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                <Eye className="h-3 w-3" /> Read-only Viewer Mode
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canDeleteThisTicket && (
              <button
                type="button"
                onClick={handleDeleteTicket}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-800/80 bg-rose-950/60 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-900/70"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Ticket
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading ticket details...</div>
        ) : !ticket ? (
          <div className="p-8 text-center text-sm text-rose-400">{error}</div>
        ) : (
          <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-3">
            {/* Left 2 Columns: Description, Screenshots, Threaded Comments */}
            <div className="space-y-6 border-b border-slate-800 p-6 lg:col-span-2 lg:border-b-0 lg:border-r">
              {error && (
                <div className="rounded-lg border border-rose-800 bg-rose-950/60 p-3 text-xs text-rose-200">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Title
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-base font-semibold text-white disabled:opacity-75 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Description & Reproduction Steps
                </label>
                <textarea
                  rows={4}
                  disabled={!canEdit}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe expected vs actual behavior..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 disabled:opacity-75 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Screenshots & Attachments */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                    <ImageIcon className="h-4 w-4 text-indigo-400" />
                    Screenshots & Attachments ({ticket.attachments?.length || 0})
                  </h4>
                  {canEdit && (
                    <label className="cursor-pointer rounded-lg border border-indigo-700 bg-indigo-950/70 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-900/70">
                      {uploading ? "Uploading..." : "+ Upload Screenshot / File"}
                      <input
                        type="file"
                        disabled={uploading}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {ticket.attachments?.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
                    No screenshots or logs attached yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {ticket.attachments.map((att) => {
                      const fullUrl = `${API_BASE_URL}${att.url}`;
                      const isImage = att.content_type?.startsWith("image/");
                      return (
                        <div
                          key={att.id}
                          className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                        >
                          {isImage ? (
                            <a href={fullUrl} target="_blank" rel="noreferrer">
                              <img
                                src={fullUrl}
                                alt={att.original_filename}
                                className="h-32 w-full object-cover transition group-hover:opacity-90"
                              />
                            </a>
                          ) : (
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex h-32 flex-col items-center justify-center gap-2 p-3 text-slate-400 hover:text-indigo-400"
                            >
                              <FileText className="h-8 w-8" />
                              <span className="text-xs">Open Attachment</span>
                            </a>
                          )}
                          <div className="flex items-center justify-between border-t border-slate-800 px-3 py-2 text-xs">
                            <span className="truncate font-medium text-slate-300" title={att.original_filename}>
                              {att.original_filename}
                            </span>
                            {(isAdmin || att.uploaded_by_id === currentUser.id) && role !== "viewer" && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(att.id)}
                                className="ml-2 text-slate-500 hover:text-rose-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Threaded Comments */}
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <MessageSquare className="h-4 w-4 text-indigo-400" />
                  Discussion Thread
                </h4>

                {canEdit && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddComment(commentBody, null);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Add a comment to this ticket..."
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Post
                    </button>
                  </form>
                )}

                <div className="mt-2">
                  {ticket.comments?.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-500">
                      No comments yet. Start the discussion above.
                    </p>
                  ) : (
                    ticket.comments.map((c) => (
                      <CommentNode
                        key={c.id}
                        comment={c}
                        canComment={canEdit}
                        currentUser={currentUser}
                        isAdmin={isAdmin}
                        onReply={handleAddComment}
                        onDelete={handleDeleteComment}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Ticket Metadata & Save */}
            <form onSubmit={handleSave} className="space-y-4 bg-slate-950/40 p-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Status</label>
                <select
                  disabled={!canEdit}
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-75"
                >
                  {COLUMNS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Issue Type</label>
                <select
                  disabled={!canEdit}
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-75"
                >
                  <option value="bug">Bug</option>
                  <option value="feature">Feature</option>
                  <option value="task">Task</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Priority</label>
                <select
                  disabled={!canEdit}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-75"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Assignee</label>
                <select
                  disabled={!canEdit}
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-75"
                >
                  <option value="">Unassigned</option>
                  {project?.members?.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.full_name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Due Date</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-75"
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-400 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>Reporter:</span>
                  <span className="font-medium text-slate-200">{ticket.reporter?.full_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Created:</span>
                  <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {canEdit && (
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Create Ticket Modal ----------
function CreateTicketModal({ project, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [issueType, setIssueType] = useState("bug");
  const [priority, setPriority] = useState("medium");
  const [statusVal, setStatusVal] = useState("todo");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/api/projects/${project.id}/tickets`, {
        title,
        description,
        issue_type: issueType,
        priority,
        status: statusVal,
        assignee_id: assigneeId ? Number(assigneeId) : null,
        due_date: dueDate || null,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            Create Issue in <span className="text-indigo-400">{project.key}</span>
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-800 bg-rose-950/60 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Summary / Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fix WebSocket reconnect loop on Safari"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Type</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white"
              >
                <option value="bug">Bug</option>
                <option value="feature">Feature</option>
                <option value="task">Task</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Initial Column</label>
              <select
                value={statusVal}
                onChange={(e) => setStatusVal(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white"
              >
                <option value="">Unassigned</option>
                {project.members?.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Steps to reproduce, acceptance criteria, or logs..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Team & Project Settings Modal ----------
function TeamModal({ project, currentUser, onClose, onUpdated }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("developer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = project.current_user_role === "admin";

  const handleAddMember = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post(`/api/projects/${project.id}/members`, {
        email,
        role,
      });
      setEmail("");
      onUpdated(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not add member");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setError("");
    try {
      const { data } = await api.patch(`/api/projects/${project.id}/members/${userId}`, {
        role: newRole,
      });
      onUpdated(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update role");
    }
  };

  const handleRemove = async (userId) => {
    setError("");
    try {
      const { data } = await api.delete(`/api/projects/${project.id}/members/${userId}`);
      onUpdated(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to remove member");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Team & Role-Based Access</h3>
            <p className="text-xs text-slate-400">
              {project.name} ({project.key})
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-800 bg-rose-950/60 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {isAdmin && (
          <form onSubmit={handleAddMember} className="mb-5 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Invite registered user by email..."
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="admin">Admin</option>
              <option value="developer">Developer</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              <UserPlus className="h-4 w-4" />
              Add
            </button>
          </form>
        )}

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {project.members?.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5"
            >
              <div className="flex items-center gap-3">
                <Avatar user={m.user} size="md" />
                <div>
                  <p className="text-sm font-medium text-white">
                    {m.user.full_name}{" "}
                    {m.user.id === currentUser.id && (
                      <span className="text-xs text-indigo-400">(You)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{m.user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.user.id, e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200"
                  >
                    <option value="admin">Admin</option>
                    <option value="developer">Developer</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-semibold uppercase ${
                      ROLE_BADGES[m.role]
                    }`}
                  >
                    {m.role}
                  </span>
                )}

                {isAdmin && m.user.id !== currentUser.id && (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.user.id)}
                    title="Remove member"
                    className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- New Project Modal ----------
function CreateProjectModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/api/projects", {
        name,
        key: key.toUpperCase(),
        description,
      });
      onCreated(data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Create New Project</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-800 bg-rose-950/60 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Project Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!key) {
                  const auto = e.target.value
                    .replace(/[^A-Za-z]/g, "")
                    .toUpperCase()
                    .slice(0, 4);
                  setKey(auto);
                }
              }}
              placeholder="e.g. Mobile Checkout Service"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Project Key (2-10 uppercase chars)
            </label>
            <input
              type="text"
              required
              maxLength={10}
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="e.g. MCS"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 font-mono text-sm uppercase text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope & objectives..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Main Workspace Dashboard ----------
function Workspace({ currentUser, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [viewMode, setViewMode] = useState("kanban"); // kanban | list
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Modals
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [draggingTicket, setDraggingTicket] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const canEdit =
    activeProject?.current_user_role === "admin" ||
    activeProject?.current_user_role === "developer";

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const { data } = await api.get("/api/projects");
      setProjects(data);
      if (data.length > 0) {
        setActiveProjectId((prev) =>
          prev && data.some((p) => p.id === prev) ? prev : data[0].id
        );
      } else {
        setActiveProjectId(null);
      }
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    if (!activeProjectId) return;
    setLoadingTickets(true);
    try {
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (filterPriority !== "all") params.priority = filterPriority;
      if (filterType !== "all") params.issue_type = filterType;
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterAssignee !== "all") params.assignee_id = Number(filterAssignee);

      const { data } = await api.get(`/api/projects/${activeProjectId}/tickets`, { params });
      setTickets(data);
    } finally {
      setLoadingTickets(false);
    }
  }, [activeProjectId, searchQuery, filterPriority, filterType, filterStatus, filterAssignee]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleDragStart = (event) => {
    const ticket = event.active.data.current?.ticket;
    if (ticket) setDraggingTicket(ticket);
  };

  const handleDragEnd = async (event) => {
    setDraggingTicket(null);
    const { active, over } = event;
    if (!over || !canEdit) return;

    const ticket = active.data.current?.ticket;
    const targetStatus = over.id;
    if (!ticket || !COLUMNS.some((c) => c.id === targetStatus)) return;
    if (ticket.status === targetStatus) return;

    // Optimistic Kanban column update
    setTickets((prev) =>
      prev.map((t) => (t.id === ticket.id ? { ...t, status: targetStatus } : t))
    );

    try {
      await api.patch(`/api/tickets/${ticket.id}/move`, {
        status: targetStatus,
        position: 0,
      });
      fetchTickets();
    } catch {
      fetchTickets();
    }
  };

  const stats = useMemo(() => {
    return {
      total: tickets.length,
      bugs: tickets.filter((t) => t.issue_type === "bug").length,
      inProgress: tickets.filter((t) => t.status === "in_progress").length,
      done: tickets.filter((t) => t.status === "done").length,
    };
  }, [tickets]);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800/90 bg-slate-900/60 p-4 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
            <Bug className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white">IssueFlow</span>
            <p className="text-[11px] text-slate-400">Agile Bug Tracker</p>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Projects
          </span>
          <button
            type="button"
            onClick={() => setShowCreateProject(true)}
            title="New Project"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {loadingProjects ? (
            <p className="px-2 py-4 text-xs text-slate-500">Loading projects...</p>
          ) : (
            projects.map((proj) => {
              const active = proj.id === activeProjectId;
              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => setActiveProjectId(proj.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? "bg-indigo-600/20 font-semibold text-white border border-indigo-500/40"
                      : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate">{proj.name}</div>
                    <div className="font-mono text-[11px] text-slate-500">{proj.key}</div>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 ${active ? "text-indigo-400" : "opacity-30"}`} />
                </button>
              );
            })
          )}
        </nav>

        <div className="mt-4 border-t border-slate-800 pt-4">
          <div className="mb-3 flex items-center gap-2.5 px-1">
            <Avatar user={currentUser} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{currentUser.full_name}</p>
              <p className="truncate text-[11px] text-slate-400">{currentUser.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900 py-2 text-xs font-medium text-slate-300 hover:border-rose-800/70 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col">
        {!activeProject ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <FolderKanban className="mb-3 h-12 w-12 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">No Projects Yet</h2>
            <p className="mb-4 max-w-sm text-sm text-slate-400">
              Create your first project workspace to start tracking bugs, tasks, and sprints.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateProject(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              + Create Project
            </button>
          </div>
        ) : (
          <>
            {/* Top Bar */}
            <header className="border-b border-slate-800/90 bg-slate-900/40 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded bg-indigo-950 px-2 py-0.5 font-mono text-xs font-bold text-indigo-300 border border-indigo-800">
                      {activeProject.key}
                    </span>
                    <h1 className="text-xl font-bold text-white">{activeProject.name}</h1>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase ${
                        ROLE_BADGES[activeProject.current_user_role]
                      }`}
                    >
                      <Shield className="h-3 w-3" />
                      {activeProject.current_user_role}
                    </span>
                  </div>
                  {activeProject.description && (
                    <p className="mt-1 text-xs text-slate-400">{activeProject.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Mobile Project Switcher */}
                  <select
                    value={activeProjectId || ""}
                    onChange={(e) => setActiveProjectId(Number(e.target.value))}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white md:hidden"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.key} — {p.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowTeamModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    <Users className="h-4 w-4 text-indigo-400" />
                    Team ({activeProject.members?.length || 1})
                  </button>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setShowCreateTicket(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500"
                    >
                      <Plus className="h-4 w-4" />
                      Create Ticket
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onLogout}
                    className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-rose-400 md:hidden"
                    title="Sign Out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Metrics Strip */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-3.5 py-2">
                  <span className="text-[11px] text-slate-400">Visible Tickets</span>
                  <p className="text-lg font-bold text-white">{stats.total}</p>
                </div>
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-3.5 py-2">
                  <span className="text-[11px] text-slate-400">Open Bugs</span>
                  <p className="text-lg font-bold text-rose-400">{stats.bugs}</p>
                </div>
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-3.5 py-2">
                  <span className="text-[11px] text-slate-400">In Progress</span>
                  <p className="text-lg font-bold text-indigo-400">{stats.inProgress}</p>
                </div>
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-3.5 py-2">
                  <span className="text-[11px] text-slate-400">Completed</span>
                  <p className="text-lg font-bold text-emerald-400">{stats.done}</p>
                </div>
              </div>

              {/* Filter & View Toolbar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search key, title, or description..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Filter className="h-3.5 w-3.5" />
                  </div>

                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="all">All Types</option>
                    <option value="bug">Bug</option>
                    <option value="feature">Feature</option>
                    <option value="task">Task</option>
                  </select>

                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="all">All Priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  <select
                    value={filterAssignee}
                    onChange={(e) => setFilterAssignee(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="all">All Assignees</option>
                    <option value="0">Unassigned</option>
                    {activeProject.members?.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.full_name}
                      </option>
                    ))}
                  </select>

                  {viewMode === "list" && (
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="all">All Statuses</option>
                      {COLUMNS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Kanban vs List Toggle */}
                <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("kanban");
                      setFilterStatus("all");
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
                      viewMode === "kanban"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Kanban
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
                      viewMode === "list"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <ListTodo className="h-3.5 w-3.5" />
                    List
                  </button>
                </div>
              </div>
            </header>

            {/* Board or List Body */}
            <div className="flex-1 overflow-x-auto p-6">
              {loadingTickets && tickets.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">
                  Loading project issues...
                </div>
              ) : viewMode === "kanban" ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <div className="grid min-w-[920px] grid-cols-4 gap-4">
                    {COLUMNS.map((col) => (
                      <KanbanColumn
                        key={col.id}
                        column={col}
                        tickets={tickets.filter((t) => t.status === col.id)}
                        canEdit={canEdit}
                        onOpenTicket={(id) => setSelectedTicketId(id)}
                      />
                    ))}
                  </div>

                  <DragOverlay>
                    {draggingTicket ? (
                      <TicketCard
                        ticket={draggingTicket}
                        canEdit={false}
                        onOpen={() => {}}
                        isOverlay
                      />
                    ) : null}
                  </DragOverlay>
                </DndContext>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Key</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Summary</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3">Assignee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {tickets.map((t) => {
                        const typeInfo = TYPE_META[t.issue_type] || TYPE_META.bug;
                        return (
                          <tr
                            key={t.id}
                            onClick={() => setSelectedTicketId(t.id)}
                            className="cursor-pointer transition hover:bg-slate-800/60"
                          >
                            <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-300">
                              {t.ticket_key}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${typeInfo.color}`}
                              >
                                {typeInfo.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-100">{t.title}</td>
                            <td className="px-4 py-3 text-xs capitalize text-slate-300">
                              {t.status.replace("_", " ")}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                  PRIORITY_BADGES[t.priority]
                                }`}
                              >
                                {t.priority}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 text-xs text-slate-300">
                                <Avatar user={t.assignee} />
                                <span>{t.assignee?.full_name || "Unassigned"}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {tickets.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-500">
                            No tickets match the current search and filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {showCreateTicket && activeProject && (
        <CreateTicketModal
          project={activeProject}
          onClose={() => setShowCreateTicket(false)}
          onCreated={() => {
            fetchTickets();
            fetchProjects();
          }}
        />
      )}

      {showCreateProject && (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onCreated={(createdProj) => {
            setProjects((prev) => [...prev, createdProj]);
            setActiveProjectId(createdProj.id);
          }}
        />
      )}

      {showTeamModal && activeProject && (
        <TeamModal
          project={activeProject}
          currentUser={currentUser}
          onClose={() => setShowTeamModal(false)}
          onUpdated={(updatedProj) => {
            setProjects((prev) =>
              prev.map((p) => (p.id === updatedProj.id ? updatedProj : p))
            );
          }}
        />
      )}

      {selectedTicketId && activeProject && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          project={activeProject}
          currentUser={currentUser}
          onClose={() => setSelectedTicketId(null)}
          onChanged={() => {
            fetchTickets();
            fetchProjects();
          }}
        />
      )}
    </div>
  );
}

// ---------- Root Router ----------
export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("issueflow_user");
    return raw ? JSON.parse(raw) : null;
  });

  const handleLogout = useCallback(() => {
    localStorage.removeItem("issueflow_token");
    localStorage.removeItem("issueflow_user");
    setUser(null);
    navigate("/login");
  }, [navigate]);

  useEffect(() => {
    const onUnauthorized = () => handleLogout();
    window.addEventListener("issueflow:unauthorized", onUnauthorized);
    return () => window.removeEventListener("issueflow:unauthorized", onUnauthorized);
  }, [handleLogout]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <AuthPage
              onAuthSuccess={(u) => {
                setUser(u);
                navigate("/");
              }}
            />
          )
        }
      />
      <Route
        path="/*"
        element={
          user ? (
            <Workspace currentUser={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
