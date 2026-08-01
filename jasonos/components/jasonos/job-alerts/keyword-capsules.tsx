"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Target, X } from "lucide-react";
import { toast } from "sonner";
import {
  addJobAlertKeyword,
  removeJobAlertKeyword,
  updateJobAlertKeyword,
  type JobAlertKeyword,
} from "@/lib/server-actions/job-alert-keywords";

export function KeywordCapsules({
  initial,
}: {
  initial: JobAlertKeyword[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const refresh = () => router.refresh();

  const onAdd = () => {
    const value = draft.trim();
    if (!value) return;
    startTransition(async () => {
      const res = await addJobAlertKeyword(value);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDraft("");
      setAdding(false);
      toast.success(`Tracking “${value}”`);
      refresh();
    });
  };

  const onSaveEdit = (id: string) => {
    const value = editDraft.trim();
    if (!value) return;
    startTransition(async () => {
      const res = await updateJobAlertKeyword(id, value);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEditingId(null);
      toast.success("Keyword updated");
      refresh();
    });
  };

  const onRemove = (id: string, keyword: string) => {
    startTransition(async () => {
      const res = await removeJobAlertKeyword(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Removed “${keyword}”`);
      refresh();
    });
  };

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Target className="h-3.5 w-3.5" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
            Roles you&rsquo;re tracking
          </h2>
        </div>
        <span className="text-[11px] text-muted-foreground">
          keywords · {initial.length}
        </span>
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setDraft("");
          }}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-1 rounded-md border bg-background/60 px-2 py-1 text-[11px] font-medium text-foreground/90 hover:bg-muted"
        >
          <Plus className="h-3 w-3" />
          Add keyword
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {initial.map((k) =>
          editingId === k.id ? (
            <span
              key={k.id}
              className="inline-flex items-center gap-1 rounded-md border border-sky-400/40 bg-sky-500/10 px-1.5 py-0.5"
            >
              <input
                autoFocus
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveEdit(k.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                disabled={pending}
                className="w-36 bg-transparent px-1 text-[11px] text-foreground outline-none"
              />
              <button
                type="button"
                title="Save"
                disabled={pending}
                onClick={() => onSaveEdit(k.id)}
                className="rounded p-0.5 text-emerald-300 hover:bg-emerald-500/20"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                type="button"
                title="Cancel"
                disabled={pending}
                onClick={() => setEditingId(null)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <span
              key={k.id}
              className="group inline-flex items-center gap-0.5 rounded-md border bg-background/60 pl-2 pr-1 py-0.5 text-[11px] text-foreground/80"
            >
              {k.keyword}
              <button
                type="button"
                title="Edit"
                disabled={pending}
                onClick={() => {
                  setEditingId(k.id);
                  setEditDraft(k.keyword);
                }}
                className="rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100 group-hover:opacity-100"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                title="Remove"
                disabled={pending}
                onClick={() => onRemove(k.id, k.keyword)}
                className="rounded p-0.5 text-muted-foreground opacity-60 hover:bg-rose-500/20 hover:text-rose-300 hover:opacity-100 group-hover:opacity-100"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )
        )}

        {adding ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-400/40 bg-sky-500/10 px-1.5 py-0.5">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              placeholder="e.g. Chief of Staff"
              disabled={pending}
              className="w-40 bg-transparent px-1 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/60"
            />
            <button
              type="button"
              title="Add"
              disabled={pending || !draft.trim()}
              onClick={onAdd}
              className="rounded p-0.5 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              type="button"
              title="Cancel"
              disabled={pending}
              onClick={() => {
                setAdding(false);
                setDraft("");
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ) : null}

        {initial.length === 0 && !adding ? (
          <p className="text-[11px] text-muted-foreground">
            No keywords yet — add titles you want surfaced (CMO, Chief of Staff…).
          </p>
        ) : null}
      </div>
    </section>
  );
}
