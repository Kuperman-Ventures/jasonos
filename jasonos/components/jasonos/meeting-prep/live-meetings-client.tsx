"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarBlank, CaretDown } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldSaveRow, LIVE_FIELD, LIVE_SECTION_LABEL, useSavedField } from "@/components/jasonos/live";
import { ExportLog } from "@/components/jasonos/people/export-log";
import { shortDay } from "@/components/jasonos/people/people-pills";
import type { WeeklyActivity } from "@/lib/server-actions/activity-log";
import { putSheetOnMeeting, type HomeSheetStatus, type MeetingSheetStatus } from "@/lib/server-actions/call-sheet";
import { updateLiveSettings, type LiveSettings } from "@/lib/server-actions/live-settings";
import type { LiveScript } from "@/lib/server-actions/live-scripts";
import type { MeetingPrepSummary } from "@/lib/server-actions/meeting-prep";
import { cn } from "@/lib/utils";

const ET = "America/New_York";

function easternTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: ET, hour: "numeric", minute: "2-digit" });
}

function easternDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: ET, month: "short", day: "numeric" });
}

function etDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ET });
}

function personLabel(meeting: MeetingPrepSummary): string {
  if (meeting.primaryContactName?.trim()) return meeting.primaryContactName.trim();
  const named = meeting.attendees.find((row) => {
    const name = row.name?.trim();
    if (!name || name.includes("@")) return false;
    const local = row.email.split("@")[0]?.toLowerCase() ?? "";
    if (local && name.toLowerCase() === local) return false;
    if (/^[a-z0-9._+-]+$/i.test(name) && name.includes(".") && !/\s/.test(name)) return false;
    return true;
  });
  if (named?.name?.trim()) return named.name.trim();
  if (meeting.primaryCompanyName?.trim()) return meeting.primaryCompanyName.trim();
  return meeting.title;
}

const PILL =
  "inline-flex h-7 shrink-0 items-center justify-center rounded-[2px] px-2 text-[11px] font-extrabold uppercase tracking-[0.08em]";

const STATUS_PILL: Record<HomeSheetStatus, { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-[var(--color-done)] text-white" },
  why_missing: { label: "Why not written", className: "bg-[var(--color-accent-2)] text-white" },
  not_ready: { label: "Not ready", className: "bg-[var(--jos-surface)] text-[var(--jos-ink)]" },
  none: { label: "No sheet yet", className: "bg-[var(--jos-surface)] text-[var(--jos-muted)]" },
};

function StatusPill({ status }: { status: HomeSheetStatus }) {
  const pill = STATUS_PILL[status];
  return <span className={cn(PILL, pill.className)}>{pill.label}</span>;
}

function CallRow({ meeting, sheet }: { meeting: MeetingPrepSummary; sheet: MeetingSheetStatus | undefined }) {
  const status = sheet?.status ?? "none";
  const person = personLabel(meeting);
  const contactId = meeting.primaryContactId;
  const meta = [sheet?.callLabel, meeting.primaryCompanyName?.trim() || null, sheet?.playbookName ?? meeting.scriptName]
    .filter((value): value is string => Boolean(value && value !== person))
    .filter((value, index, all) => all.indexOf(value) === index);
  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-t border-[var(--jos-line)] py-3 first:border-t-0 min-[700px]:grid-cols-[4.5rem_minmax(0,1fr)_auto_auto]">
      <span className="text-[17px] font-extrabold tabular-nums tracking-tight">{easternTime(meeting.startsAt)}</span>
      <span className="min-w-0">
        {contactId ? (
          <Link href={`/live/people/${contactId}`} className="block truncate text-[16px] font-bold hover:underline">
            {person}
          </Link>
        ) : (
          <span className="block truncate text-[16px] font-bold">{person}</span>
        )}
        {meta.length ? (
          <span className="block truncate text-[13px] text-[var(--jos-muted)]">{meta.join(" · ")}</span>
        ) : null}
      </span>
      <span className="col-start-2 min-[700px]:col-start-auto">
        <StatusPill status={status} />
      </span>
      <Link
        href={`/meetings/${meeting.id}`}
        className={cn(
          buttonVariants({ variant: status === "ready" ? "default" : "secondary", size: "sm" }),
          "col-start-2 justify-self-start min-[700px]:col-start-auto"
        )}
      >
        Open sheet
      </Link>
    </li>
  );
}

