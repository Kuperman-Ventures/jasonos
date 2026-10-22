"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarBlank,
  ChartBar,
  CheckCircle,
  CircleDashed,
  ClipboardText,
  ListChecks,
  Play,
  WarningCircle,
} from "@phosphor-icons/react";
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
import { LIVE_FIELD, LIVE_SECTION_LABEL } from "@/components/jasonos/live";
import { updateLiveSettings, type LiveSettings } from "@/lib/server-actions/live-settings";
import type { MeetingPrepSummary, OutcomeMark, RecentLiveMeeting } from "@/lib/server-actions/meeting-prep";
import {
  createLiveScript,
  draftLiveScriptItems,
  type LiveScript,
} from "@/lib/server-actions/live-scripts";
import { cn } from "@/lib/utils";

function easternTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

function easternDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });
}

function relativeLabel(startsAt: string, endsAt: string, nowIso: string): string {
  const now = Date.parse(nowIso);
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (Number.isNaN(now) || Number.isNaN(start) || Number.isNaN(end)) return "";
  if (end < now) return "Done";
  if (now >= start && now <= end) return "Now";
  const mins = Math.round((start - now) / 60000);
  if (mins < 1) return "Starts now";
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 18) return hours === 1 ? "in 1 hr" : `in ${hours} hr`;
  return "";
}

function personLabel(meeting: MeetingPrepSummary): string {
  if (meeting.primaryContactName?.trim()) return meeting.primaryContactName.trim();
  const first = meeting.attendees.find((row) => row.name?.trim()) ?? meeting.attendees[0];
  if (!first) return meeting.title;
  return first.name?.trim() || first.email.split("@")[0] || first.email;
}

type CardAction = "go_live" | "prepare" | "review";

function cardAction(meeting: MeetingPrepSummary, nowIso: string): CardAction {
  const ended =
    Boolean(meeting.liveEndedAt) ||
    (!Number.isNaN(Date.parse(meeting.endsAt)) && Date.parse(meeting.endsAt) < Date.parse(nowIso));
  if (ended) return "review";
  if (meeting.pointCount <= 0) return "prepare";
  return "go_live";
}

function OutcomePill({ mark }: { mark: OutcomeMark | null }) {
  const base =
    "inline-flex h-7 w-[84px] items-center justify-center text-[12px] font-bold uppercase tracking-[0.08em]";
  if (!mark) {
    return (
      <span className={base} style={{ backgroundColor: "#d8d6d6", color: "var(--jos-muted)" }}>
        Unmarked
      </span>
    );
  }
  if (mark === "hit") {
    return (
      <span className={base} style={{ backgroundColor: "var(--color-done)", color: "#fff" }}>
        Hit
      </span>
    );
  }
  if (mark === "partial") {
    return (
      <span className={base} style={{ backgroundColor: "var(--color-process-yellow)", color: "var(--jos-ink)" }}>
        Partial
      </span>
    );
  }
  return (
    <span className={base} style={{ backgroundColor: "var(--color-accent-2)", color: "#fff" }}>
      Missed
    </span>
  );
}

