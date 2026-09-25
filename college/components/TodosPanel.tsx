"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { MemberBadge } from "./MemberBadge";
import { TodoMoveMenu } from "./TodoMoveMenu";
import { TodoProjectEditor, type ProjectEditorState } from "./TodoProjectEditor";
import type { PersistedProjectStep } from "@/lib/ingest";
import { type MemberProfile } from "@/lib/member-avatars";
import {
  assignmentPatch,
  assignedByBadge,
  canMarkTodoDone,
  dueTone,
  groupTodosByOwner,
  groupTodosByProject,
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
import {
  TODO_GROUP_STORAGE_KEY,
  createTodoProject,
  isTodoGroupBy,
  nextProjectColorIndex,
  normalizeProjectName,
  openDatedStats,
  projectColor,
  type TodoGroupBy,
  type TodoProject,
} from "@/lib/todo-projects";
import { OWNERS, ownerLabel, type Owner, type Phase } from "@/lib/types";

const CARET = (
  <svg className="task-caret" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/** Project grouping props every row needs, threaded through the list wrappers. */
type TodoProjectProps = {
  groupBy: TodoGroupBy;
  projects: TodoProject[];
  menuTodoId: string | null;
  dragTodoId: string | null;
  onToggleMenu: (id: string) => void;
  onPickProject: (id: string, projectId: string | null) => void;
  onCloseMenu: () => void;
  onGripDragStart: (id: string, event: DragEvent<HTMLElement>) => void;
};

function TaskRow({
  todo,
  subtasks,
  open,
  viewer,
  profiles,
  drafting,
  draftLabel,
  groupBy,
  projects,
  menuOpen,
  dragging,
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
  onToggleMenu,
  onPickProject,
  onCloseMenu,
  onGripDragStart,
}: {
  todo: ProjectTodo;
  subtasks: TodoSubtask[];
  open: boolean;
  viewer: Owner;
  profiles: Map<string, MemberProfile>;
  drafting: boolean;
  draftLabel: string;
  groupBy: TodoGroupBy;
  projects: TodoProject[];
  menuOpen: boolean;
  dragging: boolean;
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
  onToggleMenu: () => void;
  onPickProject: (projectId: string | null) => void;
  onCloseMenu: () => void;
  onGripDragStart: (event: DragEvent<HTMLElement>) => void;
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
  const rowRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);
  const tagRef = useRef<HTMLButtonElement>(null);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  const byProject = groupBy === "project";
  const project = projects.find((row) => row.id === todo.projectId) ?? null;
  const ownerProfile = todo.owner ? profiles.get(todo.owner) : null;
  const showMeta = !byProject && Boolean(project || (fromOwner && fromLabel));

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setConfirmDelete(false);
    }
  }, [open]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuWrapRef.current?.contains(target)) return;
      if (gripRef.current?.contains(target)) return;
      if (tagRef.current?.contains(target)) return;
      onCloseMenu();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen, onCloseMenu]);

  function closeMenuAndRefocus() {
    onCloseMenu();
    const anchor = byProject ? gripRef.current : tagRef.current;
    window.requestAnimationFrame(() => anchor?.focus());
  }

  return (
    <div className={open ? "task is-open" : "task"} data-task={todo.id}>
      <div
        className={`task-row${byProject ? " is-project-view" : ""}${dragging ? " is-lifted" : ""}${menuOpen ? " is-menu-open" : ""}`}
        ref={rowRef}
      >
        {byProject ? (
          <button
            ref={gripRef}
            type="button"
            className="task-grip"
            draggable
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Move “${todo.label}”. Drag, or press to choose a project`}
            title="Drag to move, or click for the Move menu"
            onClick={onToggleMenu}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", todo.id);
              event.dataTransfer.effectAllowed = "move";
              if (rowRef.current) event.dataTransfer.setDragImage(rowRef.current, 20, 20);
              onGripDragStart(event);
            }}
          >
            ⋮⋮
          </button>
        ) : null}
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
        {byProject ? (
          <span className="task-owner">
            {todo.owner ? (
              <MemberBadge
                name={ownerProfile?.displayName ?? ownerLabel(todo.owner)}
                avatarUrl={ownerProfile?.avatarUrl}
                size="sm"
                showName={false}
              />
            ) : (
              <span className="task-owner-none" title="Unclaimed">
                ?
                <span className="sr-only">Unclaimed</span>
              </span>
            )}
          </span>
        ) : null}
        <div className="task-main">
          <button
            className="task-title"
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={onToggleOpen}
          >
            <span className="task-title-text">{todo.label}</span>
          </button>
          {showMeta ? (
            <div className="task-meta">
              {project ? (
                <button
                  ref={tagRef}
                  type="button"
                  className="task-ptag"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label={`Move “${todo.label}”. Choose a project`}
                  onClick={onToggleMenu}
                >
                  <span
                    className="task-ptag-dot"
                    style={{ background: projectColor(project.colorIndex) }}
                    aria-hidden="true"
                  />
                  <span className="task-ptag-name">{project.name}</span>
                </button>
              ) : null}
              {fromOwner && fromLabel ? (
                <MemberBadge
                  name={fromProfile?.displayName ?? ownerLabel(fromOwner)}
                  avatarUrl={fromProfile?.avatarUrl}
                  prefix="From"
                />
              ) : null}
            </div>
          ) : null}
        </div>
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
      {menuOpen ? (
        <div className="task-menu-anchor" ref={menuWrapRef}>
          <TodoMoveMenu
            projects={projects}
            currentProjectId={todo.projectId}
            onPick={(projectId) => onPickProject(projectId)}
            onClose={closeMenuAndRefocus}
          />
        </div>
      ) : null}
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

/** Everything the list wrappers hand each row. */
type SharedTodoProps = TodoProjectProps & {
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

function renderTaskRow(todo: ProjectTodo, shared: SharedTodoProps) {
  return (
    <TaskRow
      key={todo.id}
      todo={todo}
      subtasks={shared.subtasks[todo.id] ?? []}
      open={shared.openIds.has(todo.id)}
      viewer={shared.viewer}
      profiles={shared.profiles}
      drafting={shared.draftParent === todo.id}
      draftLabel={shared.draftParent === todo.id ? shared.draftLabel : ""}
      groupBy={shared.groupBy}
      projects={shared.projects}
      menuOpen={shared.menuTodoId === todo.id}
      dragging={shared.dragTodoId === todo.id}
      onToggleOpen={() => shared.onToggleOpen(todo.id)}
      onToggle={shared.onToggle}
      onToggleSub={(subId, checked) => shared.onToggleSub(todo.id, subId, checked)}
      onStartDraft={() => shared.onStartDraft(todo.id)}
      onDraftLabel={shared.onDraftLabel}
      onCommitDraft={() => shared.onCommitDraft(todo.id)}
      onCancelDraft={shared.onCancelDraft}
      onEdit={(patch) => shared.onEdit(todo.id, patch)}
      onEditSub={(subId, patch) => shared.onEditSub(todo.id, subId, patch)}
      onAssign={(owner) => shared.onAssign(todo.id, owner)}
      onDelete={() => shared.onDelete(todo.id)}
      onToggleMenu={() => shared.onToggleMenu(todo.id)}
      onPickProject={(projectId) => shared.onPickProject(todo.id, projectId)}
      onCloseMenu={shared.onCloseMenu}
      onGripDragStart={(event) => shared.onGripDragStart(todo.id, event)}
    />
  );
}

function TaskList({
  bucket,
  emphasis,
  ...shared
}: SharedTodoProps & {
  bucket: OwnerTodoBucket;
  emphasis: "focus" | "other";
}) {
  const { profiles } = shared;
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
        todos.map((todo) => renderTaskRow(todo, shared))
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
  shared: SharedTodoProps;
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
  ...shared
}: SharedTodoProps & {
  bucket: UnclaimedTodoBucket;
}) {
  const todos = [...bucket.open, ...bucket.done];
  const stats = openListStats(todos);

  return (
    <div className="list list-unclaimed">
      <div className="list-head">
        <h1 className="list-head-name">Unclaimed</h1>
        <span className="list-count">{stats.label}</span>
      </div>
      {todos.length ? (
        todos.map((todo) => renderTaskRow(todo, shared))
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
  todoProjects = [],
  onToggle,
  onChangeSubtasks,
  onEditTodo,
  onDeleteTodo,
  onChangeTodoProjects,
  onDeleteTodoProject,
}: {
  memberId: string;
  memberProfiles: MemberProfile[];
  phases: Phase[];
  checklist: Record<string, boolean>;
  projectSteps?: PersistedProjectStep[];
  subtasks: TodoSubtaskMap;
  todoEdits: TodoEditMap;
  todoProjects?: TodoProject[];
  onToggle: (id: string, checked: boolean) => void;
  onChangeSubtasks: (next: TodoSubtaskMap) => void;
  onEditTodo: (id: string, patch: TodoEdit) => void;
  onDeleteTodo: (id: string) => void;
  onChangeTodoProjects: (next: TodoProject[]) => void;
  onDeleteTodoProject: (projectId: string) => void;
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
  const [groupBy, setGroupBy] = useState<TodoGroupBy>("person");
  const [menuTodoId, setMenuTodoId] = useState<string | null>(null);
  const [editor, setEditor] = useState<ProjectEditorState | null>(null);
  const [dragTodoId, setDragTodoId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TODO_GROUP_STORAGE_KEY);
      if (isTodoGroupBy(raw)) setGroupBy(raw);
    } catch {
      setGroupBy("person");
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("todos-dragging", Boolean(dragTodoId));
    return () => document.body.classList.remove("todos-dragging");
  }, [dragTodoId]);

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

  function changeGroupBy(next: TodoGroupBy) {
    setGroupBy(next);
    setMenuTodoId(null);
    setEditor(null);
    try {
      window.localStorage.setItem(TODO_GROUP_STORAGE_KEY, next);
    } catch {
      /* storage is best effort */
    }
  }

  function startNewProject(moveTodoIds: string[] = []) {
    setMenuTodoId(null);
    setEditor({
      mode: "new",
      projectId: null,
      draft: "",
      colorIndex: nextProjectColorIndex(todoProjects),
      moveTodoIds,
      confirmDelete: false,
    });
  }

  function startEditProject(project: TodoProject) {
    setMenuTodoId(null);
    setEditor({
      mode: "edit",
      projectId: project.id,
      draft: project.name,
      colorIndex: project.colorIndex,
      moveTodoIds: [],
      confirmDelete: false,
    });
  }

  function saveEditor() {
    if (!editor) return;
    const name = normalizeProjectName(editor.draft);
    if (!name) return;
    if (editor.mode === "new") {
      const project = createTodoProject(name, todoProjects, editor.colorIndex);
      if (!project) return;
      onChangeTodoProjects([...todoProjects, project]);
      for (const id of editor.moveTodoIds) onEditTodo(id, { projectId: project.id });
    } else if (editor.projectId) {
      onChangeTodoProjects(
        todoProjects.map((row) =>
          row.id === editor.projectId ? { ...row, name, colorIndex: editor.colorIndex } : row,
        ),
      );
    }
    setEditor(null);
  }

  function deleteEditorProject() {
    if (!editor?.projectId) return;
    onDeleteTodoProject(editor.projectId);
    setEditor(null);
  }

  function pickProject(id: string, projectId: string | null) {
    onEditTodo(id, { projectId });
    setMenuTodoId(null);
  }

  function endDrag() {
    setDragTodoId(null);
    setDragOverKey(null);
  }

  function dropOnGroup(event: DragEvent<HTMLElement>, key: string) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || dragTodoId;
    endDrag();
    if (!id) return;
    onEditTodo(id, { projectId: key === "none" ? null : key });
  }

  const editorTodoCount = editor?.projectId
    ? todos.filter((todo) => todo.projectId === editor.projectId).length
    : 0;

  const shared: SharedTodoProps = {
    groupBy,
    projects: todoProjects,
    menuTodoId,
    dragTodoId,
    onToggleMenu: (id: string) => setMenuTodoId((current) => (current === id ? null : id)),
    onPickProject: pickProject,
    onCloseMenu: () => setMenuTodoId(null),
    onGripDragStart: (id: string) => {
      setMenuTodoId(null);
      setDragTodoId(id);
    },
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

  const projectGroups = groupTodosByProject(todos, todoProjects);
  const showTopEditor = Boolean(editor && (editor.mode === "new" || groupBy !== "project"));

  const editorPanel = editor ? (
    <TodoProjectEditor
      state={editor}
      projects={todoProjects}
      todoCount={editorTodoCount}
      onChange={(patch) => setEditor((current) => (current ? { ...current, ...patch } : current))}
      onSave={saveEditor}
      onCancel={() => setEditor(null)}
      onAskDelete={() => setEditor((current) => (current ? { ...current, confirmDelete: true } : current))}
      onConfirmDelete={deleteEditorProject}
    />
  ) : null;

  return (
    <div className="pm-panel todos-panel">
      <div className="todos-groupbar">
        <span className="label">Group by</span>
        <button
          type="button"
          className="todos-seg"
          aria-pressed={groupBy === "person"}
          onClick={() => changeGroupBy("person")}
        >
          Person
        </button>
        <button
          type="button"
          className="todos-seg"
          aria-pressed={groupBy === "project"}
          onClick={() => changeGroupBy("project")}
        >
          Project
        </button>
        {groupBy === "project" ? (
          <button type="button" className="todos-newproject" onClick={() => startNewProject()}>
            ＋ New project
          </button>
        ) : null}
      </div>

      {showTopEditor ? editorPanel : null}

      {groupBy === "project" ? (
        <div className="todo-project-groups" onDragEnd={endDrag}>
          {projectGroups.map((group) => {
            const key = group.projectId ?? "none";
            const rows = [...group.open, ...group.done];
            const stats = openDatedStats(rows);
            const project = group.projectId
              ? todoProjects.find((row) => row.id === group.projectId) ?? null
              : null;
            const editingHere = Boolean(
              editor && editor.mode === "edit" && editor.projectId === group.projectId,
            );
            return (
              <section
                key={key}
                className={`todo-project-group${dragOverKey === key ? " is-over" : ""}`}
                aria-label={group.name}
                onDragOver={(event) => {
                  if (!dragTodoId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dragOverKey !== key) setDragOverKey(key);
                }}
                onDrop={(event) => dropOnGroup(event, key)}
              >
                <div className="todo-project-head">
                  <span
                    className={`todo-project-sq${project ? "" : " is-none"}`}
                    style={project ? { background: projectColor(project.colorIndex) } : undefined}
                    aria-hidden="true"
                  />
                  <h2 className="todo-project-name">{group.name}</h2>
                  {project ? (
                    <button
                      type="button"
                      className="todo-project-edit"
                      onClick={() => startEditProject(project)}
                    >
                      Edit
                    </button>
                  ) : null}
                  <span className="list-count todo-project-stat">{stats.label}</span>
                </div>
                {editingHere ? editorPanel : null}
                {rows.length ? (
                  rows.map((todo) => renderTaskRow(todo, shared))
                ) : (
                  <p className="todo-empty todo-project-empty">
                    Drag a to-do here, or use its dots to choose this project.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <>
          <TaskList bucket={grouped.mine} emphasis="focus" {...shared} />
          <OthersSection
            buckets={grouped.others}
            expanded={othersExpanded}
            onToggle={toggleOthers}
            profiles={profiles}
            shared={shared}
          />
          <UnclaimedList bucket={grouped.unclaimed} {...shared} />
        </>
      )}
    </div>
  );
}
