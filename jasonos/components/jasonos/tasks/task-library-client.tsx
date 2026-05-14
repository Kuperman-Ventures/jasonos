"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  createTask,
  saveTask,
  deleteTask,
  type TaskTemplate,
  type Subtask,
} from "@/lib/server-actions/tasks";

// ─── Track definitions ────────────────────────────────────────────────────────

const TRACKS: { key: string; label: string; color: string; priority: number }[] = [
  { key: "advisors",    label: "Kuperman Advisors",  color: "#1E6B3C", priority: 1 },
  { key: "jobSearch",   label: "Job Search",          color: "#2E75B6", priority: 2 },
  { key: "ventures",    label: "Kuperman Ventures",   color: "#9B6BAE", priority: 3 },
  { key: "networking",  label: "Shared Networking",   color: "#B8600B", priority: 4 },
  { key: "development", label: "Development",          color: "#7c3aed", priority: 5 },
  { key: "cosaAdmin",   label: "Administration",       color: "#0891b2", priority: 6 },
];

const TRACK_SUB_TRACKS: Record<string, string[]> = {
  advisors:    ["Networking & Business Development", "Materials", "Product", "Client Work", "Back Office"],
  jobSearch:   ["Network Development & Outreach", "Searching", "Materials"],
  ventures:    ["Alpha", "Product", "Beta Prep"],
  networking:  [],
  development: [],
  cosaAdmin:   [],
};

const LIBRARY_STATUSES = ["Active", "Paused", "Archived"] as const;

const STATUS_BEHAVIOR: Record<string, string> = {
  Active: "Appears in Today's queue and can be scheduled.",
  Paused: "Hidden from Today suggestions but preserved in the library.",
  Archived: "Fully hidden. Can be permanently deleted.",
};

const FILTERS = ["Active", "Paused", "Archived", "All"] as const;
type Filter = (typeof FILTERS)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-50";

// ─── Subtask editor ───────────────────────────────────────────────────────────

