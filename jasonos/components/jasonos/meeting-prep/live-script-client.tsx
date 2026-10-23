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
import { putSheetOnMeeting } from "@/lib/server-actions/call-sheet";
import {
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
  type ScriptUsedOnMeeting,
} from "@/lib/server-actions/live-scripts";
import { cn } from "@/lib/utils";

function easternDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function PlanFields({ script }: { script: LiveScript }) {
  const router = useRouter();
  const serverKey = `${script.description ?? ""}\u0000${script.outcomeSentence ?? ""}\u0000${script.notes ?? ""}`;
  const [whoFor, setWhoFor] = useState(script.description ?? "");
  const [outcome, setOutcome] = useState(script.outcomeSentence ?? "");
  const [notes, setNotes] = useState(script.notes ?? "");
  const [seen, setSeen] = useState(serverKey);
  if (serverKey !== seen) {
    setSeen(serverKey);
    setWhoFor(script.description ?? "");
    setOutcome(script.outcomeSentence ?? "");
    setNotes(script.notes ?? "");
  }

  const save = (patch: {
    description?: string | null;
    outcomeSentence?: string | null;
    notes?: string | null;
  }) => {
    void updateLiveScript(script.id, patch).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (patch.description !== undefined) setWhoFor(patch.description ?? "");
      if (patch.outcomeSentence !== undefined) setOutcome(patch.outcomeSentence ?? "");
      if (patch.notes !== undefined) setNotes(patch.notes ?? "");
      router.refresh();
    });
  };

  return (
    <div className="mt-5 grid gap-5 min-[900px]:grid-cols-2">
      <label className="block space-y-1">
        <span className={LIVE_SECTION_LABEL}>Who it is for</span>
        <UnfinishedField
          value={whoFor}
          emptyLabel="Add a sentence"
          placeholder="Who this sheet is for"
          inputClassName="text-[17px]"
          onSave={(next) => save({ description: next || null })}
        />
      </label>
      <label className="block space-y-1">
        <span className={LIVE_SECTION_LABEL}>What you want out of it</span>
        <UnfinishedField
          value={outcome}
          emptyLabel="Add a sentence"
          placeholder="What you want out of this meeting"
          inputClassName="text-[17px] font-semibold"
          onSave={(next) => save({ outcomeSentence: next || null })}
        />
      </label>
      <label className="block space-y-1 min-[900px]:col-span-2">
        <span className={LIVE_SECTION_LABEL}>Notes</span>
        <UnfinishedField
          value={notes}
          emptyLabel="Add a sentence"
          placeholder="Anything else to keep with this sheet"
          inputClassName="text-[17px]"
          onSave={(next) => save({ notes: next || null })}
        />
      </label>
    </div>
  );
}

