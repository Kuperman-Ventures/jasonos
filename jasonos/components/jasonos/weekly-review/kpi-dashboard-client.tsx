"use client";

import { useState, useTransition, useCallback } from "react";
import {
  upsertFridayReview,
  deleteTimerSession,
  type LogEntry,
  type CalendarTagWR,
  type FridayReview,
  type QuickLogEntry,
} from "@/lib/server-actions/weekly-review";

// ─── Constants ────────────────────────────────────────────────────────────────

const TRACKS = {
  advisors:    { key: "advisors",    label: "Kuperman Advisors",  color: "#1E6B3C" },
  jobSearch:   { key: "jobSearch",   label: "Job Search",         color: "#2E75B6" },
  ventures:    { key: "ventures",    label: "Kuperman Ventures",  color: "#9B6BAE" },
  networking:  { key: "networking",  label: "Shared Networking",  color: "#B8600B" },
  development: { key: "development", label: "Development",        color: "#7c3aed" },
  cosaAdmin:   { key: "cosaAdmin",   label: "Administration",     color: "#0891b2" },
} as const;

const TRACK_MIN_TARGETS: Record<string, number> = {
  advisors: 700, jobSearch: 700, ventures: 500, development: 60, cosaAdmin: 60,
};

interface KpiDef {
  id: string;
  label: string;
  kpiValueId: string;
  target: number;
  period: "week" | "month";
  kpiMapping: string;
  trackGroup: string;
  color: string;
  countsTowardWeekScore?: boolean;
}

const KPI_DEFINITIONS: KpiDef[] = [
  // Kuperman Advisors
  { id: "outreach-messages",  label: "Outreach messages sent",        kpiValueId: "outreachSent",              target: 6, period: "week",  kpiMapping: "Outreach messages sent",   trackGroup: "Kuperman Advisors", color: "#1E6B3C" },
  { id: "discovery-held",     label: "Discovery calls held",           kpiValueId: "discoveryCallHeld",         target: 1, period: "week",  kpiMapping: "Discovery calls held",     trackGroup: "Kuperman Advisors", color: "#1E6B3C" },
  { id: "discovery-booked",   label: "Discovery calls booked",         kpiValueId: "discoveryCallBooked",       target: 2, period: "week",  kpiMapping: "Discovery calls booked",   trackGroup: "Kuperman Advisors", color: "#1E6B3C" },
  { id: "networking-meeting", label: "Networking meetings attended",   kpiValueId: "networkingMeetingAttended", target: 1, period: "week",  kpiMapping: "Connective attendance",    trackGroup: "Kuperman Advisors", color: "#1E6B3C" },
  { id: "warm-reconnects",    label: "Warm reconnect communications",  kpiValueId: "warmReconnectComms",        target: 3, period: "week",  kpiMapping: "Warm reconnects sent",     trackGroup: "Kuperman Advisors", color: "#1E6B3C" },
  { id: "linkedin-comments",  label: "LinkedIn comments posted",       kpiValueId: "linkedinComments",          target: 5, period: "week",  kpiMapping: "LinkedIn comments posted", trackGroup: "Kuperman Advisors", color: "#1E6B3C" },
  { id: "content-posts",      label: "Content posts",                  kpiValueId: "contentPosts",              target: 1, period: "week",  kpiMapping: "Content posts",            trackGroup: "Kuperman Advisors", color: "#1E6B3C" },
  // Job Search (shared networking KPIs display-only, don't count toward score)
  { id: "warm-reconnects-js",    label: "Warm reconnect communications", kpiValueId: "warmReconnectComms",   target: 3, period: "week", kpiMapping: "Warm reconnects sent",     trackGroup: "Job Search", color: "#2E75B6", countsTowardWeekScore: false },
  { id: "linkedin-comments-js",  label: "LinkedIn comments posted",      kpiValueId: "linkedinComments",     target: 5, period: "week", kpiMapping: "LinkedIn comments posted", trackGroup: "Job Search", color: "#2E75B6", countsTowardWeekScore: false },
  { id: "content-posts-js",      label: "Content posts",                 kpiValueId: "contentPosts",         target: 1, period: "week", kpiMapping: "Content posts",            trackGroup: "Job Search", color: "#2E75B6", countsTowardWeekScore: false },
  { id: "companies-researched",  label: "Companies researched",          kpiValueId: "companiesResearched",  target: 5, period: "week", kpiMapping: "Companies researched",     trackGroup: "Job Search", color: "#2E75B6" },
  { id: "company-outreaches",    label: "Company outreaches",            kpiValueId: "companyOutreaches",    target: 5, period: "week", kpiMapping: "Company outreaches",       trackGroup: "Job Search", color: "#2E75B6" },
  { id: "roles-identified",      label: "Roles identified",              kpiValueId: "rolesIdentified",      target: 5, period: "week", kpiMapping: "Roles identified",         trackGroup: "Job Search", color: "#2E75B6" },
  { id: "applications",          label: "Applications submitted",        kpiValueId: "applications",         target: 3, period: "week", kpiMapping: "Applications submitted",   trackGroup: "Job Search", color: "#2E75B6" },
  { id: "recruiter-touchpoints", label: "Recruiter touchpoints",         kpiValueId: "recruiterTouchpoints", target: 3, period: "week", kpiMapping: "Recruiter touchpoints",    trackGroup: "Job Search", color: "#2E75B6" },
  // Kuperman Ventures
  { id: "alpha-tester-touchpoints", label: "Alpha tester touchpoints", kpiValueId: "alphaTesterTouchpoints", target: 3, period: "week", kpiMapping: "Tester touchpoints", trackGroup: "Kuperman Ventures", color: "#9B6BAE" },
];