function SubtaskEditor({
  subtasks,
  onChange,
}: {
  subtasks: Subtask[];
  onChange: (next: Subtask[]) => void;
}) {
  function addSubtask() {
    onChange([...subtasks, { id: `st-${Date.now()}`, text: "", items: [] }]);
  }

  function removeSubtask(id: string) {
    onChange(subtasks.filter((s) => s.id !== id));
  }

  function updateSubtask(id: string, patch: Partial<Subtask>) {
    onChange(subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addItem(stId: string) {
    updateSubtask(stId, {
      items: [
        ...(subtasks.find((s) => s.id === stId)?.items ?? []),
        { id: `it-${Date.now()}`, text: "" },
      ],
    });
  }

  function removeItem(stId: string, itemId: string) {
    const st = subtasks.find((s) => s.id === stId);
    if (!st) return;
    updateSubtask(stId, { items: st.items.filter((i) => i.id !== itemId) });
  }

  function updateItem(stId: string, itemId: string, text: string) {
    const st = subtasks.find((s) => s.id === stId);
    if (!st) return;
    updateSubtask(stId, {
      items: st.items.map((i) => (i.id === itemId ? { ...i, text } : i)),
    });
  }

  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Subtasks{" "}
          <span className="text-xs opacity-60">(each can have checklist items)</span>
        </span>
        <button
          type="button"
          onClick={addSubtask}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          + Add subtask
        </button>
      </div>

      {subtasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
          No subtasks yet — click "Add subtask" to create a checklist.
        </p>
      ) : (
        <ul className="space-y-3">
          {subtasks.map((st, stIdx) => (
            <li key={st.id} className="rounded-lg border border-border bg-muted p-2.5">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-muted-foreground/40">☐</span>
                <input
                  type="text"
                  value={st.text}
                  placeholder={`Subtask ${stIdx + 1}`}
                  onChange={(e) => updateSubtask(st.id, { text: e.target.value })}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => removeSubtask(st.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  ✕
                </button>
              </div>

              {st.items.length > 0 && (
                <ul className="mt-2 space-y-1.5 border-l-2 border-border pl-4">
                  {st.items.map((item, iIdx) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span className="shrink-0 text-[10px] text-muted-foreground/40">○</span>
                      <input
                        type="text"
                        value={item.text}
                        placeholder={`Item ${iIdx + 1}`}
                        onChange={(e) => updateItem(st.id, item.id, e.target.value)}
                        className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(st.id, item.id)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => addItem(st.id)}
                className="mt-2 ml-4 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                + add checklist item
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Task Editor ──────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

function TaskEditor({
  task,
  onSaved,
  onDeleted,
}: {
  task: TaskTemplate;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<TaskTemplate>({ ...task });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Keep draft in sync when the selected task changes
  const [prevId, setPrevId] = useState(task.id);
  if (task.id !== prevId) {
    setDraft({ ...task });
    setPrevId(task.id);
    setSaveStatus("idle");
    setArchiveConfirm(false);
    setDeleteConfirm(false);
  }

  function update<K extends keyof TaskTemplate>(field: K, value: TaskTemplate[K]) {
    setDraft((d) => ({ ...d, [field]: value }));
    if (field === "track") {
      const subs = TRACK_SUB_TRACKS[value as string] ?? [];
      if (draft.subTrack && !subs.includes(draft.subTrack)) {
        setDraft((d) => ({ ...d, track: value as string, subTrack: null }));
      }
    }
    setSaveStatus("idle");
  }

  function handleSave() {
    if (!draft.name.trim()) return;
    setSaveStatus("saving");
    startTransition(async () => {
      const result = await saveTask(draft);
      if (!result.ok) {
        setSaveStatus("error");
        return;
      }
      setSaveStatus("saved");
      router.refresh();
      onSaved();
      setTimeout(() => setSaveStatus("idle"), 2000);
    });
  }

  function handleArchive() {
    startTransition(async () => {
      const result = await saveTask({ ...draft, status: "Archived" });
      if (result.ok) {
        router.refresh();
        onDeleted();
      }
      setArchiveConfirm(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTask(draft.id);
      if (result.ok) {
        router.refresh();
        onDeleted();
      }
      setDeleteConfirm(false);
    });
  }

  const subTracks = TRACK_SUB_TRACKS[draft.track] ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Name */}
      <label className="sm:col-span-2 text-sm">
        <span className="mb-1 block text-muted-foreground">Name</span>
        <input
          value={draft.name}
          onChange={(e) => update("name", e.target.value)}
          className={inputCls}
        />
      </label>

      {/* Track */}
      <label className="text-sm">
        <span className="mb-1 block text-muted-foreground">Track</span>
        <select
          value={draft.track}
          onChange={(e) => update("track", e.target.value)}
          className={inputCls}
        >
          {TRACKS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {/* Sub-track */}
      <label className="text-sm">
        <span className="mb-1 block text-muted-foreground">Sub-Track</span>
        <select
          value={draft.subTrack ?? ""}
          onChange={(e) => update("subTrack", e.target.value || null)}
          className={inputCls}
          disabled={subTracks.length === 0}
        >
          <option value="">— none —</option>
          {subTracks.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Used for weekly allocation tracking.
        </p>
      </label>

      {/* Time estimate */}
      <label className="text-sm">
        <span className="mb-1 block text-muted-foreground">Default Time Estimate (minutes)</span>
        <input
          key={draft.id}
          type="number"
          min={5}
          step={5}
          defaultValue={draft.defaultTimeEstimate}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n >= 1) update("defaultTimeEstimate", n);
          }}
          onBlur={(e) => {
            const n = parseInt(e.target.value, 10);
            update("defaultTimeEstimate", Math.max(5, isNaN(n) ? 5 : n));
          }}
          className={inputCls}
        />
      </label>

      {/* Status */}
      <label className="text-sm">
        <span className="mb-1 block text-muted-foreground">Status</span>
        <select
          value={draft.status}
          onChange={(e) => update("status", e.target.value as TaskTemplate["status"])}
          className={inputCls}
        >
          {LIBRARY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          {STATUS_BEHAVIOR[draft.status]}
        </p>
      </label>

      {/* Subtasks */}
      <SubtaskEditor
        subtasks={draft.subtasks}
        onChange={(next) => { setDraft((d) => ({ ...d, subtasks: next })); setSaveStatus("idle"); }}
      />

      {/* Actions */}
      <div className="sm:col-span-2 flex items-center justify-between gap-2 border-t border-border pt-3">
        {/* Left: archive / delete */}
        {draft.status === "Archived" ? (
          deleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Permanently delete? This cannot be undone.
              </span>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, Delete Permanently
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
            >
              Delete Task
            </button>
          )
        ) : archiveConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Archive this task? It won&apos;t be deleted, just hidden.
            </span>
            <button
              type="button"
              onClick={() => setArchiveConfirm(false)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={isPending}
              className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Archive
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setArchiveConfirm(true)}
            className="rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            Archive Task
          </button>
        )}

        {/* Right: save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || saveStatus === "saving" || !draft.name.trim()}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
            saveStatus === "saved"
              ? "bg-green-600 text-white"
              : saveStatus === "error"
              ? "bg-destructive text-destructive-foreground"
              : "bg-foreground text-background hover:bg-foreground/90 active:scale-95"
          } disabled:opacity-50`}
        >
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
            ? "✓ Saved"
            : saveStatus === "error"
            ? "Save failed — retry"
            : "Save Task"}
        </button>
      </div>
    </div>
  );
}

// ─── Root Client Component ────────────────────────────────────────────────────

export function TaskLibraryClient({
  tasks,
  initialSelectedId,
}: {
  tasks: TaskTemplate[];
  initialSelectedId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("Active");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [collapsedTracks, setCollapsedTracks] = useState<Record<string, boolean>>({});

  const filteredTasks =
    filter === "All" ? tasks : tasks.filter((t) => t.status === filter);

  const grouped = filteredTasks.reduce<Record<string, TaskTemplate[]>>((acc, task) => {
    const key = task.track ?? "advisors";
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;

  function handleAdd() {
    startTransition(async () => {
      const result = await createTask();
      if (result.ok) {
        router.refresh();
        setSelectedId(result.id);
        setFilter("Active");
      }
    });
  }

  const handleDeselect = useCallback(() => setSelectedId(null), []);

  return (
    <section className="grid h-full gap-0 lg:grid-cols-[320px_1fr]">
      {/* ── Left panel: task list ── */}
      <aside className="flex flex-col overflow-hidden border-r border-border">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Library Tasks
          </h2>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending}
            className="rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            Add Task
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-border">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-md px-1 py-1 text-[11px] font-medium transition-colors ${
                filter === f
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {filteredTasks.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
              No tasks in this filter.
            </p>
          ) : (
            TRACKS.sort((a, b) => a.priority - b.priority).map((track) => {
              const group = grouped[track.key];
              if (!group || group.length === 0) return null;
              const collapsed = collapsedTracks[track.key];

              return (
                <div key={track.key}>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedTracks((p) => ({ ...p, [track.key]: !p[track.key] }))
                    }
                    className="flex w-full items-center justify-between rounded-md px-1 py-1 hover:bg-muted"
                  >
                    <span
                      className="text-[11px] font-bold uppercase tracking-wide"
                      style={{ color: track.color }}
                    >
                      {track.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {group.length}
                      </span>
                      {collapsed ? (
                        <ChevronRight size={12} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={12} className="text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {!collapsed && (
                    <ul className="mt-1 space-y-1.5 pl-1">
                      {group.map((task) => {
                        const selected = task.id === selectedId;
                        return (
                          <li key={task.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(task.id)}
                              className={`w-full rounded-md border px-2 py-2 text-left text-sm transition-colors ${
                                selected
                                  ? "border-foreground bg-foreground text-background"
                                  : task.status === "Paused"
                                  ? "border-border bg-muted/40 hover:bg-muted"
                                  : task.status === "Archived"
                                  ? "border-border bg-background opacity-50 hover:opacity-100"
                                  : "border-border bg-background hover:bg-muted"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate font-medium">{task.name}</span>
                                <div className="flex shrink-0 items-center gap-1">
                                  {task.status === "Paused" && !selected && (
                                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                                      Paused
                                    </span>
                                  )}
                                  {task.status === "Archived" && !selected && (
                                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                                      Archived
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-xs opacity-70">
                                <span>{task.subTrack ?? "—"}</span>
                                <span>{task.defaultTimeEstimate}m</span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Right panel: editor ── */}
      <article className="overflow-y-auto p-6">
        <h2 className="text-lg font-semibold text-foreground">Task Library</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Library edits update template data only. They do not retroactively change current Today tasks.
        </p>

        {!selectedTask ? (
          <p className="mt-4 text-sm text-muted-foreground">Select a task to edit.</p>
        ) : (
          <div className="mt-4">
            <TaskEditor
              key={selectedTask.id}
              task={selectedTask}
              onSaved={() => {}}
              onDeleted={handleDeselect}
            />
          </div>
        )}
      </article>
    </section>
  );
}
