"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InlineField, PointsEditor } from "@/components/jasonos/meeting-prep/points-editor";
import {
  LIVE_FIELD,
  LIVE_FIELD_UNFINISHED,
  LIVE_SECTION_LABEL,
  UnfinishedField,
} from "@/components/jasonos/live";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PointResult } from "@/lib/server-actions/meeting-points";
import type { MeetingPrepSummary } from "@/lib/server-actions/meeting-prep";
import {
  applyLiveScript,
  proposeAdaptation,
  createLiveScriptItem,
  deleteLiveScript,
  deleteLiveScriptItem,
  draftLiveScriptItems,
  reorderLiveScriptItems,
  updateLiveScript,
  draftScriptItemReactions,
  updateLiveScriptItem,
  type LiveScript,
  type LiveScriptItem,
} from "@/lib/server-actions/live-scripts";
import { cn } from "@/lib/utils";

function StrategyFields({ script }: { script: LiveScript }) {
  const router = useRouter();
  const serverKey = `${script.situation ?? ""}\u0000${script.successSentence ?? ""}\u0000${script.rubric.join("\n")}\u0000${script.methodologySource ?? ""}`;
  const [situation, setSituation] = useState(script.situation ?? "");
  const [success, setSuccess] = useState(script.successSentence ?? "");
  const [rubric, setRubric] = useState(script.rubric);
  const [basedOn, setBasedOn] = useState(script.methodologySource ?? "");
  const [seen, setSeen] = useState(serverKey);
  if (serverKey !== seen) {
    setSeen(serverKey);
    setSituation(script.situation ?? "");
    setSuccess(script.successSentence ?? "");
    setRubric(script.rubric);
    setBasedOn(script.methodologySource ?? "");
  }

  const save = (patch: {
    situation?: string | null;
    successSentence?: string | null;
    rubric?: string[];
    methodologySource?: string | null;
  }) => {
    void updateLiveScript(script.id, patch).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (patch.situation !== undefined) setSituation(patch.situation ?? "");
      if (patch.successSentence !== undefined) setSuccess(patch.successSentence ?? "");
      if (patch.rubric !== undefined) setRubric(patch.rubric);
      if (patch.methodologySource !== undefined) setBasedOn(patch.methodologySource ?? "");
      router.refresh();
    });
  };

  const [editingChecklist, setEditingChecklist] = useState(false);
  const [checklistText, setChecklistText] = useState(rubric.join("\n"));
  const rubricKey = rubric.join("\n");
  const [seenRubric, setSeenRubric] = useState(rubricKey);
  if (rubricKey !== seenRubric) {
    setSeenRubric(rubricKey);
    setChecklistText(rubricKey);
  }

  return (
    <div className="mt-5 grid gap-5 min-[900px]:grid-cols-2">
      <label className="block space-y-1">
        <span className={LIVE_SECTION_LABEL}>Situation</span>
        <UnfinishedField
          value={situation}
          emptyLabel="Add a sentence"
          placeholder="When this strategy applies"
          inputClassName="text-[17px]"
          onSave={(next) => save({ situation: next || null })}
        />
      </label>
      <label className="block space-y-1">
        <span className={LIVE_SECTION_LABEL}>Success looks like</span>
        <UnfinishedField
          value={success}
          emptyLabel="Add a sentence"
          placeholder="One sentence you can score the meeting against"
          inputClassName="text-[17px] font-semibold"
          onSave={(next) => save({ successSentence: next || null })}
        />
      </label>
      <label className="block space-y-1">
        <span className={LIVE_SECTION_LABEL}>Checklist</span>
        {editingChecklist ? (
          <textarea
            autoFocus
            value={checklistText}
            rows={Math.min(8, Math.max(3, checklistText.split("\n").filter(Boolean).length || 3))}
            placeholder="One item per line"
            aria-label="Checklist"
            className={cn(LIVE_FIELD, !rubric.length && LIVE_FIELD_UNFINISHED, "min-h-24 py-2 text-[16px]")}
            onChange={(event) => setChecklistText(event.target.value)}
            onBlur={() => {
              setEditingChecklist(false);
              const next = checklistText
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 12);
              if (next.join("\n") === rubricKey) return;
              save({ rubric: next });
            }}
          />
        ) : rubric.length === 0 ? (
          <button
            type="button"
            className={cn(LIVE_FIELD, LIVE_FIELD_UNFINISHED, "min-h-11 text-left text-[17px] font-medium text-[var(--color-accent-2-text)]")}
            onClick={() => setEditingChecklist(true)}
          >
            Add a sentence
          </button>
        ) : (
          <button
            type="button"
            className="block w-full text-left text-[17px] font-medium leading-snug text-[var(--jos-ink)]"
            onClick={() => setEditingChecklist(true)}
          >
            {rubric.join(" · ")}
          </button>
        )}
      </label>
      <label className="block space-y-1">
        <span className={LIVE_SECTION_LABEL}>Based on</span>
        <UnfinishedField
          value={basedOn}
          emptyLabel="Add a sentence"
          placeholder="Where this strategy came from"
          inputClassName="text-[17px]"
          onSave={(next) => save({ methodologySource: next || null })}
        />
      </label>
    </div>
  );
}

