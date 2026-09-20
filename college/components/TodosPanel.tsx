"use client";

import type { PersistedProjectStep } from "@/lib/ingest";
import {
  assignedByBadge,
  canMarkTodoDone,
  formatTodoWhen,
  groupTodosByOwner,
  listProjectTodos,
  memberOwnerId,
  type OwnerTodoBucket,
  type ProjectTodo,
} from "@/lib/project-todos";
import { ownerLabel, type Owner, type Phase } from "@/lib/types";

function TodoRow({
  todo,
  viewer,
  onToggle,
}: {
  todo: ProjectTodo;
  viewer: Owner;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const canToggle = canMarkTodoDone(viewer, todo.owner);
  const fromBadge = assignedByBadge(todo);

  return (
    <li className={todo.done ? "todo-row done" : "todo-row"}>
      <label className={canToggle ? "todo-check" : "todo-check locked"}>
        <input
          type="checkbox"
          checked={todo.done}
          disabled={!canToggle}
          onChange={(event) => {
            if (!canToggle) return;
            onToggle(todo.id, event.target.checked);
          }}
          aria-label={
            canToggle
              ? `Mark done: ${todo.label}`
              : `${todo.label} (only ${ownerLabel(todo.owner)} can check this off)`
          }
          title={
            canToggle ? undefined : `Only ${ownerLabel(todo.owner)} can check this off`
          }
        />
        <span className="todo-copy">
          <span className="todo-label-row">
            <span className="todo-label">{todo.label}</span>
            {fromBadge ? <span className="todo-from-badge">{fromBadge}</span> : null}
          </span>
          <span className="todo-meta">
            <span className="todo-when">{formatTodoWhen(todo)}</span>
            <span className="todo-parent">
              {todo.phase} · {todo.parentText}
            </span>
          </span>
        </span>
      </label>
    </li>
  );
}

function TodoBucket({
  bucket,
  emphasis,
  viewer,
  onToggle,
}: {
  bucket: OwnerTodoBucket;
  emphasis: "focus" | "other";
  viewer: Owner;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const total = bucket.open.length + bucket.done.length;
  if (!total) {
    return (
      <section className={`todo-bucket ${emphasis}`}>
        <header className="todo-bucket-head">
          <h3>{bucket.label}</h3>
          <span className="todo-count">0 open</span>
        </header>
        <p className="todo-empty">No to-dos assigned yet.</p>
      </section>
    );
  }

  return (
    <section className={`todo-bucket ${emphasis}`}>
      <header className="todo-bucket-head">
        <h3>{bucket.label}</h3>
        <span className="todo-count">
          {bucket.open.length} open
          {bucket.done.length ? ` · ${bucket.done.length} done` : ""}
        </span>
      </header>
      {bucket.open.length ? (
        <ul className="todo-list">
          {bucket.open.map((todo) => (
            <TodoRow key={todo.id} todo={todo} viewer={viewer} onToggle={onToggle} />
          ))}
        </ul>
      ) : (
        <p className="todo-empty">Nothing open right now.</p>
      )}
      {bucket.done.length ? (
        <details className="todo-done-block">
          <summary>Done ({bucket.done.length})</summary>
          <ul className="todo-list">
            {bucket.done.map((todo) => (
              <TodoRow key={todo.id} todo={todo} viewer={viewer} onToggle={onToggle} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export function TodosPanel({
  memberId,
  phases,
  checklist,
  projectSteps = [],
  onToggle,
}: {
  memberId: string;
  phases: Phase[];
  checklist: Record<string, boolean>;
  projectSteps?: PersistedProjectStep[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  const focusOwner: Owner = memberOwnerId(memberId);
  const todos = listProjectTodos(checklist, phases, projectSteps);
  const grouped = groupTodosByOwner(todos, focusOwner);
  const myOpen = grouped.mine.open.length;
  const othersOpen = grouped.others.reduce((sum, bucket) => sum + bucket.open.length, 0);

  return (
    <div className="pm-panel todos-panel">
      <div className="todos-summary">
        <div className="readout">
          <span className="label">Yours open</span>
          <span className="figure">{myOpen}</span>
          <span className="unit">for {ownerLabel(focusOwner)}</span>
        </div>
        <div className="readout">
          <span className="label">Household open</span>
          <span className="figure">{othersOpen}</span>
          <span className="unit">on everyone else</span>
        </div>
      </div>

      <p className="section-sub todos-acl-note">
        Anyone can put work on anyone&apos;s list. Only you can check off items on your list.
      </p>

      <TodoBucket
        bucket={grouped.mine}
        emphasis="focus"
        viewer={focusOwner}
        onToggle={onToggle}
      />

      <h3 className="dash-title todos-others-title">Also on the list</h3>
      <p className="section-sub">
        You can add to these lists from Ingest. Checkboxes stay with the person who owns the work.
      </p>
      <div className="todos-others">
        {grouped.others.map((bucket) => (
          <TodoBucket
            key={bucket.owner}
            bucket={bucket}
            emphasis="other"
            viewer={focusOwner}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}
