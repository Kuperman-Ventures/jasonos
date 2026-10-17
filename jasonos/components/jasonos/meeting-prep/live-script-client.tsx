"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { InlineField, PointsEditor } from "@/components/jasonos/meeting-prep/points-editor";
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
  createLiveScriptItem,
  deleteLiveScript,
  deleteLiveScriptItem,
  draftLiveScriptItems,
  reorderLiveScriptItems,
  updateLiveScript,
  updateLiveScriptItem,
  type LiveScript,
  type LiveScriptItem,
} from "@/lib/server-actions/live-scripts";

const FIELD =
  "w-full rounded-[2px] border-0 border-b-2 border-[var(--color-neutral-400)] bg-[var(--jos-surface)] px-3.5 text-[16px] text-[var(--jos-ink)] outline-none placeholder:text-[var(--jos-muted)]";

function meetingLabel(meeting: MeetingPrepSummary): string {
  const when = new Date(meeting.startsAt).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${when} · ${meeting.title}`;
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

  const saveName = (next: string) => {
    const name = next.trim();
    if (!name) {
      toast.error("Name the script.");
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

  const saveDescription = (next: string) => {
    void updateLiveScript(script.id, { description: next }).then((result) => {
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

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <Link
        href="/live"
        className="inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
      >
        <ChevronLeft className="size-4" />
        Live
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <InlineField
            value={script.name}
            placeholder="Script name"
            emptyLabel="Script name"
            maxLength={120}
            className="text-[28px] font-extrabold tracking-tight text-[var(--jos-ink)]"
            onSave={saveName}
          />
          {confirmDelete ? (
            <p className="text-[13px]">
              Delete this script?{" "}
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
              Delete script
            </Button>
          )}
        </div>
        <InlineField
          value={script.description ?? ""}
          placeholder="Description"
          emptyLabel="Add a description"
          maxLength={400}
          className="text-[15px] text-[var(--jos-muted)]"
          onSave={saveDescription}
        />
      </header>

      <PointsEditor
        points={items}
        actions={{
          create: async (input) => {
            const result = await createLiveScriptItem({ scriptId: script.id, ...input });
            if (!result.ok) return result;
            return { ok: true, id: result.item.id };
          },
          update: (id, patch) => updateLiveScriptItem(id, patch),
          remove: (id) => deleteLiveScriptItem(id),
          reorder: (ids) => reorderLiveScriptItems(script.id, ids),
        }}
        detailBox
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

      <p className="text-[13px] text-[var(--jos-muted)]">
        Placeholders {"{{name}}"}, {"{{company}}"} and {"{{title}}"} are filled in when you apply this
        script to a meeting.
      </p>

      {markable ? (
        <Link
          href={`/live/scripts/${script.id}/rehearse`}
          className={buttonVariants({ variant: "calendar" })}
        >
          Rehearse
        </Link>
      ) : (
        <button type="button" disabled className={buttonVariants({ variant: "calendar" })}>
          Add at least one point
        </button>
      )}

      <section className="space-y-3">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">
          Apply to a meeting
        </h2>
        {meetings.length === 0 ? (
          <p className="text-[15px] text-[var(--jos-muted)]">No meetings today or tomorrow.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="apply-meeting">
              Meeting
            </label>
            <select
              id="apply-meeting"
              aria-label="Meeting"
              value={prepId}
              className="h-8 max-w-full bg-transparent text-[14px] font-semibold outline-none"
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
            {prepId && selected ? (
              confirmReplace ? (
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
                  <button
                    type="button"
                    className="font-semibold hover:underline"
                    onClick={() => setConfirmReplace(false)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <>
                  <Button type="button" size="sm" variant="outline" disabled={applying} onClick={() => apply("add")}>
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={applying}
                    onClick={() => setConfirmReplace(true)}
                  >
                    Replace
                  </Button>
                </>
              )
            ) : null}
          </div>
        )}
      </section>

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
                className={`${FIELD} py-2`}
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
              <Button type="submit" variant="calendar" disabled={drafting}>
                Draft
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
