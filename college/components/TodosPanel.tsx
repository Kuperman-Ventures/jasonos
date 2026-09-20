"use client";

import { useEffect, useState } from "react";
import type { PersistedProjectStep } from "@/lib/ingest";
import {
  assignedByBadge,
  canMarkTodoDone,
  dueTone,
  groupTodosByOwner,
  listProjectTodos,
  memberOwnerId,
  openListStats,
  shortDueLabel,
  todoPrimaryDate,
  type OwnerTodoBucket,
  type ProjectTodo,
  type TodoSubtask,
  type TodoSubtaskMap,
} from "@/lib/project-todos";
import { ownerLabel, type Owner, type Phase } from "@/lib/types";

const CARET = (
  <svg className="task-caret" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

function TaskRow({
  todo,
  subtasks,
  open,
  viewer,
  drafting,
  draftLabel,
  onToggleOpen,
  onToggle,
  onToggleSub,
  onStartDraft,
  onDraftLabel,
  onCommitDraft,
  onCancelDraft,
}: {
  todo: ProjectTodo;
  subtasks: TodoSubtask[];
  open: boolean;
  viewer: Owner;
  drafting: boolean;
  draftLabel: string;
  onToggleOpen: () => void;
  onToggle: (id: string, checked: boolean) => void;
  onToggleSub: (subId: string, checked: boolean) => void;
  onStartDraft: () => void;
  onDraftLabel: (value: string) => void;
  onCommitDraft: () => void;
  onCancelDraft: () => void;
}) {
  const canToggle = canMarkTodoDone(viewer, todo.owner);
  const fromBadge = assignedByBadge(todo);
  const date = todoPrimaryDate(todo);
  const tone = dueTone(date);
  const showCountInColumn = subtasks.length > 0 && !date;
  const bodyId = `b-${todo.id}`;

  return (
    <div className={open ? "task is-open" : "task"} data-task={todo.id}>
      <div className="task-row">
        <input
          className="task-check"
          type="checkbox"
          checked={todo.done}
          disabled={!canToggle}
          aria-label={
            canToggle
              ? `Complete: ${todo.label}`
              : `${todo.label} (only ${ownerLabel(todo.owner)} can check this off)`
          }
          title={canToggle ? undefined : `Only ${ownerLabel(todo.owner)} can check this off`}
          onChange={(event) => {
            if (!canToggle) return;
            onToggle(todo.id, event.target.checked);
          }}
        />
        <button
          className="task-title"
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggleOpen}
        >
          <span className="task-title-text">{todo.label}</span>
          {fromBadge ? <span className="todo-from-badge">{fromBadge}</span> : null}
        </button>
        {showCountInColumn ? (
          <span className="task-sub-count">
            {subtasks.length} subtask{subtasks.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span className={`task-due${tone === "soon" ? " is-soon" : ""}${tone === "undated" ? " is-undated" : ""}`}>
            {shortDueLabel(date)}
          </span>
        )}
        {CARET}
      </div>
      <div className="task-body" id={bodyId}>
        <p className="task-note">
          <em>{todo.phase}</em> · {todo.parentText}
          {subtasks.length > 0 && date ? (
            <span className="task-sub-count">
              {" "}
              · {subtasks.length} subtask{subtasks.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </p>
        {subtasks.length ? (
          <ul className="subs">
            {subtasks.map((sub) => (
              <li key={sub.id} className="sub">
                <input
                  className="sub-check"
                  type="checkbox"
                  id={sub.id}
                  checked={sub.done}
                  disabled={!canToggle}
                  onChange={(event) => {
                    if (!canToggle) return;
                    onToggleSub(sub.id, event.target.checked);
                  }}
                />
                <label className="sub-title" htmlFor={sub.id}>
                  {sub.label}
                </label>
                <span className="sub-due">{shortDueLabel(sub.dueDate)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {drafting ? (
          <input
            className="field sub-draft"
            autoFocus
            value={draftLabel}
            aria-label="New subtask"
            placeholder="Subtask"
            onChange={(event) => onDraftLabel(event.target.value)}
            onBlur={onCommitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitDraft();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelDraft();
              }
            }}
          />
        ) : (
          <button className="sub-add" type="button" onClick={onStartDraft}>
            Add subtask
          </button>
        )}
      </div>
    </div>
  );
}

function TaskList({
  bucket,
  viewer,
  openIds,
  subtasks,
  draftParent,
  draftLabel,
  onToggleOpen,
  onToggle,
  onToggleSub,
  onStartDraft,
  onDraftLabel,
  onCommitDraft,
  onCancelDraft,
}: {
  bucket: OwnerTodoBucket;
  viewer: Owner;
  openIds: Set<string>;
  subtasks: TodoSubtaskMap;
  draftParent: string | null;
  draftLabel: string;
  onToggleOpen: (id: string) => void;
  onToggle: (id: string, checked: boolean) => void;
  onToggleSub: (parentId: string, subId: string, checked: boolean) => void;
  onStartDraft: (parentId: string) => void;
  onDraftLabel: (value: string) => void;
  onCommitDraft: (parentId: string) => void;
  onCancelDraft: () => void;
}) {
  const todos = [...bucket.open, ...bucket.done];
  const stats = openListStats(todos);
  if (!todos.length) {
    return (
      <div className="list">
        <div className="list-head">
          <h1>{bucket.label}</h1>
          <span className="list-count">{stats.label}</span>
        </div>
        <p className="todo-empty">No to-dos assigned yet.</p>
      </div>
    );
  }

  return (
    <div className="list">
      <div className="list-head">
        <h1>{bucket.label}</h1>
        <span className="list-count">{stats.label}</span>
      </div>
      {todos.map((todo) => (
        <TaskRow
          key={todo.id}
          todo={todo}
          subtasks={subtasks[todo.id] ?? []}
          open={openIds.has(todo.id)}
          viewer={viewer}
          drafting={draftParent === todo.id}
          draftLabel={draftParent === todo.id ? draftLabel : ""}
          onToggleOpen={() => onToggleOpen(todo.id)}
          onToggle={onToggle}
          onToggleSub={(subId, checked) => onToggleSub(todo.id, subId, checked)}
          onStartDraft={() => onStartDraft(todo.id)}
          onDraftLabel={onDraftLabel}
          onCommitDraft={() => onCommitDraft(todo.id)}
          onCancelDraft={onCancelDraft}
        />
      ))}
    </div>
  );
}

export function TodosPanel({
  memberId,
  phases,
  checklist,
  projectSteps = [],
  subtasks,
  onToggle,
  onChangeSubtasks,
}: {
  memberId: string;
  phases: Phase[];
  checklist: Record<string, boolean>;
  projectSteps?: PersistedProjectStep[];
  subtasks: TodoSubtaskMap;
  onToggle: (id: string, checked: boolean) => void;
  onChangeSubtasks: (next: TodoSubtaskMap) => void;
}) {
  const focusOwner: Owner = memberOwnerId(memberId);
  const todos = listProjectTodos(checklist, phases, projectSteps);
  const grouped = groupTodosByOwner(todos, focusOwner);
  const storageKey = `kyle-todo-open:${focusOwner}`;
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [draftParent, setDraftParent] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setOpenIds(new Set());
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      setOpenIds(new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []));
    } catch {
      setOpenIds(new Set());
    }
  }, [storageKey]);

  function toggleOpen(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }

  function startDraft(parentId: string) {
    setDraftParent(parentId);
    setDraftLabel("");
    if (!openIds.has(parentId)) toggleOpen(parentId);
  }

  function commitDraft(parentId: string) {
    const label = draftLabel.trim();
    setDraftParent(null);
    setDraftLabel("");
    if (!label) return;
    const existing = subtasks[parentId] ?? [];
    onChangeSubtasks({
      ...subtasks,
      [parentId]: [
        ...existing,
        {
          id: `sub-${parentId.slice(0, 12)}-${Math.random().toString(36).slice(2, 8)}`,
          label,
          dueDate: null,
          done: false,
        },
      ],
    });
  }

  function toggleSub(parentId: string, subId: string, checked: boolean) {
    const ownerTodo = todos.find((todo) => todo.id === parentId);
    if (!ownerTodo || !canMarkTodoDone(focusOwner, ownerTodo.owner)) return;
    onChangeSubtasks({
      ...subtasks,
      [parentId]: (subtasks[parentId] ?? []).map((row) =>
        row.id === subId ? { ...row, done: checked } : row,
      ),
    });
  }

  const shared = {
    viewer: focusOwner,
    openIds,
    subtasks,
    draftParent,
    draftLabel,
    onToggleOpen: toggleOpen,
    onToggle,
    onToggleSub: toggleSub,
    onStartDraft: startDraft,
    onDraftLabel: setDraftLabel,
    onCommitDraft: commitDraft,
    onCancelDraft: () => {
      setDraftParent(null);
      setDraftLabel("");
    },
  };

  return (
    <div className="pm-panel todos-panel">
      <TaskList bucket={grouped.mine} {...shared} />
      {grouped.others.map((bucket) => (
        <TaskList key={bucket.owner} bucket={bucket} {...shared} />
      ))}
    </div>
  );
}