export function StrategyFields({ script }: { script: LiveScript }) {
  const router = useRouter();
  const serverKey = `${script.description ?? ""}\u0000${script.situation ?? ""}\u0000${script.successSentence ?? ""}\u0000${script.rubric.join("\n")}\u0000${script.methodologySource ?? ""}`;
  const [description, setDescription] = useState(script.description ?? "");
  const [situation, setSituation] = useState(script.situation ?? "");
  const [success, setSuccess] = useState(script.successSentence ?? "");
  const [rubric, setRubric] = useState(script.rubric);
  const [basedOn, setBasedOn] = useState(script.methodologySource ?? "");
  const [seen, setSeen] = useState(serverKey);
  if (serverKey !== seen) {
    setSeen(serverKey);
    setDescription(script.description ?? "");
    setSituation(script.situation ?? "");
    setSuccess(script.successSentence ?? "");
    setRubric(script.rubric);
    setBasedOn(script.methodologySource ?? "");
  }

  const save = (patch: {
    description?: string | null;
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
      if (patch.description !== undefined) setDescription(patch.description ?? "");
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
      <label className="block space-y-1 min-[900px]:col-span-2">
        <span className={LIVE_SECTION_LABEL}>Description</span>
        <UnfinishedField
          value={description}
          emptyLabel="Add a sentence"
          placeholder="What this playbook covers"
          inputClassName="text-[17px]"
          onSave={(next) => save({ description: next || null })}
        />
      </label>
      <label className="block space-y-1">
        <span className={LIVE_SECTION_LABEL}>Situation</span>
        <UnfinishedField
          value={situation}
          emptyLabel="Add a sentence"
          placeholder="When this playbook fits"
          inputClassName="text-[17px]"
          onSave={(next) => save({ situation: next || null })}
        />
      </label>
      <label className="block space-y-1">
        <span className={LIVE_SECTION_LABEL}>What success looks like</span>
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
          placeholder="Where this playbook came from"
          inputClassName="text-[17px]"
          onSave={(next) => save({ methodologySource: next || null })}
        />
      </label>
    </div>
  );
}

export function LiveScriptClient({
  script,
  items,
  meetings,
  usedOn = [],
}: {
  script: LiveScript;
  items: LiveScriptItem[];
  meetings: MeetingPrepSummary[];
  usedOn?: ScriptUsedOnMeeting[];
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
  const [useOpen, setUseOpen] = useState(false);
  const [prepId, setPrepId] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [applying, setApplying] = useState(false);
  const isPlan = script.kind === "plan";

  const markable = items.some((item) => item.kind !== "agenda");
  const selected = meetings.find((meeting) => meeting.id === prepId) ?? null;

  const saveName = (next: string) => {
    const name = next.trim();
    if (!name) {
      toast.error(isPlan ? "Name the sheet." : "Name the playbook.");
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

  const runAttach = () => {
    if (!prepId) return;
    setApplying(true);
    void putSheetOnMeeting({ sheetId: script.id, prepId }).then((result) => {
      setApplying(false);
      setConfirmReplace(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUseOpen(false);
      router.push(`/meetings/${prepId}`);
      router.refresh();
    });
  };

  const requestAttach = () => {
    if (!prepId) return;
    if (selected && selected.pointCount > 0) {
      setConfirmReplace(true);
      return;
    }
    runAttach();
  };

  const usedLabel =
    script.useCount === 1 ? "USED 1 TIME" : `USED ${script.useCount} TIMES`;

  return (
    <div className="flex min-h-[calc(100vh-var(--jos-nav-h))] flex-col">
      <header className="shrink-0 border-b border-[var(--jos-ink)] px-10 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={cn(LIVE_SECTION_LABEL, "text-[var(--color-accent-700)]")}>
              {isPlan ? "Sheet" : `Playbook · ${usedLabel}`}
            </p>
            <InlineField
              value={script.name}
              placeholder={isPlan ? "Sheet name" : "Playbook name"}
              emptyLabel={isPlan ? "Sheet name" : "Playbook name"}
              maxLength={120}
              className="mt-1 text-[36px] font-extrabold tracking-tight text-[var(--jos-ink)]"
              onSave={saveName}
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
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
            {isPlan ? (
              <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPrepId(meetings[0]?.id ?? "");
                    setConfirmReplace(false);
                    setUseOpen(true);
                  }}
                >
                  Use for a meeting
                </Button>
            ) : null}
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
        {isPlan ? <PlanFields script={script} /> : <StrategyFields script={script} />}
        {!isPlan ? (
          <div className="mt-5">
            <p className={LIVE_SECTION_LABEL}>Used on</p>
            {usedOn.length === 0 ? (
              <p className="mt-1 text-[14px] text-[var(--jos-muted)]">Not used on a meeting yet.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {usedOn.map((meeting) => (
                  <li key={meeting.id}>
                    <Link
                      href={`/meetings/${meeting.id}`}
                      className="text-[15px] font-semibold text-[var(--jos-ink)] hover:underline"
                    >
                      {meeting.title}
                      <span className="font-normal text-[var(--jos-muted)]">
                        {", "}
                        {easternDate(meeting.startsAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
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
            label: "Generate points",
            run: () =>
              new Promise((resolve) => {
                draftDone.current = resolve;
                setBrief("");
                setBriefOpen(true);
              }),
          }}
        />
      </div>

      <Dialog
        open={useOpen}
        onOpenChange={(next) => {
          setUseOpen(next);
          if (!next) {
            setConfirmReplace(false);
            setPrepId("");
          }
        }}
      >
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Use for a meeting</DialogTitle>
            <DialogDescription>Meetings in the next 14 days.</DialogDescription>
          </DialogHeader>
          {meetings.length === 0 ? (
            <p className="text-[14px] text-[var(--jos-muted)]">No meetings in the next 14 days.</p>
          ) : (
            <div className="space-y-4">
              <select
                aria-label="Meeting"
                value={prepId}
                className={cn(LIVE_FIELD, "h-11")}
                onChange={(event) => {
                  setPrepId(event.target.value);
                  setConfirmReplace(false);
                }}
              >
                {meetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meetingLabel(meeting)}
                  </option>
                ))}
              </select>
              {confirmReplace && selected ? (
                <p className="text-[14px]">
                  Replace {selected.pointCount} existing points?{" "}
                  <button
                    type="button"
                    className="font-semibold text-[var(--color-accent-700)] hover:underline"
                    disabled={applying}
                    onClick={runAttach}
                  >
                    Confirm
                  </button>
                  {" · "}
                  <button
                    type="button"
                    className="font-semibold hover:underline"
                    onClick={() => setConfirmReplace(false)}
                  >
                    Cancel
                  </button>
                </p>
              ) : (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setUseOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    disabled={!prepId || applying}
                    onClick={requestAttach}
                  >
                    Use for this meeting
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
            <DialogTitle>Generate points</DialogTitle>
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
                Generate
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
