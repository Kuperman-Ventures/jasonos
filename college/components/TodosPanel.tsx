"use client";

import { useEffect, useState } from "react";
import { MemberBadge } from "./MemberBadge";
import type { PersistedProjectStep } from "@/lib/ingest";
import type { MemberProfile } from "@/lib/member-avatars";
import {
  assignmentPatch,
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
  type TodoEdit,
  type TodoEditMap,
  type TodoSubtask,
  type TodoSubtaskMap,
  type UnclaimedTodoBucket,
} from "@/lib/project-todos";
import { OWNERS, ownerLabel, type Owner, type Phase } from "@/lib/types";

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
  profiles,
  drafting,
  draftLabel,
  onToggleOpen,
  onToggle,
  onToggleSub,
  onStartDraft,
  onDraftLabel,
  onCommitDraft,
  onCancelDraft,
  onEdit,
  onEditSub,
  onAssign,
  onDelete,
}: {
  todo: ProjectTodo;
  subtasks: TodoSubtask[];
  open: boolean;
  viewer: Owner;
  profiles: Map<string, MemberProfile>;
  drafting: boolean;
  draftLabel: string;
  onToggleOpen: () => void;
  onToggle: (id: string, checked: boolean) => void;
  onToggleSub: (subId: string, checked: boolean) => void;
  onStartDraft: () => void;
  onDraftLabel: (value: string) => void;
  onCommitDraft: () => void;
  onCancelDraft: () => void;
  onEdit: (patch: TodoEdit) => void;
  onEditSub: (subId: string, patch: { label?: string; dueDate?: string | null }) => void;
  onAssign: (owner: Owner | null) => void;
  onDelete: () => void;
}) {
  const canToggle = canMarkTodoDone(viewer, todo.owner);
  const fromOwner = todo.assignedBy && todo.owner && todo.assignedBy !== todo.owner ? todo.assignedBy : null;
  const fromProfile = fromOwner ? profiles.get(fromOwner) : null;
  const fromLabel = assignedByBadge(todo);
  const date = todoPrimaryDate(todo);
  const tone = dueTone(date);
  const showCountInColumn = subtasks.length > 0 && !date;
  const bodyId = `b-${todo.id}`;
  const ownerLockLabel = todo.owner
    ? `Only ${ownerLabel(todo.owner)} can check this off`
    : "Claim this to-do before checking it off";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setConfirmDelete(false);
    }
  }, [open]);

  return (
    <div className={open ? "task is-open" : "task"} data-task={todo.id}>
      <div className="task-row">
        <input
          className="task-check"
          type="checkbox"
          checked={todo.done}
          disabled={!canToggle}
          aria-label={canToggle ? `Complete: ${todo.label}` : `${todo.label} (${ownerLockLabel})`}
          title={canToggle ? undefined : ownerLockLabel}
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
          {fromOwner && fromLabel ? (
            <MemberBadge
              name={fromProfile?.displayName ?? ownerLabel(fromOwner)}
              avatarUrl={fromProfile?.avatarUrl}
              prefix="From"
            />
          ) : null}
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
        <div className="todo-subtasks">
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
                    aria-label={
                      canToggle ? `Complete: ${sub.label}` : `${sub.label} (${ownerLockLabel})`
                    }
                    onChange={(event) => {
                      if (!canToggle) return;
                      onToggleSub(sub.id, event.target.checked);
                    }}
                  />
                  <input
                    className="field sub-title-edit"
                    aria-label={`Subtask wording for ${sub.label}`}
                    defaultValue={sub.label}
                    key={`${sub.id}-label-${sub.label}`}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value && value !== sub.label) onEditSub(sub.id, { label: value });
                      else event.target.value = sub.label;
                    }}
                  />
                  <input
                    className="field sub-due-edit"
                    type="date"
                    aria-label={`Due date for ${sub.label}`}
                    value={sub.dueDate ?? ""}
                    onChange={(event) => onEditSub(sub.id, { dueDate: event.target.value || null })}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="todo-empty todo-subtasks-empty">No subtasks yet.</p>
          )}
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

        {editing ? (
          <div className="todo-edit-panel">
            <div className="todo-edit-panel-head">
              <span className="label">Edit to-do</span>
              <button
                type="button"
                className="btn btn-ghost compact"
                onClick={() => {
                  setEditing(false);
                  setConfirmDelete(false);
                }}
              >
                Done
              </button>
            </div>
            <div className="todo-assign-row">
              <div className="todo-assign-field">
                <span className="label" id={`assign-label-${todo.id}`}>
                  Assigned to
                </span>
                <div
                  className="todo-assign-picker"
                  role="radiogroup"
                  aria-labelledby={`assign-label-${todo.id}`}
                >
                  <button
                    type="button"
                    role="radio"
                    className={`todo-assign-choice${!todo.owner ? " is-selected" : ""}`}
                    aria-checked={!todo.owner}
                    aria-label="Unclaimed"
                    onClick={() => onAssign(null)}
                  >
                    <span className="todo-assign-avatar todo-assign-unclaimed" aria-hidden="true">
                      <span className="todo-assign-unclaimed-mark">?</span>
                    </span>
                    <span className="todo-assign-choice-name">Unclaimed</span>
                  </button>
                  {OWNERS.map((owner) => {
                    const profile = profiles.get(owner.id);
                    const selected = todo.owner === owner.id;
                    return (
                      <button
                        key={owner.id}
                        type="button"
                        role="radio"
                        className={`todo-assign-choice${selected ? " is-selected" : ""}`}
                        aria-checked={selected}
                        aria-label={profile?.displayName ?? owner.label}
                        onClick={() => onAssign(owner.id)}
                      >
                        <span className="todo-assign-avatar" aria-hidden="true">
                          <MemberBadge
                            name={profile?.displayName ?? owner.label}
                            avatarUrl={profile?.avatarUrl}
                            size="md"
                            showName={false}
                          />
                        </span>
                        <span className="todo-assign-choice-name">
                          {profile?.displayName ?? owner.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {todo.owner !== viewer ? (
                <button
                  type="button"
                  className="btn btn-secondary todo-claim-btn"
                  onClick={() => onAssign(viewer)}
                >
                  Claim for me
                </button>
              ) : null}
            </div>
            <div className="todo-edit">
              <label className="todo-edit-field">
                <span className="label">Wording</span>
                <input
                  className="field"
                  aria-label={`Wording for ${todo.label}`}
                  defaultValue={todo.label}
                  key={`${todo.id}-label-${todo.label}`}
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value && value !== todo.label) onEdit({ label: value });
                    else event.target.value = todo.label;
                  }}
                />
              </label>
              <label className="todo-edit-field">
                <span className="label">Description</span>
                <textarea
                  className="field todo-edit-description"
                  aria-label={`Description for ${todo.label}`}
                  rows={3}
                  placeholder="Add a description"
                  defaultValue={todo.description}
                  key={`${todo.id}-desc-${todo.description}`}
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value !== todo.description) onEdit({ description: value });
                  }}
                />
              </label>
              <div className="todo-edit-dates">
                <label className="todo-edit-field">
                  <span className="label">Due date</span>
                  <input
                    className="field"
                    type="date"
                    aria-label={`Due date for ${todo.label}`}
                    value={todo.endDate ?? todo.dueDate ?? ""}
                    onChange={(event) => {
                      const value = event.target.value || null;
                      onEdit({ dueDate: value, endDate: value });
                    }}
                  />
                </label>
                <label className="todo-edit-field">
                  <span className="label">Start</span>
                  <input
                    className="field"
                    type="date"
                    aria-label={`Start date for ${todo.label}`}
                    value={todo.startDate ?? ""}
                    onChange={(event) => onEdit({ startDate: event.target.value || null })}
                  />
                </label>
              </div>
              <div className="todo-delete-row">
                {confirmDelete ? (
                  <>
                    <button type="button" className="btn btn-primary compact" onClick={onDelete}>
                      Delete to-do
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost compact"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost compact"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="todo-expand-actions">
            <button type="button" className="btn btn-secondary compact" onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskList({
  bucket,
  emphasis,
  viewer,
  profiles,
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
  onEdit,
  onEditSub,
  onAssign,
  onDelete,
}: {
  bucket: OwnerTodoBucket;
  emphasis: "focus" | "other";
  viewer: Owner;
  profiles: Map<string, MemberProfile>;
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
  onEdit: (id: string, patch: TodoEdit) => void;
  onEditSub: (parentId: string, subId: string, patch: { label?: string; dueDate?: string | null }) => void;
  onAssign: (id: string, owner: Owner | null) => void;
  onDelete: (id: string) => void;
}) {
  const todos = [...bucket.open, ...bucket.done];
  const stats = openListStats(todos);
  const listClass = emphasis === "focus" ? "list list-focus" : "list list-other";
  const profile = profiles.get(bucket.owner);

  return (
    <div className={listClass}>
      <div className="list-head">
        <h1 className="list-head-name">
          <MemberBadge
            name={profile?.displayName ?? bucket.label}
            avatarUrl={profile?.avatarUrl}
            size="md"
          />
        </h1>
        <span className="list-count">{stats.label}</span>
      </div>
      {todos.length ? (
        todos.map((todo) => (
          <TaskRow
            key={todo.id}
            todo={todo}
            subtasks={subtasks[todo.id] ?? []}
            open={openIds.has(todo.id)}
            viewer={viewer}
            profiles={profiles}
            drafting={draftParent === todo.id}
            draftLabel={draftParent === todo.id ? draftLabel : ""}
            onToggleOpen={() => onToggleOpen(todo.id)}
            onToggle={onToggle}
            onToggleSub={(subId, checked) => onToggleSub(todo.id, subId, checked)}
            onStartDraft={() => onStartDraft(todo.id)}
            onDraftLabel={onDraftLabel}
            onCommitDraft={() => onCommitDraft(todo.id)}
            onCancelDraft={onCancelDraft}
            onEdit={(patch) => onEdit(todo.id, patch)}
            onEditSub={(subId, patch) => onEditSub(todo.id, subId, patch)}
            onAssign={(owner) => onAssign(todo.id, owner)}
            onDelete={() => onDelete(todo.id)}
          />
        ))
      ) : (
        <p className="todo-empty">No to-dos assigned yet.</p>
      )}
    </div>
  );
}

function OthersSection({
  buckets,
  expanded,
  onToggle,
  profiles,
  shared,
}: {
  buckets: OwnerTodoBucket[];
  expanded: boolean;
  onToggle: () => void;
  profiles: Map<string, MemberProfile>;
  shared: {
    viewer: Owner;
    profiles: Map<string, MemberProfile>;
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
    onEdit: (id: string, patch: TodoEdit) => void;
    onEditSub: (parentId: string, subId: string, patch: { label?: string; dueDate?: string | null }) => void;
    onAssign: (id: string, owner: Owner | null) => void;
    onDelete: (id: string) => void;
  };
}) {
  if (!buckets.length) return null;

  const allTodos = buckets.flatMap((bucket) => [...bucket.open, ...bucket.done]);
  const stats = openListStats(allTodos);

  return (
    <div className={`todos-others${expanded ? "" : " is-collapsed"}`}>
      <button
        type="button"
        className="todos-others-toggle"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="todos-others-toggle-main">
          <span className="todos-others-toggle-label">Everyone else</span>
          <span className="todos-others-avatars" aria-hidden="true">
            {buckets.map((bucket) => {
              const profile = profiles.get(bucket.owner);
              return (
                  <MemberBadge
                  key={bucket.owner}
                  name={profile?.displayName ?? bucket.label}
                  avatarUrl={profile?.avatarUrl}
                  size="sm"
                  showName={false}
                />
              );
            })}
          </span>
        </span>
        <span className="list-count">{stats.label}</span>
        <span className={`list-head-caret${expanded ? " is-open" : ""}`} aria-hidden="true">
          {CARET}
        </span>
      </button>
      {expanded ? (
        <div className="todos-others-body">
          {buckets.map((bucket) => (
            <TaskList key={bucket.owner} bucket={bucket} emphasis="other" {...shared} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function UnclaimedList({
  bucket,
  viewer,
  profiles,
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
  onEdit,
  onEditSub,
  onAssign,
  onDelete,
}: {
  bucket: UnclaimedTodoBucket;
  viewer: Owner;
  profiles: Map<string, MemberProfile>;
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
  onEdit: (id: string, patch: TodoEdit) => void;
  onEditSub: (parentId: string, subId: string, patch: { label?: string; dueDate?: string | null }) => void;
  onAssign: (id: string, owner: Owner | null) => void;
  onDelete: (id: string) => void;
}) {
  const todos = [...bucket.open, ...bucket.done];
  const stats = openListStats(todos);

  return (
    <div className="list list-unclaimed">
      <div className="list-head">
        <h1 className="list-head-name">Unclaimed</h1>
        <span className="list-count">{stats.label}</span>
      </div>
      <p className="todo-unclaimed-blurb">
        Anyone can claim these or assign them to Kyle, Jason, or Kat.
      </p>
      {todos.length ? (
        todos.map((todo) => (
          <TaskRow
            key={todo.id}
            todo={todo}
            subtasks={subtasks[todo.id] ?? []}
            open={openIds.has(todo.id)}
            viewer={viewer}
            profiles={profiles}
            drafting={draftParent === todo.id}
            draftLabel={draftParent === todo.id ? draftLabel : ""}
            onToggleOpen={() => onToggleOpen(todo.id)}
            onToggle={onToggle}
            onToggleSub={(subId, checked) => onToggleSub(todo.id, subId, checked)}
            onStartDraft={() => onStartDraft(todo.id)}
            onDraftLabel={onDraftLabel}
            onCommitDraft={() => onCommitDraft(todo.id)}
            onCancelDraft={onCancelDraft}
            onEdit={(patch) => onEdit(todo.id, patch)}
            onEditSub={(subId, patch) => onEditSub(todo.id, subId, patch)}
            onAssign={(owner) => onAssign(todo.id, owner)}
            onDelete={() => onDelete(todo.id)}
          />
        ))
      ) : (
        <p className="todo-empty">Nothing waiting to be claimed.</p>
      )}
    </div>
  );
}

export function TodosPanel({
  memberId,
  memberProfiles,
  phases,
  checklist,
  projectSteps = [],
  subtasks,
  todoEdits,
  onToggle,
  onChangeSubtasks,
  onEditTodo,
  onDeleteTodo,
  onAddTodo,
}: {
  memberId: string;
  memberProfiles: MemberProfile[];
  phases: Phase[];
  checklist: Record<string, boolean>;
  projectSteps?: PersistedProjectStep[];
  subtasks: TodoSubtaskMap;
  todoEdits: TodoEditMap;
  onToggle: (id: string, checked: boolean) => void;
  onChangeSubtasks: (next: TodoSubtaskMap) => void;
  onEditTodo: (id: string, patch: TodoEdit) => void;
  onDeleteTodo: (id: string) => void;
  onAddTodo: (label: string) => void;
}) {
  const focusOwner: Owner = memberOwnerId(memberId);
  const profiles = new Map(memberProfiles.map((row) => [row.id, row]));
  const todos = listProjectTodos(checklist, phases, projectSteps, todoEdits);
  const grouped = groupTodosByOwner(todos, focusOwner);
  const storageKey = `kyle-todo-open:${focusOwner}`;
  const othersKey = `kyle-todo-others-open:${focusOwner}`;
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [othersExpanded, setOthersExpanded] = useState(false);
  const [draftParent, setDraftParent] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");

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

  useEffect(() => {
    try {
      setOthersExpanded(window.localStorage.getItem(othersKey) === "1");
    } catch {
      setOthersExpanded(false);
    }
  }, [othersKey]);

  function toggleOpen(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }

  function toggleOthers() {
    setOthersExpanded((current) => {
      const next = !current;
      window.localStorage.setItem(othersKey, next ? "1" : "0");
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

  function editSub(
    parentId: string,
    subId: string,
    patch: { label?: string; dueDate?: string | null },
  ) {
    onChangeSubtasks({
      ...subtasks,
      [parentId]: (subtasks[parentId] ?? []).map((row) =>
        row.id === subId ? { ...row, ...patch } : row,
      ),
    });
  }

  function assignTodo(id: string, owner: Owner | null) {
    onEditTodo(id, assignmentPatch(focusOwner, owner));
  }

  function commitNewTodo() {
    const label = newLabel.trim();
    if (!label) {
      setAdding(false);
      setNewLabel("");
      return;
    }
    onAddTodo(label);
    setNewLabel("");
    setAdding(false);
  }

  const shared = {
    viewer: focusOwner,
    profiles,
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
    onEdit: onEditTodo,
    onEditSub: editSub,
    onAssign: assignTodo,
    onDelete: onDeleteTodo,
  };

  return (
    <div className="pm-panel todos-panel">
      <div className="todo-add">
        {adding ? (
          <div className="todo-add-draft">
            <input
              className="field"
              autoFocus
              value={newLabel}
              aria-label="New to-do"
              placeholder="What needs doing?"
              onChange={(event) => setNewLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitNewTodo();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setAdding(false);
                  setNewLabel("");
                }
              }}
            />
            <button type="button" className="btn btn-primary compact" onClick={commitNewTodo}>
              Add
            </button>
            <button
              type="button"
              className="btn btn-ghost compact"
              onClick={() => {
                setAdding(false);
                setNewLabel("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setAdding(true)}>
            Add a to-do
          </button>
        )}
      </div>
      <TaskList bucket={grouped.mine} emphasis="focus" {...shared} />
      <OthersSection
        buckets={grouped.others}
        expanded={othersExpanded}
        onToggle={toggleOthers}
        profiles={profiles}
        shared={shared}
      />
      <UnclaimedList bucket={grouped.unclaimed} {...shared} />
    </div>
  );
}