function AboutMe({ settings, error }: { settings: LiveSettings; error: string | null }) {
  const router = useRouter();
  const storedSnapshot = settings.snapshot ?? "";
  const storedCompanies = settings.targetCompanies.join("\n");
  const [snapshot, setSnapshot] = useState(storedSnapshot);
  const [companies, setCompanies] = useState(storedCompanies);
  const [seenSnapshot, setSeenSnapshot] = useState(storedSnapshot);
  const [seenCompanies, setSeenCompanies] = useState(storedCompanies);

  if (storedSnapshot !== seenSnapshot) {
    setSeenSnapshot(storedSnapshot);
    setSnapshot(storedSnapshot);
  }
  if (storedCompanies !== seenCompanies) {
    setSeenCompanies(storedCompanies);
    setCompanies(storedCompanies);
  }

  const saveSnapshot = () => {
    if (snapshot.trim() === storedSnapshot.trim()) return;
    void updateLiveSettings({ snapshot }).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const saveCompanies = () => {
    const next = companies
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (next.join("\n") === storedCompanies) return;
    void updateLiveSettings({ targetCompanies: next }).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <aside className="w-full shrink-0 border-[var(--jos-line)] min-[1100px]:w-[340px] min-[1100px]:border-l min-[1100px]:pl-8">
      <h2 className="text-[20px] font-extrabold tracking-tight">About me</h2>
      {error ? <p className="mt-2 text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      <label className="mt-5 block space-y-1">
        <span className={LIVE_SECTION_LABEL}>60-second snapshot</span>
        <textarea
          value={snapshot}
          rows={5}
          maxLength={2000}
          placeholder="The snapshot you give once on a first call"
          className={cn(LIVE_FIELD, "mt-1 py-2 text-[15px]")}
          onChange={(event) => setSnapshot(event.target.value)}
          onBlur={saveSnapshot}
        />
      </label>
      <label className="mt-5 block space-y-1">
        <span className={LIVE_SECTION_LABEL}>Target companies</span>
        <textarea
          value={companies}
          rows={5}
          placeholder="One company per line"
          className={cn(LIVE_FIELD, "mt-1 py-2 text-[15px]")}
          onChange={(event) => setCompanies(event.target.value)}
          onBlur={saveCompanies}
        />
      </label>
      <p className="mt-3 text-[13px] text-[var(--jos-muted)]">
        Used by Adapt and the call screen.
      </p>
    </aside>
  );
}

function TodayCard({
  meeting,
  nowIso,
}: {
  meeting: MeetingPrepSummary;
  nowIso: string;
}) {
  const action = cardAction(meeting, nowIso);
  const strategy = meeting.scriptName?.trim() || "No strategy";
  const browning = meeting.planSource === "browning_auto";
  const strategyLabel = browning ? `${strategy} · Browning` : strategy;
  const person = personLabel(meeting);
  const company = meeting.primaryCompanyName?.trim() || null;
  const relative = relativeLabel(meeting.startsAt, meeting.endsAt, nowIso);

  let topBar = "#d8d6d6";
  if (action === "go_live") topBar = "var(--color-accent-700)";
  if (action === "review") topBar = "var(--color-done)";

  let StateIcon = CircleDashed;
  let stateColor = "var(--jos-muted)";
  let stateLine = strategyLabel;
  if (action === "prepare") {
    StateIcon = WarningCircle;
    stateColor = "var(--color-accent-2)";
    stateLine = `${strategyLabel} · needs points first`;
  } else if (action === "go_live") {
    StateIcon = CheckCircle;
    stateColor = "#006925";
    stateLine = strategyLabel;
  } else if (!meeting.outcomeMark) {
    StateIcon = CircleDashed;
    stateColor = "var(--jos-muted)";
    stateLine = strategyLabel;
  } else {
    StateIcon = CheckCircle;
    stateColor = "#006925";
    stateLine = strategyLabel;
  }

  return (
    <article className="bg-[var(--jos-surface)]" style={{ borderTop: `4px solid ${topBar}` }}>
      <div className="px-4 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[24px] font-extrabold tabular-nums tracking-tight">
            {easternTime(meeting.startsAt)}
          </p>
          {relative ? <p className="text-[14px] text-[var(--jos-muted)]">{relative}</p> : null}
        </div>
        <p className="mt-2 text-[18px] font-bold leading-snug">{person}</p>
        {company ? <p className="text-[14px] text-[var(--jos-muted)]">{company}</p> : null}
        {meeting.researchUnverified ? (
          <p className="mt-1 text-[12px] font-semibold text-[var(--color-accent-2-text)]">
            Research unverified
          </p>
        ) : null}
        <p className="mt-2 flex items-start gap-1.5 text-[14px] leading-snug text-[var(--jos-muted)]">
          <StateIcon size={16} weight="duotone" className="mt-0.5 shrink-0" style={{ color: stateColor }} aria-hidden />
          <span>{stateLine}</span>
        </p>
        <div className="mt-4">
          {action === "go_live" ? (
            <Link
              href={`/meetings/${meeting.id}/live`}
              className={cn(buttonVariants({ variant: "default" }), "h-9 gap-1.5 px-3")}
            >
              <Play size={16} weight="fill" aria-hidden />
              Go live
            </Link>
          ) : null}
          {action === "prepare" ? (
            <Link
              href={`/meetings/${meeting.id}`}
              className={cn(buttonVariants({ variant: "secondary" }), "h-9 gap-1.5 px-3")}
            >
              <ListChecks size={16} weight="duotone" aria-hidden />
              Prepare
            </Link>
          ) : null}
          {action === "review" ? (
            <Link
              href={`/meetings/${meeting.id}`}
              className={cn(buttonVariants({ variant: "secondary" }), "h-9 gap-1.5 px-3")}
            >
              <ClipboardText size={16} weight="duotone" aria-hidden />
              Review
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function LiveMeetingsClient({
  meetings,
  nowIso,
  error,
  warnings,
  scripts,
  scriptsError,
  recent,
  recentError,
  settings,
  settingsError,
}: {
  meetings: MeetingPrepSummary[];
  nowIso: string;
  error: string | null;
  warnings: string[];
  scripts: LiveScript[];
  scriptsError: string | null;
  recent: RecentLiveMeeting[];
  recentError: string | null;
  settings: LiveSettings;
  settingsError: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brief, setBrief] = useState("");
  const [saving, setSaving] = useState(false);

  const today = [...meetings].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)
  );
  const recentRows = recent.slice(0, 6);

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name the strategy.");
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
    <div className="px-10 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={cn(LIVE_SECTION_LABEL, "text-[var(--color-accent-700)]")}>Custom comms</p>
          <h1 className="mt-1 text-[44px] font-extrabold leading-none tracking-[-0.02em]">Live</h1>
        </div>
        <Link
          href="/live/metrics"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
        >
          <ChartBar size={16} weight="duotone" aria-hidden />
          Metrics
        </Link>
      </header>

      {error ? <p className="mt-4 text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {warnings.length ? (
        <p className="mt-2 text-[13px] text-[var(--jos-muted)]">{warnings.join(" · ")}</p>
      ) : null}

      <section className="mt-8">
        <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-calendar-700)]">
          <CalendarBlank size={14} weight="duotone" className="text-[var(--color-calendar)]" aria-hidden />
          Today · {today.length} {today.length === 1 ? "call" : "calls"}
        </p>
        {today.length === 0 ? (
          <p className="mt-4 text-[16px] text-[var(--jos-muted)]">No calls today.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 min-[900px]:grid-cols-2 min-[1280px]:grid-cols-3">
            {today.map((meeting) => (
              <TodayCard key={meeting.id} meeting={meeting} nowIso={nowIso} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-14 flex flex-col gap-10 min-[1100px]:flex-row">
        <div className="min-w-0 flex-1 space-y-12">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[24px] font-extrabold tracking-tight">Strategies</h2>
              <Button type="button" className="h-9 px-3" onClick={() => setOpen(true)}>
                New strategy
              </Button>
            </div>
            {scriptsError ? (
              <p className="mt-3 text-[14px] text-[var(--color-accent-2-text)]">{scriptsError}</p>
            ) : null}
            {scripts.length === 0 ? (
              <p className="mt-3 text-[15px] text-[var(--jos-muted)]">No strategies yet.</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-0 min-[900px]:grid-cols-2">
                {scripts.map((script) => (
                  <div
                    key={script.id}
                    className="flex items-center gap-3 border-t border-[var(--jos-line)] py-3 first:border-t-0 min-[900px]:[&:nth-child(-n+2)]:border-t-0"
                  >
                    <Link href={`/live/scripts/${script.id}`} className="min-w-0 flex-1 hover:underline">
                      <p className="truncate text-[16px] font-bold">{script.name}</p>
                      <p className="mt-0.5 truncate text-[14px] text-[var(--jos-muted)]">
                        {script.successSentence?.trim() || script.description?.trim() || "No success sentence"}
                      </p>
                      <p className="mt-0.5 text-[13px] tabular-nums text-[var(--jos-muted)]">
                        {script.itemCount} points · used {script.useCount}
                      </p>
                    </Link>
                    {script.itemCount > 0 ? (
                      <Link
                        href={`/live/scripts/${script.id}/rehearse`}
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-8 shrink-0")}
                      >
                        Rehearse
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[24px] font-extrabold tracking-tight">Recent</h2>
              <Link
                href="/live/library"
                className="text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
              >
                All meetings
              </Link>
            </div>
            {recentError ? (
              <p className="mt-3 text-[14px] text-[var(--color-accent-2-text)]">{recentError}</p>
            ) : null}
            {recentRows.length === 0 ? (
              <p className="mt-3 text-[15px] text-[var(--jos-muted)]">No finished live meetings yet.</p>
            ) : (
              <ul className="mt-3">
                {recentRows.map((row) => {
                  const needsReview = !row.reviewed || !row.outcomeMark;
                  return (
                    <li key={row.id} className="border-t border-[var(--jos-line)] first:border-t-0">
                      <Link
                        href={`/meetings/${row.id}`}
                        className="flex flex-wrap items-center gap-3 py-3"
                      >
                        <span className="w-14 shrink-0 text-[14px] tabular-nums text-[var(--jos-muted)]">
                          {easternDate(row.startsAt)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">
                          {row.attendeeName || row.title}
                          {row.strategyName ? (
                            <span className="font-normal text-[var(--jos-muted)]">
                              {" · "}
                              {row.strategyName}
                            </span>
                          ) : null}
                        </span>
                        {needsReview ? (
                          <span className="text-[13px] text-[var(--jos-muted)]">Needs review</span>
                        ) : null}
                        <OutcomePill mark={row.outcomeMark} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <AboutMe settings={settings} error={settingsError} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New strategy</DialogTitle>
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
                className={cn(LIVE_FIELD, "h-11")}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">Description</span>
              <textarea
                value={description}
                rows={2}
                className={cn(LIVE_FIELD, "py-2")}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">Brief</span>
              <textarea
                value={brief}
                rows={4}
                placeholder="Optional. Draft points from this."
                className={cn(LIVE_FIELD, "py-2")}
                onChange={(event) => setBrief(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={saving}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