const KPI_TRACK_GROUPS = ["Kuperman Advisors", "Job Search", "Kuperman Ventures"] as const;

const SCORE_CONFIG = {
  green:  { label: "Green",  desc: "7+ KPIs hit — strong week",     bg: "bg-emerald-950/40", text: "text-emerald-300", border: "border-emerald-800" },
  yellow: { label: "Yellow", desc: "4–6 KPIs hit — room to improve", bg: "bg-amber-950/40",   text: "text-amber-300",   border: "border-amber-800"   },
  red:    { label: "Red",    desc: "3 or fewer KPIs hit — regroup",  bg: "bg-rose-950/40",    text: "text-rose-300",    border: "border-rose-800"    },
} as const;
type WeekScore = keyof typeof SCORE_CONFIG;

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function getETDateStr(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function etMidnight(etDateStr: string): Date {
  const edt = new Date(etDateStr + "T04:00:00Z");
  return edt.toLocaleDateString("en-CA", { timeZone: "America/New_York" }) === etDateStr
    ? edt
    : new Date(etDateStr + "T05:00:00Z");
}

function getWeekBounds(offsetWeeks = 0) {
  const todayET = getETDateStr();
  const d = new Date(todayET + "T12:00:00Z");
  const dayOfWeek = d.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setUTCDate(d.getUTCDate() - daysToMonday + offsetWeeks * 7);
  const mondayStr = getETDateStr(d);
  const sundayD = new Date(d);
  sundayD.setUTCDate(d.getUTCDate() + 6);
  const sundayStr = getETDateStr(sundayD);
  const start = etMidnight(mondayStr);
  const end = new Date(etMidnight(sundayStr).getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end, startStr: mondayStr, endStr: sundayStr };
}

function getMonthBoundsForWeek(offsetWeeks = 0) {
  const { startStr } = getWeekBounds(offsetWeeks);
  const [year, month] = startStr.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = etMidnight(`${year}-${pad(month)}-01`);
  const monthEnd = new Date(
    etMidnight(`${year}-${pad(month)}-${pad(lastDay)}`).getTime() + 24 * 60 * 60 * 1000 - 1
  );
  return { start: monthStart, end: monthEnd };
}

function formatWeekLabel(weekStart: Date, weekEnd: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${weekStart.toLocaleDateString("en-US", opts)} – ${weekEnd.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── KPI Math ─────────────────────────────────────────────────────────────────

function countKpi(
  log: LogEntry[],
  kpiDef: KpiDef,
  weekStart: Date,
  weekEnd: Date,
  monthStart: Date,
  monthEnd: Date
): { count: number; total: number | null } {
  const rangeStart = kpiDef.period === "month" ? monthStart : weekStart;
  const rangeEnd = kpiDef.period === "month" ? monthEnd : weekEnd;

  let count = 0;
  for (const e of log) {
    const d = new Date(e.completedAt);
    if (d < rangeStart || d > rangeEnd) continue;
    if (e.completionType === "Partial" || e.completionType === "Cancelled") continue;

    const kviId = (kpiDef as { kpiValueId?: string }).kpiValueId;
    if (kviId && e.kpiValues && (e.kpiValues as Record<string, unknown>)[kviId] != null) {
      const val = (e.kpiValues as Record<string, unknown>)[kviId];
      if (typeof val === "number" && val > 0) count += val;
      else if (val === true || (typeof val === "string" && val.trim())) count += 1;
      continue;
    }
    if (kpiDef.kpiMapping && e.kpiMapping === kpiDef.kpiMapping) {
      count += e.quantity ?? 1;
    }
  }
  return { count, total: null };
}

function countCalendarTagKpiCredits(
  tagsByEventId: Record<string, CalendarTagWR>,
  kpiDef: KpiDef,
  weekStart: Date,
  weekEnd: Date,
  monthStart: Date,
  monthEnd: Date
): number {
  if (!kpiDef.kpiMapping) return 0;
  const rangeStart = kpiDef.period === "month" ? monthStart : weekStart;
  const rangeEnd = kpiDef.period === "month" ? monthEnd : weekEnd;
  let count = 0;
  for (const tag of Object.values(tagsByEventId)) {
    const credits = tag.kpiCredits;
    if (!tag?.date || !Array.isArray(credits) || credits.length === 0) continue;
    const tagDate = new Date(`${tag.date}T12:00:00`);
    if (tagDate < rangeStart || tagDate > rangeEnd) continue;
    const qtyMap = tag.kpiQuantities ?? {};
    for (const mapping of credits) {
      if (mapping !== kpiDef.kpiMapping) continue;
      const q = qtyMap[mapping];
      count += typeof q === "number" && q >= 1 ? q : 1;
    }
  }
  return count;
}

function isKpiHit(count: number, kpiDef: KpiDef): boolean {
  if (!kpiDef.target) return count > 0;
  return count >= kpiDef.target;
}

function computeWeekScore(weeklyKpisHit: number): WeekScore {
  if (weeklyKpisHit >= 7) return "green";
  if (weeklyKpisHit >= 4) return "yellow";
  return "red";
}

// ─── Derived Types ────────────────────────────────────────────────────────────

interface KpiResult extends KpiDef { count: number; hit: boolean; }

interface TrackData {
  track: typeof TRACKS[keyof typeof TRACKS];
  minutesLogged: number;
  targetMins: number;
  pct: number;
  pctRaw: number;
  entries: LogEntry[];
  splitEntries: LogEntry[];
  subTrackRows: [string, number][];
}

// ─── Component Props ─────────────────────────────────────────────────────────

interface Props {
  completionLog: LogEntry[];
  calendarEventTags: Record<string, CalendarTagWR>;
  fridayReviews: FridayReview[];
  quickLogs: QuickLogEntry[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function KpiDashboardClient({
  completionLog,
  calendarEventTags,
  fridayReviews: initialReviews,
  quickLogs,
}: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [fridayReviews, setFridayReviews] = useState<FridayReview[]>(initialReviews);
  const [reviewDraft, setReviewDraft] = useState({ q1: "", q2: "", q3: "", mondayIntention: "" });
  const [reviewSaving, startSaving] = useTransition();
  const [showReconcile, setShowReconcile] = useState(false);
  const [reconcileExpandedTracks, setReconcileExpandedTracks] = useState<Record<string, boolean>>({});
  const [kpiDetailOpen, setKpiDetailOpen] = useState<KpiResult | null>(null);
  const [trackDetailOpen, setTrackDetailOpen] = useState<TrackData | null>(null);

  const isCurrentWeek = weekOffset === 0;

  // ── Week bounds ──────────────────────────────────────────────────────────
  const { start: weekStart, end: weekEnd, startStr: weekStartStr } = getWeekBounds(weekOffset);
  const { start: monthStart, end: monthEnd } = getMonthBoundsForWeek(weekOffset);

  // ── Restore review draft when week changes ───────────────────────────────
  const savedReview = fridayReviews.find((r) => r.week_start === weekStartStr) ?? null;

  // ── KPI Results ──────────────────────────────────────────────────────────
  const kpiResults: KpiResult[] = KPI_DEFINITIONS.map((def) => {
    const { count: logCount } = countKpi(completionLog, def, weekStart, weekEnd, monthStart, monthEnd);
    const calCount = countCalendarTagKpiCredits(calendarEventTags, def, weekStart, weekEnd, monthStart, monthEnd);
    const count = logCount + calCount;
    return { ...def, count, hit: isKpiHit(count, def) };
  });

  const weeklyKpis = kpiResults.filter(
    (k) => k.period === "week" && k.target && k.countsTowardWeekScore !== false
  );
  const kpisHit = weeklyKpis.filter((k) => k.hit).length;
  const kpisTotal = weeklyKpis.length;
  const weekScore = computeWeekScore(kpisHit);
  const score = SCORE_CONFIG[weekScore];

  // ── Time by track ────────────────────────────────────────────────────────
  const networkingMins = completionLog.reduce((sum, e) => {
    const d = new Date(e.completedAt);
    if (d < weekStart || d > weekEnd || e.track !== "networking") return sum;
    return sum + Math.round((e.elapsedSeconds ?? 0) / 60);
  }, 0);

  const timeByTrack: TrackData[] = Object.values(TRACKS)
    .filter((t) => t.key !== "networking")
    .map((track) => {
      const entries = completionLog.filter((e) => {
        const d = new Date(e.completedAt);
        return d >= weekStart && d <= weekEnd && e.track === track.key;
      });
      let minutesLogged = entries.reduce(
        (sum, e) => sum + Math.round((e.elapsedSeconds ?? 0) / 60),
        0
      );
      if (track.key === "advisors") minutesLogged += Math.round(networkingMins / 2);
      if (track.key === "jobSearch") minutesLogged += networkingMins - Math.round(networkingMins / 2);

      const targetMins = TRACK_MIN_TARGETS[track.key] ?? 0;
      const pctRaw = targetMins > 0 ? Math.round((minutesLogged / targetMins) * 100) : 0;
      const pct = Math.min(100, pctRaw);

      const splitEntries =
        track.key === "advisors" || track.key === "jobSearch"
          ? completionLog.filter((e) => {
              const d = new Date(e.completedAt);
              return d >= weekStart && d <= weekEnd && e.track === "networking";
            })
          : [];

      const subTrackTotals: Record<string, number> = {};
      for (const e of entries) {
        if (!e.subTrack) continue;
        subTrackTotals[e.subTrack] = (subTrackTotals[e.subTrack] ?? 0) + Math.round((e.elapsedSeconds ?? 0) / 60);
      }
      const subTrackRows: [string, number][] = Object.entries(subTrackTotals).sort((a, b) => b[1] - a[1]);

      return { track, minutesLogged, targetMins, pct, pctRaw, entries, splitEntries, subTrackRows };
    })
    .filter((t) => t.targetMins > 0);

  // ── Quick logs for this week ─────────────────────────────────────────────
  const weekQuickLogs = quickLogs.filter((e) => {
    const d = new Date(e.logged_at);
    return d >= weekStart && d <= weekEnd;
  });

  // ── Save friday review ───────────────────────────────────────────────────
  function handleSaveFridayReview() {
    startSaving(async () => {
      const result = await upsertFridayReview({
        weekStart: weekStartStr,
        weekScore,
        kpisHit,
        kpisTotal,
        q1: reviewDraft.q1,
        q2: reviewDraft.q2,
        q3: reviewDraft.q3,
        mondayIntention: reviewDraft.mondayIntention,
      });
      if (result.ok) {
        const newReview: FridayReview = {
          week_start: weekStartStr,
          week_score: weekScore,
          kpis_hit: kpisHit,
          kpis_total: kpisTotal,
          q1: reviewDraft.q1,
          q2: reviewDraft.q2,
          q3: reviewDraft.q3,
          monday_intention: reviewDraft.mondayIntention,
          updated_at: new Date().toISOString(),
        };
        setFridayReviews((prev) => {
          const without = prev.filter((r) => r.week_start !== weekStartStr);
          return [newReview, ...without].sort((a, b) => b.week_start.localeCompare(a.week_start));
        });
      }
    });
  }

  // Sync draft when navigating to a saved review week
  const handleWeekChange = useCallback(
    (delta: number) => {
      const newOffset = weekOffset + delta;
      if (newOffset > 0) return;
      setWeekOffset(newOffset);
      const { startStr } = getWeekBounds(newOffset);
      const existing = fridayReviews.find((r) => r.week_start === startStr);
      setReviewDraft({
        q1: existing?.q1 ?? "",
        q2: existing?.q2 ?? "",
        q3: existing?.q3 ?? "",
        mondayIntention: existing?.monday_intention ?? "",
      });
    },
    [weekOffset, fridayReviews]
  );

  // ── Reconcile week entries ────────────────────────────────────────────────
  const weekEntries = completionLog.filter((e) => {
    const d = new Date(e.completedAt);
    return d >= weekStart && d <= weekEnd;
  });

  const entriesByTrack = Object.values(TRACKS).reduce<Record<string, LogEntry[]>>(
    (acc, t) => ({
      ...acc,
      [t.key]: weekEntries.filter((e) => e.track === t.key),
    }),
    {}
  );

  function handleDeleteSession(id: string) {
    startSaving(async () => {
      await deleteTimerSession(id);
    });
  }

  // ── KPI group card ───────────────────────────────────────────────────────
  function KpiGroupCard({ group }: { group: string }) {
    const groupKpis = kpiResults.filter((k) => k.trackGroup === group);
    const accentColor = groupKpis[0]?.color ?? "#64748b";
    const periodLabel = groupKpis[0]?.period === "month" ? "Month" : "Week";
    return (
      <article className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2" style={{ backgroundColor: `${accentColor}22` }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
          <h2 className="text-sm font-semibold text-foreground">{group}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">KPI</th>
                <th className="px-3 py-2 text-center font-medium">Target</th>
                <th className="px-3 py-2 text-center font-medium">This {periodLabel}</th>
                <th className="px-3 py-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {groupKpis.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground italic">
                    No KPIs defined for this track yet.
                  </td>
                </tr>
              ) : (
                groupKpis.map((kpi) => (
                  <tr
                    key={kpi.id}
                    className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setKpiDetailOpen(kpi)}
                  >
                    <td className="px-4 py-2.5 text-foreground">
                      {kpi.label}
                      <span className="ml-1 text-[10px] text-muted-foreground">↗</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-muted-foreground">
                      {kpi.target ? `${kpi.target}/${kpi.period === "month" ? "mo" : "wk"}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium text-foreground">
                      {kpi.count}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {kpi.hit ? (
                        <span className="inline-block rounded-full bg-emerald-900/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">✓ Hit</span>
                      ) : (
                        <span className="inline-block rounded-full bg-rose-900/60 px-2 py-0.5 text-[11px] font-semibold text-rose-300">✗ Miss</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    );
  }

  // ── Donut chart data ──────────────────────────────────────────────────────
  const totalTarget = timeByTrack.reduce((s, t) => s + t.targetMins, 0);
  const totalLogged = timeByTrack.reduce((s, t) => s + t.minutesLogged, 0);
  const chartTracks = timeByTrack.filter((t) => t.track.key !== "networking" && t.minutesLogged > 0);
  const r = 38, CX = 50, CY = 50;
  const circ = 2 * Math.PI * r;
  let cumFrac = 0;
  const donutSegments = chartTracks.map((td) => {
    const frac = totalTarget > 0 ? td.minutesLogged / totalTarget : 0;
    const arcLen = Math.max(frac * circ, 0);
    const dashOffset = circ * (1 - cumFrac);
    cumFrac += frac;
    return { td, arcLen, dashOffset, pct: Math.round(frac * 100) };
  });

  return (
    <section className="space-y-4 p-4">
      {/* ── Week navigation ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={() => handleWeekChange(-1)}
          className="rounded-md border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-muted/60"
        >
          ← Prev
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Weekly Review</p>
          <p className="text-sm font-semibold text-foreground">{formatWeekLabel(weekStart, weekEnd)}</p>
          {isCurrentWeek && <p className="text-xs text-muted-foreground">Current week</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setReconcileExpandedTracks({}); setShowReconcile(true); }}
            className="rounded-md border border-amber-800 bg-amber-950/40 px-3 py-1 text-sm text-amber-300 hover:bg-amber-950/70"
          >
            ⚖ Reconcile
          </button>
          <button
            type="button"
            onClick={() => handleWeekChange(1)}
            disabled={isCurrentWeek}
            className="rounded-md border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-muted/60 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* ── Week score ───────────────────────────────────────────────── */}
        <article className={`rounded-xl border ${score.border} ${score.bg} p-4`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Week Score</p>
          <p className={`mt-1 text-2xl font-bold ${score.text}`}>{score.label}</p>
          <p className={`text-sm ${score.text}`}>{score.desc}</p>
          <p className={`mt-1 text-xs ${score.text} opacity-80`}>
            {kpisHit} of {weeklyKpis.length} weekly KPIs hit
          </p>
        </article>

        {/* ── Two-column layout ────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          {/* Left: time by track + Job Search KPIs */}
          <div className="min-w-0 space-y-4">
            <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Time This Week</h2>
              <p className="mb-3 text-[11px] text-muted-foreground">Bars reflect your timer sessions and quick logs.</p>
              <div className="space-y-3">
                {timeByTrack.map((td) => (
                  <div
                    key={td.track.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setTrackDetailOpen(td)}
                    onKeyDown={(e) => e.key === "Enter" && setTrackDetailOpen(td)}
                    className="w-full cursor-pointer text-left rounded-lg p-2 -mx-2 hover:bg-muted/40 transition-colors"
                  >
                    <div className="mb-1 flex items-center justify-between text-xs gap-2">
                      <span className="font-medium text-foreground">{td.track.label}</span>
                      <span className={`shrink-0 font-semibold ${td.pct >= 100 ? "text-emerald-400" : td.pct >= 60 ? "text-amber-400" : "text-muted-foreground"}`}>
                        {td.minutesLogged}m{" "}
                        <span className="font-normal text-muted-foreground">/ {td.targetMins}m target</span>
                      </span>
                    </div>
                    <div className="relative mb-0.5 text-center">
                      <span className="text-[10px] font-semibold" style={{ color: td.track.color }}>{td.pctRaw}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all" style={{ width: `${td.pct}%`, backgroundColor: td.track.color }} />
                    </div>
                  </div>
                ))}
                {timeByTrack.every((t) => t.minutesLogged < 1) && (
                  <p className="text-xs text-muted-foreground italic">No logged sessions this week yet.</p>
                )}
              </div>
            </article>
            <KpiGroupCard group="Job Search" />
          </div>

          {/* Right: donut + other KPI groups */}
          <div className="min-w-0 space-y-4">
            {/* Donut */}
            <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Time Allocation</h2>
              {totalLogged < 1 ? (
                <p className="text-xs text-muted-foreground italic">No logged time this week yet.</p>
              ) : (
                <div className="flex items-center gap-6">
                  <div className="relative shrink-0 h-36 w-36">
                    <svg viewBox="0 0 100 100" className="h-full w-full" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx={CX} cy={CY} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={18} />
                      {donutSegments.map(({ td, arcLen, dashOffset }) => (
                        <circle
                          key={td.track.key}
                          cx={CX} cy={CY} r={r}
                          fill="none"
                          stroke={td.track.color}
                          strokeWidth={18}
                          strokeLinecap="butt"
                          strokeDasharray={`${arcLen} ${circ - arcLen}`}
                          strokeDashoffset={dashOffset}
                        />
                      ))}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-bold text-foreground leading-none">{(totalLogged / 60).toFixed(1)}h</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">of {(totalTarget / 60).toFixed(0)}h target</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5 min-w-0 flex-1">
                    {donutSegments.map(({ td, pct }) => (
                      <button
                        key={td.track.key}
                        type="button"
                        onClick={() => setTrackDetailOpen(td)}
                        className="flex items-center gap-2 w-full text-left group"
                      >
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: td.track.color }} />
                        <span className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">{td.track.label}</span>
                        <span className="shrink-0 text-xs font-semibold ml-auto pl-2" style={{ color: td.track.color }}>{pct}%</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground w-12 text-right">{td.minutesLogged}m</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </article>

            {/* Other KPI group cards */}
            {KPI_TRACK_GROUPS.filter((g) => g !== "Job Search").map((group) => (
              <KpiGroupCard key={group} group={group} />
            ))}
          </div>
        </div>

        {/* ── Quick Logs ───────────────────────────────────────────────── */}
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Quick Logs — This Week</h2>
          {weekQuickLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No quick logs this week.</p>
          ) : (
            <ul className="divide-y divide-border">
              {weekQuickLogs.map((entry, i) => {
                const timeStr = entry.logged_at
                  ? new Date(entry.logged_at).toLocaleString("en-US", {
                      weekday: "short", month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })
                  : "";
                const trackKey = entry.track ?? null;
                const trackMeta = trackKey ? (TRACKS as Record<string, typeof TRACKS[keyof typeof TRACKS]>)[trackKey] : null;
                return (
                  <li key={entry.id ?? i} className="py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {trackMeta && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: trackMeta.color }}
                            >
                              {trackMeta.label}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-foreground">
                            {entry.activity_type}
                            <span className="ml-1 font-normal text-muted-foreground">with {entry.who}</span>
                            <span className="ml-1 text-muted-foreground">· {entry.duration_minutes}m</span>
                          </span>
                        </div>
                        {entry.sub_track && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground font-medium">{entry.sub_track}</p>
                        )}
                        {entry.kpi_credits.length > 0 && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{entry.kpi_credits.join(" · ")}</p>
                        )}
                        {entry.note && (
                          <p className="mt-0.5 text-[11px] italic text-muted-foreground">"{entry.note}"</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeStr}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </div>

      {/* ── Friday Review & Past Reviews ─────────────────────────────────── */}
      <div className="mt-8 space-y-4 border-t border-border pt-8">
        <article className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Friday Review</h2>
              <p className="text-xs text-muted-foreground">{formatWeekLabel(weekStart, weekEnd)}</p>
            </div>
            {savedReview && (
              <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Saved</span>
            )}
          </div>

          <div className="space-y-4 p-4">
            <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${score.bg} ${score.border}`}>
              <span className={`text-sm font-bold ${score.text}`}>{score.label} week</span>
              <span className={`text-xs ${score.text} opacity-80`}>{kpisHit} of {kpisTotal} KPIs hit — auto-filled</span>
            </div>

            <div className="space-y-3">
              {([
                { key: "q1", label: "What actually got in the way this week?", placeholder: "Be honest — what blocked you or slowed you down?" },
                { key: "q2", label: "One thing to do differently next week?",  placeholder: "One concrete change — be specific." },
                { key: "q3", label: "One thing you did well this week?",        placeholder: "Don't skip this — it matters." },
                { key: "mondayIntention", label: "Monday intention", placeholder: "What's the one thing Monday must deliver?" },
              ] as const).map(({ key, label, placeholder }) => (
                <label key={key} className="block">
                  <p className="mb-1 text-xs font-semibold text-foreground">{label}</p>
                  <textarea
                    rows={key === "mondayIntention" ? 2 : 3}
                    value={reviewDraft[key]}
                    onChange={(e) => setReviewDraft((d) => ({ ...d, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none resize-none"
                  />
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveFridayReview}
                disabled={reviewSaving}
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
              >
                {reviewSaving ? "Saving…" : savedReview ? "Update Review" : "Save Review"}
              </button>
            </div>
          </div>
        </article>

        {/* Past reviews */}
        {fridayReviews.filter((r) => r.week_start !== weekStartStr).length > 0 && (
          <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Past Reviews</h2>
            <ul className="space-y-2">
              {fridayReviews
                .filter((r) => r.week_start !== weekStartStr)
                .slice(0, 5)
                .map((r) => {
                  const sc = SCORE_CONFIG[(r.week_score as WeekScore) ?? "red"] ?? SCORE_CONFIG.red;
                  return (
                    <li key={r.week_start} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${sc.bg} ${sc.text}`}>
                        {r.week_score?.toUpperCase()}
                      </span>
                      <span className="text-xs font-medium text-foreground">{formatDate(r.week_start)}</span>
                      <span className="text-xs text-muted-foreground">{r.kpis_hit}/{r.kpis_total} KPIs</span>
                      {r.monday_intention ? (
                        <span className="ml-1 flex-1 truncate text-xs text-muted-foreground italic">"{r.monday_intention}"</span>
                      ) : (
                        <span className="flex-1" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleWeekChange(
                          getWeekBounds(0).startStr.localeCompare(r.week_start) > 0
                            ? -Math.round(
                                (new Date(getWeekBounds(0).startStr + "T12:00:00Z").getTime() -
                                  new Date(r.week_start + "T12:00:00Z").getTime()) /
                                  (7 * 24 * 60 * 60 * 1000)
                              )
                            : 0
                        )}
                        className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/60"
                      >
                        View Week
                      </button>
                    </li>
                  );
                })}
            </ul>
          </article>
        )}
      </div>

      {/* ── KPI Detail Drawer ─────────────────────────────────────────────── */}
      {kpiDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setKpiDetailOpen(null)}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">{kpiDetailOpen.label}</h2>
              <button onClick={() => setKpiDetailOpen(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">{kpiDetailOpen.count}</span>
                <span className="text-sm text-muted-foreground">/ {kpiDetailOpen.target} target</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${kpiDetailOpen.hit ? "bg-emerald-900/60 text-emerald-300" : "bg-rose-900/60 text-rose-300"}`}>
                  {kpiDetailOpen.hit ? "✓ Hit" : "✗ Miss"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Contributing sessions this {kpiDetailOpen.period}:</p>
              <ul className="space-y-1">
                {completionLog
                  .filter((e) => {
                    const d = new Date(e.completedAt);
                    const inRange = d >= weekStart && d <= weekEnd;
                    if (!inRange) return false;
                    if (e.completionType === "Partial" || e.completionType === "Cancelled") return false;
                    const kviId = (kpiDetailOpen as { kpiValueId?: string }).kpiValueId;
                    if (kviId && (e.kpiValues as Record<string, unknown>)[kviId] != null) return true;
                    if (kpiDetailOpen.kpiMapping && e.kpiMapping === kpiDetailOpen.kpiMapping) return true;
                    return false;
                  })
                  .map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/30 px-3 py-1.5 text-xs">
                      <span className="text-foreground font-medium">{e.taskName}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {new Date(e.completedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Track Detail Drawer ───────────────────────────────────────────── */}
      {trackDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setTrackDetailOpen(null)}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">{trackDetailOpen.track.label}</h2>
              <button onClick={() => setTrackDetailOpen(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-foreground">{trackDetailOpen.minutesLogged}m</span>
                <span className="text-sm text-muted-foreground">/ {trackDetailOpen.targetMins}m target ({trackDetailOpen.pctRaw}%)</span>
              </div>
              {trackDetailOpen.subTrackRows.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">By Sub-Track</p>
                  {trackDetailOpen.subTrackRows.map(([st, mins]) => (
                    <div key={st} className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{st}</span>
                      <span className="text-muted-foreground">{mins}m</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-2">Sessions:</p>
              <ul className="space-y-1">
                {[...trackDetailOpen.entries, ...trackDetailOpen.splitEntries].map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/30 px-3 py-1.5 text-xs">
                    <div>
                      <span className="text-foreground font-medium">{e.taskName}</span>
                      {e.subTrack && <span className="ml-1 text-muted-foreground">· {e.subTrack}</span>}
                    </div>
                    <span className="shrink-0 text-muted-foreground">{Math.round((e.elapsedSeconds ?? 0) / 60)}m</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Reconcile Drawer ──────────────────────────────────────────────── */}
      {showReconcile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setShowReconcile(false)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sticky top-0 bg-card z-10">
              <h2 className="text-sm font-semibold text-foreground">Reconcile Log — {formatWeekLabel(weekStart, weekEnd)}</h2>
              <button onClick={() => setShowReconcile(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              {weekEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No sessions logged this week.</p>
              ) : (
                Object.values(TRACKS)
                  .filter((t) => (entriesByTrack[t.key] ?? []).length > 0)
                  .map((track) => {
                    const isExpanded = reconcileExpandedTracks[track.key] ?? true;
                    const tEntries = entriesByTrack[track.key] ?? [];
                    return (
                      <div key={track.key} className="rounded-lg border border-border overflow-hidden">
                        <button
                          className="flex w-full items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/60 transition-colors"
                          onClick={() => setReconcileExpandedTracks((p) => ({ ...p, [track.key]: !isExpanded }))}
                        >
                          <span className="text-xs font-semibold" style={{ color: track.color }}>{track.label}</span>
                          <span className="text-xs text-muted-foreground">{tEntries.length} sessions · {isExpanded ? "▲" : "▼"}</span>
                        </button>
                        {isExpanded && (
                          <ul className="divide-y divide-border">
                            {tEntries.map((e) => (
                              <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium text-foreground">{e.taskName}</span>
                                  {e.subTrack && <span className="ml-1 text-muted-foreground">· {e.subTrack}</span>}
                                  <span className="ml-2 text-muted-foreground">{Math.round((e.elapsedSeconds ?? 0) / 60)}m</span>
                                  <span className="ml-1 text-muted-foreground">· {e.completionType}</span>
                                </div>
                                <span className="shrink-0 text-muted-foreground">
                                  {new Date(e.completedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Delete session "${e.taskName}"?`)) handleDeleteSession(e.id);
                                  }}
                                  className="shrink-0 rounded px-2 py-0.5 text-[10px] text-destructive border border-destructive/30 hover:bg-destructive/10"
                                >
                                  Delete
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
