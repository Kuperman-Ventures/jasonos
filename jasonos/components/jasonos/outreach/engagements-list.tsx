"use client";

// EngagementsList — the editable history of logged interactions on a contact.
// Each engagement (a contact_touches row) can be edited in place — its type,
// direction, date, note, and outcome — or deleted. Backed by the
// updateEngagement / deleteEngagement server actions, which re-stamp the
// contact's cadence after any change.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  updateEngagement,
  deleteEngagement,
  type EngagementPatch,
} from "@/lib/server-actions/engagements";
import type { RecentTouch } from "@/lib/outreach/draft-types";

const CHANNELS: { value: string; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "text", label: "Text" },
  { value: "phone", label: "Phone" },
  { value: "call", label: "Call" },
  { value: "video", label: "Video" },
  { value: "in_person", label: "In person" },
  { value: "coffee_chat", label: "Coffee" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "calendar", label: "Meeting" },
  { value: "thank_you_note", label: "Thank-you" },
  { value: "value_sharing", label: "Value-share" },
  { value: "other", label: "Other" },
];

function channelLabel(v: string): string {
  return CHANNELS.find((c) => c.value === v)?.label ?? v;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface Draft {
  channel: string;
  direction: string;
  date: string; // YYYY-MM-DD
  brief: string;
  outcome: string;
}

export function EngagementsList({
  contactId,
  initial,
}: {
  contactId: string | null;
  initial: RecentTouch[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<RecentTouch[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);

  if (items.length === 0) return null;

  const startEdit = (t: RecentTouch) => {
    setEditingId(t.id);
    setDraft({
      channel: t.channel,
      direction: t.direction,
      date: t.touched_at.slice(0, 10),
      brief: t.brief ?? "",
      outcome: t.outcome ?? "",
    });
  };

  const cancel = () => {
    setEditingId(null);
    setDraft(null);
  };

  const save = async (t: RecentTouch) => {
    if (!draft) return;
    setPending(true);
    const patch: EngagementPatch = {
      channel: draft.channel as EngagementPatch["channel"],
      direction: draft.direction as EngagementPatch["direction"],
      brief: draft.brief,
      outcome: draft.outcome,
    };
    const origDate = t.touched_at.slice(0, 10);
    if (draft.date && draft.date !== origDate) {
      patch.touchedAt = `${draft.date}T12:00:00.000Z`;
    }
    const res = await updateEngagement(t.id, patch);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setItems((prev) =>
      prev
        .map((x) =>
          x.id === t.id
            ? {
                ...x,
                channel: draft.channel,
                direction: draft.direction,
                brief: draft.brief.trim() || null,
                outcome: draft.outcome.trim() || null,
                touched_at: patch.touchedAt ?? x.touched_at,
              }
            : x
        )
        .sort((a, b) => (a.touched_at < b.touched_at ? 1 : -1))
    );
    cancel();
    toast.success("Engagement updated");
    router.refresh();
  };

  const remove = async (t: RecentTouch) => {
    setPending(true);
    const res = await deleteEngagement(t.id);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== t.id));
    cancel();
    toast.success("Engagement deleted");
    router.refresh();
  };

  const inputCls =
    "w-full rounded border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-foreground/40";

  return (
    <ul className="space-y-1.5">
      {items.map((t) => {
        const editing = editingId === t.id;
        if (editing && draft) {
          return (
            <li
              key={t.id}
              className="rounded-md border bg-card/60 p-2.5 text-[11px]"
            >
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    Type
                  </span>
                  <select
                    className={inputCls}
                    value={draft.channel}
                    onChange={(e) =>
                      setDraft({ ...draft, channel: e.target.value })
                    }
                  >
                    {CHANNELS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                    {CHANNELS.every((c) => c.value !== draft.channel) ? (
                      <option value={draft.channel}>{draft.channel}</option>
                    ) : null}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    Direction
                  </span>
                  <select
                    className={inputCls}
                    value={draft.direction}
                    onChange={(e) =>
                      setDraft({ ...draft, direction: e.target.value })
                    }
                  >
                    <option value="outbound">You reached out</option>
                    <option value="inbound">They reached out</option>
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 col-span-2">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    Date
                  </span>
                  <input
                    type="date"
                    className={inputCls}
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-0.5 col-span-2">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    Note
                  </span>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="What happened / subject"
                    value={draft.brief}
                    onChange={(e) => setDraft({ ...draft, brief: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-0.5 col-span-2">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    Outcome
                  </span>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Result / next step"
                    value={draft.outcome}
                    onChange={(e) =>
                      setDraft({ ...draft, outcome: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(t)}
                  className="inline-flex items-center gap-1 rounded border border-red-500/40 px-1.5 py-1 text-[10px] text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={cancel}
                    className="inline-flex items-center gap-1 rounded border px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => save(t)}
                    className="inline-flex items-center gap-1 rounded border border-emerald-500/40 px-1.5 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    {pending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Save
                  </button>
                </div>
              </div>
            </li>
          );
        }

        return (
          <li
            key={t.id}
            className="group flex items-start gap-2 rounded-md border border-transparent px-1 py-1 text-[11px] text-muted-foreground hover:border-border hover:bg-card/40"
          >
            <span
              className={cn(
                "mt-[1px] shrink-0 rounded-sm border px-1 py-0.5 text-[9px] uppercase",
                t.direction === "outbound"
                  ? "border-emerald-500/40 text-emerald-300"
                  : "border-sky-500/40 text-sky-300"
              )}
            >
              {channelLabel(t.channel)}
            </span>
            <span className="mt-[1px] shrink-0 font-mono text-[10px]">
              {fmtDate(t.touched_at)}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {t.brief || t.outcome || (
                <span className="italic opacity-60">no note</span>
              )}
            </span>
            {contactId ? (
              <button
                type="button"
                onClick={() => startEdit(t)}
                title="Edit engagement"
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                <Pencil className="h-3 w-3" />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
