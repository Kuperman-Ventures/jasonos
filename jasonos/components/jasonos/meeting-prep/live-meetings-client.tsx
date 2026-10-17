"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/jasonos/brand/page-header";
import type { MeetingPrepSummary } from "@/lib/server-actions/meeting-prep";
import {
  createLiveScript,
  draftLiveScriptItems,
  type LiveScript,
} from "@/lib/server-actions/live-scripts";
import { cn } from "@/lib/utils";

const FIELD =
  "w-full rounded-[2px] border-0 border-b-2 border-[var(--color-neutral-400)] bg-[var(--jos-surface)] px-3.5 text-[16px] text-[var(--jos-ink)] outline-none placeholder:text-[var(--jos-muted)]";

function easternTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

function attendeeLabel(attendee: MeetingPrepSummary["attendees"][number]): string {
  return attendee.name || attendee.email.split("@")[0] || attendee.email;
}

function attendeeLine(attendees: MeetingPrepSummary["attendees"]): string {
  const labels = attendees.map(attendeeLabel);
  if (labels.length <= 3) return labels.join(", ");
  return `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
}

function usedLine(script: LiveScript): string {
  const points = script.itemCount === 1 ? "1 point" : `${script.itemCount} points`;
  const used = script.useCount === 1 ? "used 1 time" : `used ${script.useCount} times`;
  return `${points} · ${used}`;
}

export function LiveMeetingsClient({
  meetings,
  nowIso,
  error,
  warnings,
  scripts,
  scriptsError,
}: {
  meetings: MeetingPrepSummary[];
  nowIso: string;
  error: string | null;
  warnings: string[];
  scripts: LiveScript[];
  scriptsError: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brief, setBrief] = useState("");
  const [saving, setSaving] = useState(false);
  const visible = meetings.filter((row) => {
    const end = Date.parse(row.endsAt);
    const now = Date.parse(nowIso);
    if (Number.isNaN(end) || Number.isNaN(now)) return true;
    return end >= now;
  });
  const withPoints = visible.filter((row) => row.pointCount > 0);
  const withoutPoints = visible.filter((row) => row.pointCount === 0);

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name the script.");
      return;
    }
    setSaving(true);
    void createLiveScript({ name: trimmed, description }).then(async (created) => {
      if (!created.ok) {
        setSaving(false);
        toast.error(created.error);
        return;
      }
      if (brief.trim()) {
        const drafted = await draftLiveScriptItems(created.script.id, brief);
        if (!drafted.ok) toast.error(drafted.error);
      }
      setSaving(false);
      setOpen(false);
      router.push(`/live/scripts/${created.script.id}`);
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader
        title="Live"
        description="Open the call agenda for a meeting today, or build a script to reuse."
      />

      {error ? <p className="text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {warnings.length ? (
        <p className="text-[13px] text-[var(--jos-muted)]">{warnings.join(" · ")}</p>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-[15px] text-[var(--jos-muted)]">
          {meetings.length ? "No meetings left today." : "No meetings with other people today."}
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-calendar-700)]">
              Ready to go live
            </h2>
            {withPoints.length === 0 ? (
              <p className="text-[15px] text-[var(--jos-muted)]">
                None yet. Open a meeting below, draft or add points, then come back here or use Start
                live on the prep page.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--jos-line)] border-t border-b border-[var(--jos-line)]">
                {withPoints.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold tracking-tight">
                        <span className="mr-2 font-medium text-[var(--jos-muted)]">
                          {easternTime(row.startsAt)}
                        </span>
                        {row.title}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-[var(--jos-muted)]">
                        {attendeeLine(row.attendees)}
                        {" · "}
                        {row.pointCount === 1 ? "1 point" : `${row.pointCount} points`}
                      </p>
                    </div>
                    <Link
                      href={`/meetings/${row.id}/live`}
                      className={buttonVariants({ variant: "calendar", size: "sm" })}
                    >
                      Live
                    </Link>
                    <Link
                      href={`/meetings/${row.id}`}
                      className="text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
                    >
                      Prep
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {withoutPoints.length ? (
            <section className="space-y-3">
              <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">
                Needs points first
              </h2>
              <ul className="divide-y divide-[var(--jos-line)] border-t border-b border-[var(--jos-line)]">
                {withoutPoints.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold tracking-tight">
                        <span className="mr-2 font-medium text-[var(--jos-muted)]">
                          {easternTime(row.startsAt)}
                        </span>
                        {row.title}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-[var(--jos-muted)]">
                        {attendeeLine(row.attendees)}
                      </p>
                    </div>
                    <Link
                      href={`/meetings/${row.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Add points
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">
            Scripts
          </h2>
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            New script
          </Button>
        </div>
        {scriptsError ? (
          <p className="text-[14px] text-[var(--color-accent-2-text)]">{scriptsError}</p>
        ) : null}
        {scripts.length === 0 ? (
          <p className="text-[15px] text-[var(--jos-muted)]">
            No scripts yet. A script is a set of points you can apply to any meeting.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--jos-line)] border-t border-b border-[var(--jos-line)]">
            {scripts.map((script) => (
              <li key={script.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold tracking-tight">
                    <Link href={`/live/scripts/${script.id}`} className="hover:underline">
                      {script.name}
                    </Link>
                  </p>
                  {script.description ? (
                    <p className="mt-0.5 line-clamp-2 text-[14px] text-[var(--jos-ink)]">{script.description}</p>
                  ) : null}
                  <p className="mt-0.5 text-[13px] text-[var(--jos-muted)]">{usedLine(script)}</p>
                </div>
                {script.itemCount > 0 ? (
                  <Link
                    href={`/live/scripts/${script.id}/rehearse`}
                    className={buttonVariants({ variant: "calendar", size: "sm" })}
                  >
                    Rehearse
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New script</DialogTitle>
            <DialogDescription>
              A named set of points you can rehearse, then apply to a meeting.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              create();
            }}
          >
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">
                Name <span className="text-[var(--jos-danger)]">*</span>
              </span>
              <input
                required
                value={name}
                maxLength={120}
                className={`${FIELD} h-11`}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">Description</span>
              <textarea
                value={description}
                rows={2}
                className={`${FIELD} py-2`}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">Brief</span>
              <textarea
                value={brief}
                rows={4}
                placeholder="Optional. Draft points from this."
                className={`${FIELD} py-2`}
                onChange={(event) => setBrief(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="calendar" disabled={saving}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
