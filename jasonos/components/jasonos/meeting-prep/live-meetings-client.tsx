"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarBlank, CaretDown, Play } from "@phosphor-icons/react";
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
import { MeetingTitleField } from "@/components/jasonos/meeting-prep/live-rename-field";
import { updateLiveSettings, type LiveSettings } from "@/lib/server-actions/live-settings";
import type { MeetingPrepSummary, OutcomeMark, RecentLiveMeeting } from "@/lib/server-actions/meeting-prep";
import {
  attachPlanToMeeting,
  createLiveScript,
  promotePlanToStrategy,
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
  if (meeting.primaryCompanyName?.trim()) return meeting.primaryCompanyName.trim();
  const named = meeting.attendees.find((row) => {
    const name = row.name?.trim();
    if (!name || name.includes("@")) return false;
    const local = row.email.split("@")[0]?.toLowerCase() ?? "";
    if (local && name.toLowerCase() === local) return false;
    if (/^[a-z0-9._+-]+$/i.test(name) && name.includes(".") && !/\s/.test(name)) return false;
    return true;
  });
  if (named?.name?.trim()) return named.name.trim();
  return meeting.title;
}

/** Plan exists when there is at least one point or plan_built_at is set. */
function hasPlan(meeting: MeetingPrepSummary): boolean {
  return Boolean(meeting.planBuiltAt) || meeting.pointCount > 0;
}

function planSourceLabel(meeting: MeetingPrepSummary): string | null {
  const raw = meeting.scriptName?.trim();
  if (!raw) return null;
  const fromGuide = raw.match(/^From plan:\s*(.+)$/i);
  if (fromGuide?.[1]) return fromGuide[1].trim();
  return raw;
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

  const companyCount = settings.targetCompanies.length;
  const summaryParts: string[] = [];
  if (storedSnapshot.trim()) summaryParts.push("Snapshot set");
  else summaryParts.push("No snapshot");
  summaryParts.push(
    companyCount === 1 ? "1 target company" : `${companyCount} target companies`
  );
  const summary = summaryParts.join(" · ");

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
    <details className="group border-t border-[var(--jos-line)] pt-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[24px] font-extrabold tracking-tight">About me</h2>
          <p className="mt-1 text-[14px] text-[var(--jos-muted)]">{summary}</p>
        </div>
        <CaretDown
          size={18}
          weight="bold"
          className="shrink-0 text-[var(--jos-muted)] transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      {error ? <p className="mt-2 text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      <label className="mt-5 block max-w-xl space-y-1">
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
      <label className="mt-5 block max-w-xl space-y-1">
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
        Used when you build from a playbook and on the call screen.
      </p>
    </details>
  );
}