function meetingLabel(meeting: MeetingPrepSummary): string {
  const when = new Date(meeting.startsAt).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const person = meeting.primaryContactName?.trim() || meeting.title;
  return `${person} · ${when}`;
}

export function LiveScriptClient({
  script,
  items,
  meetings,
}: {
  script: LiveScript;
  items: LiveScriptItem[];
  meetings: MeetingPrepSummary[];
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [drafting, setDrafting] = useState(false);
  const draftDone = useRef<((result: PointResult<{ added: number; quiet?: boolean }>) => void) | null>(
    null
  );
  const [prepId, setPrepId] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [applying, setApplying] = useState(false);

  const markable = items.some((item) => item.kind !== "agenda");
  const selected = meetings.find((meeting) => meeting.id === prepId) ?? null;
  const adaptName =
    selected?.primaryContactName?.trim().split(/\s+/)[0] ||
    selected?.title.split(/[:·-]/)[0]?.trim() ||
    "them";

  const saveName = (next: string) => {
    const name = next.trim();
    if (!name) {
      toast.error("Name the strategy.");
      return;
    }
    void updateLiveScript(script.id, { name }).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const remove = () => {
    setDeleting(true);
    void deleteLiveScript(script.id).then((result) => {
      setDeleting(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push("/live");
      router.refresh();
    });
  };

  const closeBrief = (result: PointResult<{ added: number; quiet?: boolean }>) => {
    setBriefOpen(false);
    setBrief("");
    setDrafting(false);
    draftDone.current?.(result);
    draftDone.current = null;
  };

  const adapt = () => {
    if (!prepId) return;
    setApplying(true);
    void proposeAdaptation({ scriptId: script.id, prepId }).then((result) => {
      setApplying(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/meetings/${prepId}?adapt=${script.id}`);
    });
  };

  const apply = (mode: "add" | "replace") => {
    if (!prepId) return;
    setApplying(true);
    void applyLiveScript({ scriptId: script.id, prepId, mode }).then((result) => {
      setApplying(false);
      setConfirmReplace(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const count = result.added === 1 ? "1 point" : `${result.added} points`;
      toast.success(
        <span>
          Added {count}.{" "}
          <a className="underline" href={`/meetings/${prepId}`}>
            Open the meeting
          </a>
        </span>
      );
      router.refresh();
    });
  };

  const usedLabel =
    script.useCount === 1 ? "USED 1 TIME" : `USED ${script.useCount} TIMES`;

  return (
    <div className="flex min-h-[calc(100vh-var(--jos-nav-h))] flex-col">
      <header className="shrink-0 border-b border-[var(--jos-ink)] px-10 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={cn(LIVE_SECTION_LABEL, "text-[var(--color-accent-700)]")}>
              Strategy · {usedLabel}
            </p>
            <InlineField
              value={script.name}
              placeholder="Strategy name"
              emptyLabel="Strategy name"
              maxLength={120}
              className="mt-1 text-[36px] font-extrabold tracking-tight text-[var(--jos-ink)]"
              onSave={saveName}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {markable ? (
              <Link
                href={`/live/scripts/${script.id}/rehearse`}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Rehearse
              </Link>
            ) : (
              <button type="button" disabled className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Rehearse
              </button>
            )}
            {confirmDelete ? (
              <p className="text-[13px]">
                Delete?{" "}
                <button
                  type="button"
                  className="font-semibold text-[var(--color-accent-2-text)] hover:underline"
                  disabled={deleting}
                  onClick={remove}
                >
                  Confirm
                </button>
                {" · "}
                <button type="button" className="font-semibold hover:underline" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </p>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>
        <StrategyFields script={script} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <PointsEditor
          layout="split"
          points={items}
          detailBox
          actions={{
            create: async (input) => {
              const result = await createLiveScriptItem({ scriptId: script.id, ...input });
              if (!result.ok) return result;
              return { ok: true, id: result.item.id };
            },
            update: (id, patch) => updateLiveScriptItem(id, patch),
            draftReactions: (id) => draftScriptItemReactions(id),
            remove: (id) => deleteLiveScriptItem(id),
            reorder: (ids) => reorderLiveScriptItems(script.id, ids),
          }}
          draft={{
            label: "Draft points",
            run: () =>
              new Promise((resolve) => {
                draftDone.current = resolve;
                setBrief("");
                setBriefOpen(true);
              }),
          }}
        />
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t-2 border-[var(--jos-ink)] bg-[var(--jos-surface)] px-10 py-3">
        <p className={LIVE_SECTION_LABEL}>Apply to a meeting</p>
        {meetings.length === 0 ? (
          <p className="text-[14px] text-[var(--jos-muted)]">No meetings today or tomorrow.</p>
        ) : (
          <>
            <select
              aria-label="Meeting"
              value={prepId}
              className="h-9 min-w-[14rem] border-0 border-b-2 border-[#b5b2b2] bg-transparent text-[14px] font-semibold outline-none"
              onChange={(event) => {
                setPrepId(event.target.value);
                setConfirmReplace(false);
              }}
            >
              <option value="">Choose a meeting</option>
              {meetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meetingLabel(meeting)}
                </option>
              ))}
            </select>
            {confirmReplace && selected ? (
              <span className="text-[13px]">
                Replace {selected.pointCount} existing points?{" "}
                <button
                  type="button"
                  className="font-semibold text-[var(--color-accent-700)] hover:underline"
                  disabled={applying}
                  onClick={() => apply("replace")}
                >
                  Confirm
                </button>
                {" · "}
                <button type="button" className="font-semibold hover:underline" onClick={() => setConfirmReplace(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!prepId || applying}
                  onClick={() => apply("add")}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!prepId || applying}
                  onClick={() => setConfirmReplace(true)}
                >
                  Replace
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  disabled={!prepId || applying}
                  onClick={adapt}
                >
                  Adapt to {adaptName}
                </Button>
              </>
            )}
          </>
        )}
      </div>

      <Dialog
        open={briefOpen}
        onOpenChange={(next) => {
          if (next) {
            setBriefOpen(true);
            return;
          }
          if (drafting) return;
          closeBrief({ ok: true, added: 0, quiet: true });
        }}
      >
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Draft points</DialogTitle>
            <DialogDescription>Describe the call. Existing headlines stay put.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!brief.trim()) {
                toast.error("Write a brief first.");
                return;
              }
              setDrafting(true);
              void draftLiveScriptItems(script.id, brief).then((result) => {
                closeBrief(result);
              });
            }}
          >
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">Brief</span>
              <textarea
                required
                value={brief}
                rows={5}
                className={cn(LIVE_FIELD, "py-2")}
                onChange={(event) => setBrief(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => closeBrief({ ok: true, added: 0, quiet: true })}
              >
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={drafting}>
                Draft
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