function Calls({
  meetings,
  statuses,
  nowIso,
}: {
  meetings: MeetingPrepSummary[];
  statuses: Record<string, MeetingSheetStatus>;
  nowIso: string;
}) {
  const today = etDayKey(nowIso);
  const sorted = [...meetings].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const groups = new Map<string, MeetingPrepSummary[]>();
  for (const meeting of sorted) {
    const key = etDayKey(meeting.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), meeting]);
  }
  return (
    <section aria-labelledby="live-calls">
      <h2 id="live-calls" className="text-[24px] font-extrabold tracking-tight">
        Calls
      </h2>
      {sorted.length === 0 ? (
        <p className="mt-3 text-[15px] text-[var(--jos-muted)]">No calls today or tomorrow.</p>
      ) : (
        <div className="mt-3 space-y-5">
          {[...groups.entries()].map(([day, rows]) => (
            <div key={day}>
              <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-calendar-700)]">
                <CalendarBlank size={14} weight="duotone" className="text-[var(--color-calendar)]" aria-hidden />
                {day === today ? "Today" : `Tomorrow · ${easternDate(rows[0].startsAt)}`}
              </p>
              <ul className="mt-1">
                {rows.map((meeting) => (
                  <CallRow key={meeting.id} meeting={meeting} sheet={statuses[meeting.id]} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t-2 border-[var(--jos-ink)] pt-2">
      <p className="text-[36px] font-extrabold leading-none tracking-tight tabular-nums">{value}</p>
      <p className="mt-1.5 text-[13px] leading-snug text-[var(--jos-muted)]">{label}</p>
    </div>
  );
}

function ThisWeek({
  activity,
  error,
  weekStart,
}: {
  activity: WeeklyActivity | null;
  error: string | null;
  weekStart: string;
}) {
  const start = activity?.weekStart ?? weekStart;
  const end = activity?.weekEnd ?? null;
  const ofText = (pair: { met: number; of: number }) => `${pair.met} of ${pair.of}`;
  const stats = activity
    ? [
        { label: "Referrals received", value: String(activity.referralsReceived) },
        { label: "First contact within 48 h", value: ofText(activity.firstContactsIn48h) },
        { label: "Calls held", value: String(activity.callsHeld) },
        { label: "Contacts received", value: String(activity.contactsReceived) },
        { label: "Thank-you within 24 h", value: ofText(activity.thankYouIn24h) },
        { label: "Second calls scheduled", value: String(activity.secondCallsScheduled) },
      ]
    : [];
  return (
    <section aria-labelledby="live-week">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="live-week" className="text-[24px] font-extrabold tracking-tight">
          This week
        </h2>
        <p className="text-[13px] tabular-nums text-[var(--jos-muted)]">
          {shortDay(start)}
          {end ? ` to ${shortDay(end)}` : ""}
        </p>
      </div>
      {error ? <p className="mt-3 text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {stats.length ? (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 min-[700px]:grid-cols-3 min-[1280px]:grid-cols-2">
          {stats.map((stat) => (
            <Stat key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      ) : null}
      <div className="mt-5">
        <ExportLog weekStart={start} pickWeek={false} label="Export log" />
      </div>
    </section>
  );
}

function UndatedSheets({
  sheets,
  error,
  upcomingMeetings,
}: {
  sheets: LiveScript[];
  error: string | null;
  upcomingMeetings: MeetingPrepSummary[];
}) {
  const router = useRouter();
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [prepId, setPrepId] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setSheetId(null);
    setPrepId("");
  };

  const run = () => {
    if (!sheetId || !prepId) return;
    setBusy(true);
    void putSheetOnMeeting({ sheetId, prepId }).then((result) => {
      setBusy(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      close();
      router.push(`/meetings/${result.prepId}`);
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="live-undated">
      <h2 id="live-undated" className="text-[24px] font-extrabold tracking-tight">
        Sheets without a date
      </h2>
      {error ? <p className="mt-3 text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {sheets.length === 0 ? (
        <p className="mt-3 text-[15px] text-[var(--jos-muted)]">None. Every sheet is on a meeting.</p>
      ) : (
        <ul className="mt-3">
          {sheets.map((sheet) => (
            <li
              key={sheet.id}
              className="flex flex-wrap items-center gap-3 border-t border-[var(--jos-line)] py-3 first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <Link href={`/live/scripts/${sheet.id}`} className="block truncate text-[16px] font-bold hover:underline">
                  {sheet.name}
                </Link>
                <p className="mt-0.5 truncate text-[13px] text-[var(--jos-muted)]">
                  {[sheet.description?.trim() || null, `Updated ${easternDate(sheet.updatedAt)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Link href={`/live/scripts/${sheet.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Open
              </Link>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSheetId(sheet.id);
                  setPrepId(upcomingMeetings[0]?.id ?? "");
                }}
              >
                Use for a meeting
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(sheetId)} onOpenChange={(open) => (open ? null : close())}>
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
                value={prepId}
                className={cn(LIVE_FIELD, "h-11")}
                onChange={(event) => setPrepId(event.target.value)}
              >
                {upcomingMeetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {personLabel(meeting)} · {easternDate(meeting.startsAt)} {easternTime(meeting.startsAt)}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button type="button" variant="default" disabled={busy || !prepId} onClick={run}>
                  Use for this meeting
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Playbooks({ playbooks, error }: { playbooks: LiveScript[]; error: string | null }) {
  return (
    <section aria-labelledby="live-playbooks">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="live-playbooks" className="text-[24px] font-extrabold tracking-tight">
          <Link href="/live/playbooks" className="hover:underline">
            Playbooks
          </Link>
        </h2>
        <Link href="/live/playbooks" className="text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline">
          All playbooks
        </Link>
      </div>
      {error ? <p className="mt-3 text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {playbooks.length === 0 ? (
        <p className="mt-3 text-[15px] text-[var(--jos-muted)]">No playbooks yet.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {playbooks.map((playbook) => (
            <li key={playbook.id}>
              <Link href={`/live/scripts/${playbook.id}`} className="text-[15px] font-semibold hover:underline">
                {playbook.name}
              </Link>
              <span className="ml-1.5 text-[13px] tabular-nums text-[var(--jos-muted)]">
                {playbook.useCount === 1 ? "used once" : `used ${playbook.useCount} times`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function companiesText(list: string[]): string {
  return list.join("\n");
}

function AboutMe({ settings, error }: { settings: LiveSettings; error: string | null }) {
  const router = useRouter();
  const snapshot = useSavedField<string>({
    saved: settings.snapshot ?? "",
    label: "Snapshot",
    onSave: async (value) => {
      const result = await updateLiveSettings({ snapshot: value.trim() || null });
      if (!result.ok) return result;
      router.refresh();
      return { ok: true, value: result.snapshot ?? "" };
    },
  });
  const companies = useSavedField<string>({
    saved: companiesText(settings.targetCompanies),
    label: "Target companies",
    onSave: async (value) => {
      const next = value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const result = await updateLiveSettings({ targetCompanies: next });
      if (!result.ok) return result;
      router.refresh();
      return { ok: true, value: companiesText(result.targetCompanies) };
    },
  });

  const companyCount = settings.targetCompanies.length;
  const summary = [
    settings.snapshot?.trim() ? "Snapshot set" : "No snapshot",
    companyCount === 1 ? "1 target company" : `${companyCount} target companies`,
  ].join(" · ");

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
          value={snapshot.value}
          rows={5}
          maxLength={2000}
          placeholder="The snapshot you give once on a first call"
          className={cn(LIVE_FIELD, "mt-1 py-2 text-[15px]")}
          onChange={(event) => snapshot.setValue(event.target.value)}
          onKeyDown={snapshot.onKeyDown}
        />
      </label>
      {snapshot.state !== "clean" ? <FieldSaveRow field={snapshot} name="snapshot" className="max-w-xl" /> : null}
      <label className="mt-5 block max-w-xl space-y-1">
        <span className={LIVE_SECTION_LABEL}>Target companies</span>
        <textarea
          value={companies.value}
          rows={5}
          placeholder="One company per line"
          className={cn(LIVE_FIELD, "mt-1 py-2 text-[15px]")}
          onChange={(event) => companies.setValue(event.target.value)}
          onKeyDown={companies.onKeyDown}
        />
      </label>
      {companies.state !== "clean" ? (
        <FieldSaveRow field={companies} name="companies" className="max-w-xl" />
      ) : null}
      <p className="mt-3 text-[13px] text-[var(--jos-muted)]">
        Build fills these into a sheet, and the call screen shows them.
      </p>
    </details>
  );
}

export function LiveMeetingsClient({
  meetings,
  statuses,
  nowIso,
  error,
  warnings,
  activity,
  activityError,
  weekStart,
  sheets,
  sheetsError,
  upcomingMeetings,
  playbooks,
  playbooksError,
  settings,
  settingsError,
}: {
  meetings: MeetingPrepSummary[];
  statuses: Record<string, MeetingSheetStatus>;
  nowIso: string;
  error: string | null;
  warnings: string[];
  activity: WeeklyActivity | null;
  activityError: string | null;
  weekStart: string;
  sheets: LiveScript[];
  sheetsError: string | null;
  upcomingMeetings: MeetingPrepSummary[];
  playbooks: LiveScript[];
  playbooksError: string | null;
  settings: LiveSettings;
  settingsError: string | null;
}) {
  return (
    <div className="px-4 py-8 min-[900px]:px-10">
      <header>
        <p className={cn(LIVE_SECTION_LABEL, "text-[var(--color-accent-700)]")}>Custom comms</p>
        <h1 className="mt-1 text-[44px] font-extrabold leading-none tracking-[-0.02em]">Live</h1>
      </header>

      {error ? <p className="mt-4 text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {warnings.length ? (
        <p className="mt-2 text-[13px] text-[var(--jos-muted)]">{warnings.join(" · ")}</p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-12 min-[1280px]:grid-cols-[1.3fr_1fr]">
        <Calls meetings={meetings} statuses={statuses} nowIso={nowIso} />
        <ThisWeek activity={activity} error={activityError} weekStart={weekStart} />
      </div>

      <div className="mt-14 space-y-12">
        <UndatedSheets sheets={sheets} error={sheetsError} upcomingMeetings={upcomingMeetings} />
        <Playbooks playbooks={playbooks} error={playbooksError} />
        <AboutMe settings={settings} error={settingsError} />
      </div>
    </div>
  );
}