function TodayCard({
  meeting,
  nowIso,
}: {
  meeting: MeetingPrepSummary;
  nowIso: string;
}) {
  const ready = hasPlan(meeting);
  const source = planSourceLabel(meeting);
  const person = personLabel(meeting);
  const company = meeting.primaryCompanyName?.trim() || null;
  const relative = relativeLabel(meeting.startsAt, meeting.endsAt, nowIso);

  let statusLine = "No plan yet";
  if (ready) statusLine = source ? `Plan ready · from ${source}` : "Plan ready";
  else if (meeting.researchUnverified) statusLine = "Research unverified";

  const whoLine = [person !== meeting.title ? person : null, company]
    .filter(Boolean)
    .join(" · ");

  let topBar = "#d8d6d6";
  if (ready) topBar = "var(--color-accent-700)";

  return (
    <article className="bg-[var(--jos-surface)]" style={{ borderTop: `4px solid ${topBar}` }}>
      <div className="px-4 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[24px] font-extrabold tabular-nums tracking-tight">
            {easternTime(meeting.startsAt)}
          </p>
          {relative ? <p className="text-[14px] text-[var(--jos-muted)]">{relative}</p> : null}
        </div>
        <MeetingTitleField
          prepId={meeting.id}
          title={meeting.title}
          className="mt-2 text-[18px] font-bold leading-snug"
        />
        <p className="mt-2 text-[14px] leading-snug text-[var(--jos-muted)]">{statusLine}</p>
        {whoLine ? <p className="mt-2 text-[14px] text-[var(--jos-muted)]">{whoLine}</p> : null}
        <div className="mt-4">
          {ready ? (
            <Link
              href={`/meetings/${meeting.id}/live`}
              className={cn(buttonVariants({ variant: "default" }), "h-9 gap-1.5 px-3")}
            >
              <Play size={16} weight="fill" aria-hidden />
              Live
            </Link>
          ) : (
            <Link
              href={`/meetings/${meeting.id}#step-plan`}
              className={cn(buttonVariants({ variant: "secondary" }), "h-9 px-3")}
            >
              Build plan
            </Link>
          )}
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
  plans = [],
  plansError = null,
  upcomingMeetings = [],
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
  plans?: LiveScript[];
  plansError?: string | null;
  upcomingMeetings?: MeetingPrepSummary[];
  recent: RecentLiveMeeting[];
  recentError: string | null;
  settings: LiveSettings;
  settingsError: string | null;
}) {
  const router = useRouter();
  const [planOpen, setPlanOpen] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planFor, setPlanFor] = useState("");
  const [planOutcome, setPlanOutcome] = useState("");
  const [planSaving, setPlanSaving] = useState(false);
  const [attachFor, setAttachFor] = useState<string | null>(null);
  const [attachPrepId, setAttachPrepId] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [promoteFor, setPromoteFor] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [creatingPlaybook, setCreatingPlaybook] = useState(false);

  const upcoming = [...meetings].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)
  );
  const recentRows = recent.slice(0, 6);
  const selectedMeeting = upcomingMeetings.find((row) => row.id === attachPrepId) ?? null;

  const createPlan = () => {
    const trimmed = planName.trim();
    if (!trimmed) {
      toast.error("Name the guide.");
      return;
    }
    setPlanSaving(true);
    void createLiveScript({
      name: trimmed,
      kind: "plan",
      description: planFor.trim() || null,
      outcomeSentence: planOutcome.trim() || null,
    }).then((created) => {
      setPlanSaving(false);
      if (!created.ok) {
        toast.error(created.error);
        return;
      }
      setPlanOpen(false);
      setPlanName("");
      setPlanFor("");
      setPlanOutcome("");
      router.push(`/live/scripts/${created.script.id}`);
    });
  };

  const createPlaybook = () => {
    if (creatingPlaybook) return;
    setCreatingPlaybook(true);
    void createLiveScript({ name: "New playbook" }).then((created) => {
      setCreatingPlaybook(false);
      if (!created.ok) {
        toast.error(created.error);
        return;
      }
      router.push(`/live/scripts/${created.script.id}`);
    });
  };

  const runAttach = () => {
    if (!attachFor || !attachPrepId) return;
    setAttaching(true);
    void attachPlanToMeeting({ scriptId: attachFor, prepId: attachPrepId, mode: "replace" }).then(
      (result) => {
        setAttaching(false);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const prepId = attachPrepId;
        setAttachFor(null);
        setAttachPrepId("");
        setConfirmReplace(false);
        router.push(`/meetings/${prepId}#step-plan`);
        router.refresh();
      }
    );
  };

  const requestAttach = () => {
    if (!attachFor || !attachPrepId) return;
    if (selectedMeeting && selectedMeeting.pointCount > 0) {
      setConfirmReplace(true);
      return;
    }
    runAttach();
  };

  const promote = (scriptId: string) => {
    setPromoting(true);
    void promotePlanToStrategy(scriptId).then((result) => {
      setPromoting(false);
      setPromoteFor(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Moved to Playbooks.");
      router.refresh();
    });
  };

  return (
    <div className="px-10 py-8">
      <header>
        <p className={cn(LIVE_SECTION_LABEL, "text-[var(--color-accent-700)]")}>Custom comms</p>
        <h1 className="mt-1 text-[44px] font-extrabold leading-none tracking-[-0.02em]">Live</h1>
      </header>

      {error ? <p className="mt-4 text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {warnings.length ? (
        <p className="mt-2 text-[13px] text-[var(--jos-muted)]">{warnings.join(" · ")}</p>
      ) : null}

      <section className="mt-8">
        <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-calendar-700)]">
          <CalendarBlank size={14} weight="duotone" className="text-[var(--color-calendar)]" aria-hidden />
          Today and tomorrow
        </p>
        {upcoming.length === 0 ? (
          <p className="mt-4 text-[16px] text-[var(--jos-muted)]">No meetings in the next 48 hours.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 min-[900px]:grid-cols-2 min-[1280px]:grid-cols-3">
            {upcoming.map((meeting) => (
              <TodayCard key={meeting.id} meeting={meeting} nowIso={nowIso} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-14 space-y-12">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[24px] font-extrabold tracking-tight">Guides</h2>
            <Button type="button" className="h-9 px-3" onClick={() => setPlanOpen(true)}>
              New guide
            </Button>
          </div>
          {plansError ? (
            <p className="mt-3 text-[14px] text-[var(--color-accent-2-text)]">{plansError}</p>
          ) : null}
          {plans.length === 0 ? (
            <p className="mt-3 text-[15px] text-[var(--jos-muted)]">No guides yet.</p>
          ) : (
            <div className="mt-4 space-y-0">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-wrap items-center gap-3 border-t border-[var(--jos-line)] py-3 first:border-t-0"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/live/scripts/${plan.id}`}
                      className="truncate text-[16px] font-bold hover:underline"
                    >
                      {plan.name}
                    </Link>
                    <p className="mt-0.5 text-[13px] tabular-nums text-[var(--jos-muted)]">
                      {plan.itemCount} {plan.itemCount === 1 ? "point" : "points"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {promoteFor === plan.id ? (
                      <p className="text-[13px]">
                        Make it a playbook?{" "}
                        <button
                          type="button"
                          className="font-semibold text-[var(--color-accent-700)] hover:underline"
                          disabled={promoting}
                          onClick={() => promote(plan.id)}
                        >
                          Confirm
                        </button>
                        {" · "}
                        <button
                          type="button"
                          className="font-semibold hover:underline"
                          onClick={() => setPromoteFor(null)}
                        >
                          Cancel
                        </button>
                      </p>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8"
                          onClick={() => {
                            setAttachFor(plan.id);
                            setAttachPrepId(upcomingMeetings[0]?.id ?? "");
                            setConfirmReplace(false);
                          }}
                        >
                          Use for a meeting
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8"
                          onClick={() => setPromoteFor(plan.id)}
                        >
                          Make it a playbook
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-[24px] font-extrabold tracking-tight">Playbooks</h2>
          {scriptsError ? (
            <p className="mt-3 text-[14px] text-[var(--color-accent-2-text)]">{scriptsError}</p>
          ) : null}
          {scripts.length === 0 ? (
            <p className="mt-3 text-[15px] text-[var(--jos-muted)]">No playbooks yet.</p>
          ) : (
            <div className="mt-4 space-y-0">
              {scripts.map((script) => (
                <Link
                  key={script.id}
                  href={`/live/scripts/${script.id}`}
                  className="flex flex-col gap-0.5 border-t border-[var(--jos-line)] py-3 first:border-t-0 hover:bg-[var(--jos-surface)]"
                >
                  <span className="truncate text-[16px] font-bold text-[var(--jos-ink)]">
                    {script.name}
                  </span>
                  <span className="truncate text-[14px] text-[var(--jos-muted)]">
                    {script.successSentence?.trim() || script.description?.trim() || "No success sentence"}
                  </span>
                  <span className="text-[13px] tabular-nums text-[var(--jos-muted)]">
                    {script.itemCount} {script.itemCount === 1 ? "point" : "points"} · used{" "}
                    {script.useCount} {script.useCount === 1 ? "time" : "times"}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <p className="mt-4">
            <button
              type="button"
              className="text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline disabled:opacity-60"
              disabled={creatingPlaybook}
              onClick={createPlaybook}
            >
              Write a new playbook
            </button>
          </p>
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[24px] font-extrabold tracking-tight">Recent</h2>
            <Link
              href="/live/after"
              className="text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
            >
              All after
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
                const meta = [row.attendeeName, row.companyName, row.strategyName]
                  .filter((value): value is string => Boolean(value && value !== row.title))
                  .filter((value, index, all) => all.indexOf(value) === index);
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-3 border-t border-[var(--jos-line)] py-3 first:border-t-0"
                  >
                    <Link
                      href={`/meetings/${row.id}`}
                      className="w-[4.5rem] shrink-0 text-[15px] font-bold tabular-nums text-[var(--jos-ink)] hover:underline"
                    >
                      {easternDate(row.startsAt)}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <MeetingTitleField
                        prepId={row.id}
                        title={row.title}
                        className="truncate text-[16px] font-semibold"
                      />
                      {meta.length ? (
                        <p className="mt-0.5 truncate text-[13px] text-[var(--jos-muted)]">
                          {meta.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    {needsReview ? (
                      <span className="text-[13px] text-[var(--jos-muted)]">Needs review</span>
                    ) : null}
                    <OutcomePill mark={row.outcomeMark} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <AboutMe settings={settings} error={settingsError} />
      </div>

      <Dialog
        open={planOpen}
        onOpenChange={(next) => {
          setPlanOpen(next);
          if (!next) {
            setPlanName("");
            setPlanFor("");
            setPlanOutcome("");
          }
        }}
      >
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New guide</DialogTitle>
            <DialogDescription>
              Name it, who it is for, and what you want out of it.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              createPlan();
            }}
          >
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">
                Name <span className="text-[var(--jos-danger)]">*</span>
              </span>
              <input
                required
                value={planName}
                maxLength={120}
                className={cn(LIVE_FIELD, "h-11")}
                onChange={(event) => setPlanName(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">Who it is for</span>
              <input
                value={planFor}
                maxLength={200}
                className={cn(LIVE_FIELD, "h-11")}
                onChange={(event) => setPlanFor(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">What you want out of it</span>
              <textarea
                value={planOutcome}
                rows={2}
                className={cn(LIVE_FIELD, "py-2")}
                onChange={(event) => setPlanOutcome(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setPlanOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={planSaving}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(attachFor)}
        onOpenChange={(openState) => {
          if (!openState) {
            setAttachFor(null);
            setAttachPrepId("");
            setConfirmReplace(false);
          }
        }}
      >
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Use for a meeting</DialogTitle>
            <DialogDescription>Meetings in the next 14 days.</DialogDescription>
          </DialogHeader>
          {upcomingMeetings.length === 0 ? (
            <p className="text-[14px] text-[var(--jos-muted)]">No meetings in the next 14 days.</p>
          ) : (
            <div className="space-y-4">
              <select
                aria-label="Meeting"
                value={attachPrepId}
                className={cn(LIVE_FIELD, "h-11")}
                onChange={(event) => {
                  setAttachPrepId(event.target.value);
                  setConfirmReplace(false);
                }}
              >
                {upcomingMeetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {personLabel(meeting)} · {easternDate(meeting.startsAt)} {easternTime(meeting.startsAt)}
                  </option>
                ))}
              </select>
              {confirmReplace && selectedMeeting ? (
                <p className="text-[14px]">
                  Replace {selectedMeeting.pointCount} existing points?{" "}
                  <button
                    type="button"
                    className="font-semibold text-[var(--color-accent-700)] hover:underline"
                    disabled={attaching}
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
                  <Button type="button" variant="ghost" onClick={() => setAttachFor(null)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    disabled={attaching || !attachPrepId}
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
    </div>
  );
}
