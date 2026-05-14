"use client";

import { useState, useMemo, useRef, useEffect, useTransition, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Plus, Loader2, Tag, Settings } from "lucide-react";
import {
  buildCalendarHealthModel,
  allocationsToTrackTargets,
  COSA_ALLOCATION_DEFAULTS,
  allocationSubTrackKey,
  eventDurationMins,
  formatLocalDate,
  type GCalEvent,
  type CalendarTag,
  type TrackTarget,
  type HealthContributor,
} from "@/lib/calendar/health-model";
import { quickLogGroupsForTrack } from "@/lib/calendar/quick-log-kpis";
import {
  fetchCalendarWeek,
  upsertCalendarTag,
  removeCalendarTag,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  saveAllocations,
  type CalendarWeekData,
  type AllocationsMap,
} from "@/lib/server-actions/calendar";
import type { TaskTemplate } from "@/lib/server-actions/tasks";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TRACK_LABELS: Record<string, string> = {
  advisors:    "Kuperman Advisors",
  jobSearch:   "Job Search",
  ventures:    "Kuperman Ventures",
  networking:  "Shared Networking",
  development: "Development",
  cosaAdmin:   "Administration",
};

const TRACK_COLORS: Record<string, string> = {
  advisors:    "#1E6B3C",
  jobSearch:   "#2E75B6",
  ventures:    "#9B6BAE",
  networking:  "#B8600B",
  development: "#7c3aed",
  cosaAdmin:   "#0891b2",
};

const GRID_START_HOUR = 6;
const GRID_END_HOUR   = 23;
const PX_PER_HOUR     = 64;
const SNAP_MINUTES    = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekMondayStr(offsetWeeks = 0): string {
  const d = new Date();
  const day = d.getDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysToMonday + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return formatLocalDate(d);
}

function getWeekDates(mondayStr: string) {
  const anchor = new Date(`${mondayStr}T12:00:00`);
  return DAY_NAMES.map((name, i) => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i);
    return { name, date: formatLocalDate(d) };
  });
}

function formatWeekLabel(mondayStr: string): string {
  const d = new Date(mondayStr + "T12:00:00");
  const sun = new Date(d);
  sun.setDate(d.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${d.toLocaleDateString("en-US", opts)} – ${sun.toLocaleDateString("en-US", opts)}, ${sun.getFullYear()}`;
}

function isoToMinutes(isoStr: string): number {
  const d = new Date(isoStr);
  return d.getHours() * 60 + d.getMinutes();
}

function minutesToPx(minutes: number): number {
  return ((minutes - GRID_START_HOUR * 60) / 60) * PX_PER_HOUR;
}

function pxToMinutes(px: number): number {
  return GRID_START_HOUR * 60 + (px / PX_PER_HOUR) * 60;
}

function snapMinutes(mins: number): number {
  return Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES;
}

function minsToTimeStr(totalMins: number): string {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

function buildISO(dateStr: string, totalMins: number): string {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function healthColor(assigned: number, target: number): "green" | "yellow" | "red" {
  if (target === 0) return "green";
  const pct = assigned / target;
  if (pct >= 0.9) return "green";
  if (pct >= 0.6) return "yellow";
  return "red";
}

function getUserTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AllocationEditor({
  allocations,
  onSave,
  onClose,
}: {
  allocations: AllocationsMap;
  onSave: (next: AllocationsMap) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AllocationsMap>(() => JSON.parse(JSON.stringify(allocations)));

  function setWeekly(track: string, val: string) {
    const v = Math.max(0, parseInt(val) || 0);
    setDraft((p) => ({ ...p, [track]: { ...p[track], weekly: v } }));
  }

  function setPct(track: string, subTrack: string, val: string) {
    const v = Math.max(0, Math.min(100, parseInt(val) || 0));
    setDraft((p) => ({ ...p, [track]: { ...p[track], subTracks: { ...p[track].subTracks, [subTrack]: v } } }));
  }

  function pctTotal(track: string): number {
    return Object.values(draft[track]?.subTracks ?? {}).reduce((s, v) => s + v, 0);
  }

  const isValid = Object.keys(draft).every((track) => {
    const hasSubs = Object.keys(draft[track].subTracks).length > 0;
    return !hasSubs || pctTotal(track) <= 100;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-xl bg-card border border-border shadow-xl" style={{ maxHeight: "90vh" }}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Allocation Targets</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Set weekly targets and sub-track splits per track</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {Object.entries(draft).map(([track, cfg]) => {
            const total = pctTotal(track);
            const hasSubs = Object.keys(cfg.subTracks).length > 0;
            const totalCls = total > 100 ? "text-destructive" : total === 100 ? "text-green-500" : "text-amber-400";
            return (
              <div key={track} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: TRACK_COLORS[track] }}>
                    {TRACK_LABELS[track]}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-muted-foreground">Weekly target</label>
                    <input
                      type="number" min={0} max={2000} value={cfg.weekly}
                      onChange={(e) => setWeekly(track, e.target.value)}
                      className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-right text-foreground outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="text-[11px] text-muted-foreground">min</span>
                  </div>
                </div>
                {hasSubs && (
                  <div className="space-y-1.5 mt-2 border-t border-border pt-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Sub-track split (% of weekly)</p>
                    {Object.entries(cfg.subTracks).map(([st, pct]) => (
                      <div key={st} className="flex items-center gap-2">
                        <span className="flex-1 text-[11px] text-muted-foreground truncate">{st}</span>
                        <span className="text-[11px] text-muted-foreground">{Math.round((pct / 100) * cfg.weekly)}m</span>
                        <input
                          type="number" min={0} max={100} value={pct}
                          onChange={(e) => setPct(track, st, e.target.value)}
                          className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-right text-foreground outline-none focus:ring-1 focus:ring-ring"
                        />
                        <span className="text-[11px] text-muted-foreground w-3">%</span>
                      </div>
                    ))}
                    <div className={`text-right text-[11px] font-semibold pt-1 ${totalCls}`}>
                      {total > 100 ? `⚠ Total ${total}% — exceeds 100%` : total === 100 ? `✓ Total 100%` : `Total ${total}% · ${100 - total}% unallocated`}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button type="button" onClick={() => isValid && onSave(draft)} disabled={!isValid}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-40">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function HealthDetailModal({ detail, onClose }: { detail: { title: string; targetMins: number; items: HealthContributor[] } | null; onClose: () => void }) {
  if (!detail) return null;
  const sorted = [...detail.items].sort((a, b) => (b.sortKey || "").localeCompare(a.sortKey || ""));
  const sumMins = sorted.reduce((s, it) => s + it.minutes, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="pr-2 text-sm font-semibold text-foreground">{detail.title}</h3>
          <button type="button" onClick={onClose} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {sorted.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">No events in this bucket.</p>
          ) : (
            <ul className="divide-y divide-border">
              {sorted.map((it) => (
                <li key={it.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">{it.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{it.source === "cosa-calendar" ? "CoSA calendar" : "Personal calendar · tagged"}</p>
                      {it.rawSubTrack && <p className="mt-0.5 text-[11px] text-muted-foreground">Sub-track: &quot;{it.rawSubTrack}&quot;</p>}
                      {it.splitNote && <p className="mt-0.5 text-[11px] text-amber-400">{it.splitNote}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-medium text-foreground">{it.minutes}m</p>
                      <p className="text-[11px] text-muted-foreground">{it.dayLabel}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {sorted.length > 0 && (
          <div className="flex items-center justify-between border-t border-border bg-muted px-4 py-2.5 text-xs text-muted-foreground">
            <span>{sorted.length} event{sorted.length !== 1 ? "s" : ""}</span>
            <span className="font-semibold">{sumMins}m scheduled · target {detail.targetMins}m</span>
          </div>
        )}
      </div>
    </div>
  );
}

function HealthBars({
  healthModel,
  trackTargets,
  onEditAllocations,
  onOpenDetail,
}: {
  healthModel: ReturnType<typeof buildCalendarHealthModel>;
  trackTargets: Record<string, TrackTarget>;
  onEditAllocations: () => void;
  onOpenDetail: (d: { title: string; targetMins: number; items: HealthContributor[] }) => void;
}) {
  const { totals, contributors } = healthModel;
  return (
    <aside className="w-52 shrink-0 space-y-3 overflow-y-auto pb-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">This Week</p>
        <button type="button" onClick={onEditAllocations} className="rounded p-0.5 text-muted-foreground hover:bg-muted" title="Edit allocation targets">
          <Settings size={11} />
        </button>
      </div>
      {Object.entries(trackTargets).map(([track, cfg]) => {
        const scheduled = totals[track]?.total ?? 0;
        const color = healthColor(scheduled, cfg.weekly);
        const pct = cfg.weekly > 0 ? Math.min(100, (scheduled / cfg.weekly) * 100) : 0;
        const barCls = color === "green" ? "bg-green-500" : color === "yellow" ? "bg-amber-400" : "bg-red-400";
        const textCls = color === "green" ? "text-green-400" : color === "yellow" ? "text-amber-400" : "text-red-400";
        return (
          <div key={track}>
            <button type="button" onClick={() => onOpenDetail({ title: `${TRACK_LABELS[track]} — all calendar time`, targetMins: cfg.weekly, items: contributors[track]?.all ?? [] })}
              className="group w-full rounded-md text-left outline-none hover:bg-muted">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium truncate group-hover:underline" style={{ color: TRACK_COLORS[track] }}>{TRACK_LABELS[track]}</span>
                <span className={`font-semibold shrink-0 ml-1 ${textCls}`}>{scheduled}m / {cfg.weekly}m</span>
              </div>
              <div className="relative mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${barCls}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
            {Object.entries(cfg.subTracks).map(([st, tgt]) => {
              const stSched = totals[track]?.sub[st] ?? 0;
              const stColor = healthColor(stSched, tgt);
              const stPct = tgt > 0 ? Math.min(100, (stSched / tgt) * 100) : 0;
              const stBar = stColor === "green" ? "bg-green-400" : stColor === "yellow" ? "bg-amber-300" : "bg-red-300";
              return (
                <div key={st} className="ml-2 mt-1">
                  <button type="button" onClick={() => onOpenDetail({ title: `${TRACK_LABELS[track]} — ${st}`, targetMins: tgt, items: contributors[track]?.bySub[st] ?? [] })}
                    className="group w-full rounded-md text-left outline-none hover:bg-muted">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="truncate group-hover:underline">{st}</span>
                      <span className="shrink-0 ml-1">{stSched}m / {tgt}m</span>
                    </div>
                    <div className="relative mt-0.5 h-1 rounded-full bg-muted overflow-hidden">
                      <div className={`absolute inset-y-0 left-0 rounded-full ${stBar}`} style={{ width: `${stPct}%` }} />
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}

function LibrarySidebar({
  taskLibrary,
  onDragStart,
  collapsedTracks,
  setCollapsedTracks,
}: {
  taskLibrary: TaskTemplate[];
  onDragStart: (task: TaskTemplate) => void;
  collapsedTracks: Record<string, boolean>;
  setCollapsedTracks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const active = taskLibrary.filter((t) => t.status === "Active");
  const byTrack: Record<string, Record<string, TaskTemplate[]>> = {};
  for (const t of active) {
    if (!byTrack[t.track]) byTrack[t.track] = {};
    const st = t.subTrack ?? "General";
    if (!byTrack[t.track][st]) byTrack[t.track][st] = [];
    byTrack[t.track][st].push(t);
  }
  return (
    <aside className="w-48 shrink-0 overflow-y-auto border-r border-border pr-2 pb-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Task Library</p>
      {Object.entries(byTrack).map(([track, subMap]) => {
        const isCollapsed = collapsedTracks[track];
        const color = TRACK_COLORS[track] ?? "#64748b";
        return (
          <div key={track} className="mb-2">
            <button type="button" onClick={() => setCollapsedTracks((p) => ({ ...p, [track]: !isCollapsed }))}
              className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] font-semibold hover:bg-muted" style={{ color }}>
              <span>{isCollapsed ? "▸" : "▾"}</span>
              {TRACK_LABELS[track] ?? track}
            </button>
            {!isCollapsed && Object.entries(subMap).map(([st, tasks]) => (
              <div key={st} className="ml-2 mt-1">
                <p className="mb-0.5 text-[10px] font-medium text-muted-foreground">{st}</p>
                {tasks.map((task) => (
                  <div key={task.id} draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", JSON.stringify({ type: "library", taskId: task.id }));
                      e.dataTransfer.effectAllowed = "copy";
                      onDragStart(task);
                    }}
                    className="mb-1 cursor-grab rounded border border-border bg-card px-2 py-1 text-[11px] shadow-sm active:cursor-grabbing hover:shadow-md transition-shadow"
                    style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
                    <div className="truncate font-medium text-foreground">{task.name}</div>
                    <div className="text-muted-foreground">{task.defaultTimeEstimate}m</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </aside>
  );
}

function CalendarEventBlock({
  ev,
  isPersonal,
  isUntaggedCosa,
  tag,
  onTagClick,
  onEdit,
}: {
  ev: GCalEvent;
  isPersonal?: boolean;
  isUntaggedCosa?: boolean;
  tag?: CalendarTag | null;
  onTagClick?: (ev: GCalEvent) => void;
  onEdit?: (ev: GCalEvent) => void;
}) {
  const priv = ev.extendedProperties?.private ?? {};
  const track = isPersonal ? tag?.track : priv.cosaTrack;
  const color = TRACK_COLORS[track ?? ""] ?? (isPersonal ? "#94a3b8" : "#64748b");
  const startMins = isoToMinutes(ev.start?.dateTime ?? "");
  const dur = eventDurationMins(ev);
  const top = minutesToPx(startMins);
  const height = Math.max(20, (dur / 60) * PX_PER_HOUR);
  const needsTag = (isPersonal && !tag) || isUntaggedCosa;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isPersonal || isUntaggedCosa) onTagClick?.(ev);
    else if (!needsTag) onEdit?.(ev);
  }

  const baseCls = isUntaggedCosa
    ? "border border-dashed border-amber-400/60 bg-amber-500/10 hover:bg-amber-500/20"
    : needsTag
    ? "border border-dashed border-border bg-muted hover:bg-muted/80"
    : "border-l-2 shadow-sm hover:brightness-95";

  return (
    <div className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] overflow-hidden group cursor-pointer ${baseCls}`}
      style={{ top, height, borderColor: needsTag ? undefined : color, backgroundColor: needsTag ? undefined : (isUntaggedCosa ? undefined : `${color}22`) }}
      onClick={handleClick}>
      <div className="flex items-start justify-between gap-0.5">
        <span className={`leading-tight font-medium truncate ${needsTag ? (isUntaggedCosa ? "text-amber-400" : "text-muted-foreground") : "text-foreground"}`}>
          {ev.summary ?? "(no title)"}
        </span>
        {(isPersonal || isUntaggedCosa) && (
          <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded p-0.5 text-muted-foreground">
            <Tag size={9} />
          </span>
        )}
      </div>
      {height >= 32 && (
        <div className={`leading-none ${isUntaggedCosa ? "text-amber-400" : "text-muted-foreground"}`}>
          {minsToTimeStr(startMins)} · {dur}m
        </div>
      )}
      {!needsTag && priv.cosaSubTrack && (
        <div className="truncate text-[9px] text-muted-foreground">{priv.cosaSubTrack}</div>
      )}
      {isPersonal && tag && (
        <div className="text-[9px]" style={{ color: TRACK_COLORS[tag.track] }}>
          {TRACK_LABELS[tag.track] ?? tag.track}{tag.subTrack ? ` · ${tag.subTrack}` : ""}
        </div>
      )}
    </div>
  );
}

const TRACK_SUB_TRACKS: Record<string, string[]> = {
  advisors:    ["Networking & Business Development", "Materials", "Product", "Client Work", "Back Office"],
  jobSearch:   ["Network Development & Outreach", "Searching", "Materials"],
  ventures:    ["Alpha", "Product", "Beta Prep"],
  networking:  [],
  development: [],
  cosaAdmin:   [],
};

function TagModal({
  ev,
  calendarTags,
  onSave,
  onClose,
}: {
  ev: GCalEvent;
  calendarTags: Record<string, CalendarTag>;
  onSave: (track: string, subTrack: string | null, kpiPayload: { kpiCredits: string[]; kpiQuantities: Record<string, number> }) => void;
  onClose: () => void;
}) {
  const existing = calendarTags[ev.id ?? ""];
  const [track, setTrack] = useState(existing?.track ?? "advisors");
  const [subTrack, setSubTrack] = useState(existing?.subTrack ?? "");
  const [kpiCredits, setKpiCredits] = useState<string[]>(existing?.kpiCredits ?? []);
  const [kpiQuantities, setKpiQuantities] = useState<Record<string, number>>(existing?.kpiQuantities ?? {});
  const kpiGroups = quickLogGroupsForTrack(track);

  function handleTrackChange(nextTrack: string) {
    setTrack(nextTrack);
    setSubTrack("");
    const valid = new Set(quickLogGroupsForTrack(nextTrack).flatMap((g) => g.kpis.map((k) => k.mapping)));
    setKpiCredits((prev) => prev.filter((m) => valid.has(m)));
    setKpiQuantities((prev) => Object.fromEntries(Object.entries(prev).filter(([m]) => valid.has(m))));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-card border border-border shadow-xl">
        <div className="overflow-y-auto p-5">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Tag Calendar Event</h3>
          <p className="mb-4 text-xs text-muted-foreground truncate">{ev?.summary}</p>
          <label className="mb-1 block text-xs font-medium text-foreground">Track</label>
          <select value={track} onChange={(e) => handleTrackChange(e.target.value)}
            className="mb-3 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring">
            {Object.entries(TRACK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="mb-1 block text-xs font-medium text-foreground">Sub-track (optional)</label>
          <select value={subTrack} onChange={(e) => setSubTrack(e.target.value)}
            className="mb-4 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring">
            <option value="">— none —</option>
            {(TRACK_SUB_TRACKS[track] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-semibold text-foreground">KPI credits (optional)</p>
            <p className="mb-2 text-[11px] text-muted-foreground">Check outcomes this block contributed toward for weekly review.</p>
            {kpiGroups.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No KPI list for this track — time still counts toward allocations.</p>
            ) : (
              <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
                {kpiGroups.map((grp) => (
                  <div key={grp.group}>
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: grp.color }} />
                      {grp.group}
                    </p>
                    <div className="space-y-1">
                      {grp.kpis.map(({ mapping, label }) => {
                        const checked = kpiCredits.includes(mapping);
                        const qty = kpiQuantities[mapping] ?? 1;
                        return (
                          <div key={mapping} className="flex items-center gap-2">
                            <label className="flex flex-1 cursor-pointer items-center gap-2">
                              <input type="checkbox" checked={checked}
                                onChange={() => {
                                  setKpiCredits((prev) => checked ? prev.filter((m) => m !== mapping) : [...prev, mapping]);
                                  setKpiQuantities((prev) => { if (checked) { const { [mapping]: _, ...rest } = prev; return rest; } return { ...prev, [mapping]: prev[mapping] ?? 1 }; });
                                }}
                                className="h-3.5 w-3.5 rounded" />
                              <span className="text-xs text-foreground">{label}</span>
                            </label>
                            {checked && (
                              <div className="flex items-center gap-0.5">
                                <button type="button" onClick={() => setKpiQuantities((p) => ({ ...p, [mapping]: Math.max(1, (p[mapping] ?? 1) - 1) }))}
                                  className="flex h-5 w-5 items-center justify-center rounded border border-border text-[10px] text-muted-foreground hover:bg-muted">−</button>
                                <span className="w-6 text-center text-xs font-medium text-foreground">{qty}</span>
                                <button type="button" onClick={() => setKpiQuantities((p) => ({ ...p, [mapping]: (p[mapping] ?? 1) + 1 }))}
                                  className="flex h-5 w-5 items-center justify-center rounded border border-border text-[10px] text-muted-foreground hover:bg-muted">+</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 border-t border-border p-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button type="button" onClick={() => onSave(track, subTrack || null, { kpiCredits, kpiQuantities: Object.fromEntries(kpiCredits.map((m) => [m, kpiQuantities[m] ?? 1])) })}
            className="flex-1 rounded-lg bg-foreground py-2 text-sm font-semibold text-background hover:bg-foreground/90">Save Tag</button>
        </div>
      </div>
    </div>
  );
}

function LogBehindModal({
  date,
  defaultStartMins,
  onSave,
  onClose,
}: {
  date: string;
  defaultStartMins: number;
  onSave: (d: { name: string; track: string; subTrack: string | null; startMins: number; endMins: number }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [track, setTrack] = useState("advisors");
  const [subTrack, setSubTrack] = useState("");
  const [startMins, setStartMins] = useState(defaultStartMins ?? 9 * 60);
  const [durationMins, setDurationMins] = useState(30);

  const toT = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const fromT = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };

  const cls = "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-80 rounded-xl bg-card border border-border p-5 shadow-xl">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Log Activity</h3>
        <p className="mb-3 text-xs text-muted-foreground">{date}</p>
        <label className="mb-1 block text-xs font-medium text-foreground">Activity name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="What did you work on?" className={`mb-3 ${cls}`} autoFocus />
        <label className="mb-1 block text-xs font-medium text-foreground">Track</label>
        <select value={track} onChange={(e) => { setTrack(e.target.value); setSubTrack(""); }} className={`mb-3 ${cls}`}>
          {Object.entries(TRACK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="mb-1 block text-xs font-medium text-foreground">Sub-track</label>
        <select value={subTrack} onChange={(e) => setSubTrack(e.target.value)} className={`mb-3 ${cls}`}>
          <option value="">— none —</option>
          {(TRACK_SUB_TRACKS[track] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Start time</label>
            <input type="time" value={toT(startMins)} onChange={(e) => setStartMins(fromT(e.target.value))} className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Duration (min)</label>
            <input type="number" min={5} max={480} value={durationMins} onChange={(e) => setDurationMins(Number(e.target.value))} className={cls} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button type="button" disabled={!name.trim()}
            onClick={() => onSave({ name: name.trim(), track, subTrack: subTrack || null, startMins, endMins: startMins + durationMins })}
            className="flex-1 rounded-lg bg-foreground py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-40">Log It</button>
        </div>
      </div>
    </div>
  );
}

function EditEventModal({
  ev,
  onSave,
  onDelete,
  onClose,
}: {
  ev: GCalEvent;
  onSave: (eventId: string, d: { name: string; track: string; subTrack: string | null; startISO: string; endISO: string }) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
  onClose: () => void;
}) {
  const priv = ev.extendedProperties?.private ?? {};
  const startMinsInit = isoToMinutes(ev.start?.dateTime ?? "");
  const dur = eventDurationMins(ev);
  const [name, setName] = useState(ev.summary ?? "");
  const [track, setTrack] = useState(priv.cosaTrack ?? "advisors");
  const [subTrack, setSubTrack] = useState(priv.cosaSubTrack ?? "");
  const [startMins, setStartMins] = useState(startMinsInit);
  const [durationMins, setDurationMins] = useState(dur || 30);
  const [saving, setSaving] = useState(false);
  const dateStr = ev.start?.dateTime?.slice(0, 10) ?? "";
  const toT = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const fromT = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };
  const cls = "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring";

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(ev.id ?? "", { name: name.trim(), track, subTrack: subTrack || null, startISO: buildISO(dateStr, startMins), endISO: buildISO(dateStr, startMins + durationMins) });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-80 rounded-xl bg-card border border-border p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Edit Calendar Event</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted"><X size={14} className="text-muted-foreground" /></button>
        </div>
        <label className="mb-1 block text-xs font-medium text-foreground">Event name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus className={`mb-3 ${cls}`} />
        <label className="mb-1 block text-xs font-medium text-foreground">Track</label>
        <select value={track} onChange={(e) => { setTrack(e.target.value); setSubTrack(""); }} className={`mb-3 ${cls}`}>
          {Object.entries(TRACK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="mb-1 block text-xs font-medium text-foreground">Sub-track</label>
        <select value={subTrack} onChange={(e) => setSubTrack(e.target.value)} className={`mb-3 ${cls}`}>
          <option value="">— none —</option>
          {(TRACK_SUB_TRACKS[track] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Start time</label>
            <input type="time" value={toT(startMins)} onChange={(e) => setStartMins(fromT(e.target.value))} className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Duration (min)</label>
            <input type="number" min={5} max={480} value={durationMins} onChange={(e) => setDurationMins(Number(e.target.value))} className={cls} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onDelete(ev.id ?? "")} className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10">Delete</button>
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button type="button" disabled={!name.trim() || saving} onClick={handleSave}
            className="flex-1 rounded-lg bg-foreground py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TimeGrid({
  weekDates,
  weekEvents,
  untaggedCosaEvents,
  personalEvents,
  calendarTags,
  draggingTask,
  onDropLibraryTask,
  onDeleteEvent,
  onTagEvent,
  onEditEvent,
  onLogBehind,
}: {
  weekDates: { name: string; date: string }[];
  weekEvents: GCalEvent[];
  untaggedCosaEvents: GCalEvent[];
  personalEvents: GCalEvent[];
  calendarTags: Record<string, CalendarTag>;
  draggingTask: TaskTemplate | null;
  onDropLibraryTask: (taskId: string, dateStr: string, startMins: number) => void;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onTagEvent: (ev: GCalEvent) => void;
  onEditEvent: (ev: GCalEvent) => void;
  onLogBehind: (dateStr: string, startMins: number) => void;
}) {
  const TOTAL_HOURS = GRID_END_HOUR - GRID_START_HOUR;
  const gridHeight = TOTAL_HOURS * PX_PER_HOUR;
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => GRID_START_HOUR + i);
  const today = new Date().toISOString().split("T")[0];

  const eventsByDate: Record<string, GCalEvent[]> = {};
  const untaggedByDate: Record<string, GCalEvent[]> = {};
  const personalByDate: Record<string, GCalEvent[]> = {};

  for (const ev of weekEvents) {
    const d = ev.start?.dateTime?.slice(0, 10);
    if (d) { if (!eventsByDate[d]) eventsByDate[d] = []; eventsByDate[d].push(ev); }
  }
  for (const ev of untaggedCosaEvents) {
    const d = ev.start?.dateTime?.slice(0, 10);
    if (d) { if (!untaggedByDate[d]) untaggedByDate[d] = []; untaggedByDate[d].push(ev); }
  }
  for (const ev of personalEvents) {
    const d = ev.start?.dateTime?.slice(0, 10);
    if (d) { if (!personalByDate[d]) personalByDate[d] = []; personalByDate[d].push(ev); }
  }

  function getDropMins(e: React.DragEvent, el: HTMLElement): number {
    const rect = el.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const rawMins = pxToMinutes(relY);
    const snapped = snapMinutes(rawMins);
    return Math.max(GRID_START_HOUR * 60, Math.min((GRID_END_HOUR - 0.5) * 60, snapped));
  }

  return (
    <div className="flex flex-1 overflow-x-auto">
      <div className="shrink-0 w-10 pr-1 flex flex-col">
        <div className="sticky top-0 z-10 border-b border-transparent px-1 py-1 text-xs"><div>&nbsp;</div><div className="text-[10px]">&nbsp;</div></div>
        <div className="relative" style={{ height: gridHeight }}>
          {hours.map((h) => (
            <div key={h} className="absolute right-1 text-[9px] text-muted-foreground leading-none"
              style={{ top: (h - GRID_START_HOUR) * PX_PER_HOUR, transform: "translateY(-50%)" }}>
              {h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`}
            </div>
          ))}
        </div>
      </div>

      {weekDates.map(({ name, date }) => {
        const isToday = date === today;
        return (
          <div key={date} className="min-w-[100px] flex-1 border-l border-border">
            <div className={`sticky top-0 z-10 border-b border-border px-1 py-1 text-center text-xs font-semibold ${isToday ? "bg-foreground text-background" : "bg-card text-muted-foreground"}`}>
              <div>{name.slice(0, 3)}</div>
              <div className="text-[10px] font-normal opacity-70">{date.slice(5)}</div>
            </div>
            <div
              className={`relative cursor-crosshair ${draggingTask ? "bg-foreground/5" : ""}`}
              style={{ height: gridHeight }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={(e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData("text/plain");
                if (!raw) return;
                const data = JSON.parse(raw);
                if (data.type === "library") onDropLibraryTask(data.taskId, date, getDropMins(e, e.currentTarget));
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const relY = e.clientY - rect.top;
                const snapped = snapMinutes(pxToMinutes(relY));
                onLogBehind(date, Math.max(GRID_START_HOUR * 60, Math.min((GRID_END_HOUR - 0.5) * 60, snapped)));
              }}>
              {hours.map((h) => <div key={h} className="absolute left-0 right-0 border-t border-border/30" style={{ top: (h - GRID_START_HOUR) * PX_PER_HOUR }} />)}
              {hours.slice(0, -1).map((h) => <div key={`${h}-half`} className="absolute left-0 right-0 border-t border-border/10" style={{ top: (h - GRID_START_HOUR) * PX_PER_HOUR + PX_PER_HOUR / 2 }} />)}
              {(personalByDate[date] ?? []).map((ev) => <CalendarEventBlock key={ev.id} ev={ev} isPersonal tag={calendarTags[ev.id ?? ""] ?? null} onTagClick={onTagEvent} />)}
              {(untaggedByDate[date] ?? []).map((ev) => <CalendarEventBlock key={ev.id} ev={ev} isUntaggedCosa tag={null} onTagClick={onTagEvent} />)}
              {(eventsByDate[date] ?? []).map((ev) => <CalendarEventBlock key={ev.id} ev={ev} isPersonal={false} tag={null} onEdit={onEditEvent} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function WeekPlannerClient({
  initialWeekData,
  initialMondayStr,
  initialAllocations,
  taskLibrary,
}: {
  initialWeekData: CalendarWeekData;
  initialMondayStr: string;
  initialAllocations: AllocationsMap;
  taskLibrary: TaskTemplate[];
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekData, setWeekData] = useState<CalendarWeekData>(initialWeekData);
  const [allocations, setAllocations] = useState<AllocationsMap>(initialAllocations);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draggingTask, setDraggingTask] = useState<TaskTemplate | null>(null);
  const [tagModal, setTagModal] = useState<GCalEvent | null>(null);
  const [editModal, setEditModal] = useState<GCalEvent | null>(null);
  const [logModal, setLogModal] = useState<{ date: string; startMins: number } | null>(null);
  const [showAllocEditor, setShowAllocEditor] = useState(false);
  const [healthDetail, setHealthDetail] = useState<{ title: string; targetMins: number; items: HealthContributor[] } | null>(null);
  const [collapsedTracks, setCollapsedTracks] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const gridScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gridScrollRef.current) {
      gridScrollRef.current.scrollTop = (8 - GRID_START_HOUR) * PX_PER_HOUR;
    }
  }, []);

  const mondayStr = getWeekMondayStr(weekOffset) || initialMondayStr;

  useEffect(() => {
    if (weekOffset === 0) return; // initial data already loaded
    setLoading(true);
    setError("");
    fetchCalendarWeek(mondayStr)
      .then(setWeekData)
      .catch(() => setError("Failed to load calendar events."))
      .finally(() => setLoading(false));
  }, [mondayStr, weekOffset]);

  const weekDates = getWeekDates(mondayStr);
  const weekRangeStart = weekDates[0].date;
  const weekRangeEnd = weekDates[weekDates.length - 1].date;

  const trackTargets = useMemo(() => allocationsToTrackTargets(allocations), [allocations]);

  const healthModel = useMemo(
    () => buildCalendarHealthModel(weekData.weekEvents, weekData.calendarTags, trackTargets, weekRangeStart, weekRangeEnd),
    [weekData.weekEvents, weekData.calendarTags, trackTargets, weekRangeStart, weekRangeEnd]
  );

  function refresh() {
    setLoading(true);
    setError("");
    fetchCalendarWeek(mondayStr)
      .then(setWeekData)
      .catch(() => setError("Failed to load calendar events."))
      .finally(() => setLoading(false));
  }

  async function handleDropLibraryTask(taskId: string, dateStr: string, startMins: number) {
    const task = taskLibrary.find((t) => t.id === taskId);
    if (!task) return;
    const dur = task.defaultTimeEstimate ?? 30;
    const result = await createCalendarEvent({
      name: task.name,
      track: task.track,
      subTrack: task.subTrack,
      templateId: task.id,
      startISO: buildISO(dateStr, startMins),
      endISO: buildISO(dateStr, startMins + dur),
      userTz: getUserTz(),
    });
    if (result.ok) {
      setWeekData((prev) => ({ ...prev, weekEvents: [...prev.weekEvents, result.event] }));
    } else {
      setError(result.error);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    const result = await deleteCalendarEvent(eventId);
    if (result.ok) {
      setWeekData((prev) => ({
        ...prev,
        weekEvents: prev.weekEvents.filter((e) => e.id !== eventId),
      }));
    }
    setEditModal(null);
  }

  async function handleSaveEdit(eventId: string, data: { name: string; track: string; subTrack: string | null; startISO: string; endISO: string }) {
    const result = await updateCalendarEvent({ eventId, ...data, userTz: getUserTz() });
    if (result.ok) {
      setWeekData((prev) => ({
        ...prev,
        weekEvents: prev.weekEvents.map((e) => (e.id === eventId ? result.event : e)),
      }));
    }
    setEditModal(null);
  }

  async function handleSaveTag(track: string, subTrack: string | null, kpiPayload: { kpiCredits: string[]; kpiQuantities: Record<string, number> }) {
    if (!tagModal) return;
    const ev = tagModal;
    const dur = eventDurationMins(ev);
    const date = ev.start?.dateTime ? ev.start.dateTime.slice(0, 10) : undefined;
    const tag: CalendarTag = { track, subTrack, title: ev.summary, durationMin: dur, date, ...kpiPayload };

    const isCosaUntagged = weekData.untaggedCosaEvents.some((e) => e.id === ev.id);
    if (isCosaUntagged) {
      const result = await updateCalendarEvent({ eventId: ev.id ?? "", name: ev.summary ?? "(untitled)", track, subTrack, startISO: ev.start?.dateTime ?? "", endISO: ev.end?.dateTime ?? "", userTz: getUserTz() });
      if (result.ok) {
        setWeekData((prev) => ({
          ...prev,
          weekEvents: [...prev.weekEvents, result.event],
          untaggedCosaEvents: prev.untaggedCosaEvents.filter((e) => e.id !== ev.id),
        }));
      }
    }

    await upsertCalendarTag(ev.id ?? "", tag);
    setWeekData((prev) => ({ ...prev, calendarTags: { ...prev.calendarTags, [ev.id ?? ""]: tag } }));
    setTagModal(null);
  }

  async function handleSaveLog(data: { name: string; track: string; subTrack: string | null; startMins: number; endMins: number }) {
    if (!logModal) return;
    const result = await createCalendarEvent({
      name: data.name,
      track: data.track,
      subTrack: data.subTrack,
      startISO: buildISO(logModal.date, data.startMins),
      endISO: buildISO(logModal.date, data.endMins),
      userTz: getUserTz(),
    });
    if (result.ok) {
      setWeekData((prev) => ({ ...prev, weekEvents: [...prev.weekEvents, result.event] }));
    }
    setLogModal(null);
  }

  function handleSaveAllocations(next: AllocationsMap) {
    setAllocations(next);
    setShowAllocEditor(false);
    startTransition(async () => { await saveAllocations(next); });
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3rem)" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setWeekOffset((w) => w - 1)} className="rounded-md p-1 hover:bg-muted text-muted-foreground"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-foreground">{formatWeekLabel(mondayStr)}</span>
          <button type="button" onClick={() => setWeekOffset((w) => w + 1)} className="rounded-md p-1 hover:bg-muted text-muted-foreground"><ChevronRight size={16} /></button>
          {weekOffset !== 0 && (
            <button type="button" onClick={() => setWeekOffset(0)} className="ml-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted">Today</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(loading || isPending) && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          {error && <span className="text-xs text-destructive">{error}</span>}
          {!weekData.googleConnected && (
            <a href="/settings" className="text-xs text-amber-400 hover:underline">Connect Google to sync calendar</a>
          )}
          <button type="button" onClick={refresh} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">Refresh</button>
          <button type="button" onClick={() => setLogModal({ date: weekDates[0].date, startMins: 9 * 60 })}
            className="flex items-center gap-1 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background hover:bg-foreground/90">
            <Plus size={12} /> Log Activity
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 gap-3 overflow-hidden px-3 pt-3">
        <LibrarySidebar taskLibrary={taskLibrary} onDragStart={setDraggingTask} collapsedTracks={collapsedTracks} setCollapsedTracks={setCollapsedTracks} />
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div ref={gridScrollRef} className="flex flex-1 overflow-y-auto overflow-x-auto">
            <TimeGrid
              weekDates={weekDates}
              weekEvents={weekData.weekEvents}
              untaggedCosaEvents={weekData.untaggedCosaEvents}
              personalEvents={weekData.personalEvents}
              calendarTags={weekData.calendarTags}
              draggingTask={draggingTask}
              onDropLibraryTask={handleDropLibraryTask}
              onDeleteEvent={handleDeleteEvent}
              onTagEvent={setTagModal}
              onEditEvent={setEditModal}
              onLogBehind={(dateStr, startMins) => setLogModal({ date: dateStr, startMins })}
            />
          </div>
        </div>
        <HealthBars healthModel={healthModel} trackTargets={trackTargets} onEditAllocations={() => setShowAllocEditor(true)} onOpenDetail={setHealthDetail} />
      </div>

      {/* Modals */}
      <HealthDetailModal detail={healthDetail} onClose={() => setHealthDetail(null)} />
      {showAllocEditor && <AllocationEditor allocations={allocations} onSave={handleSaveAllocations} onClose={() => setShowAllocEditor(false)} />}
      {tagModal && <TagModal key={tagModal.id} ev={tagModal} calendarTags={weekData.calendarTags} onSave={handleSaveTag} onClose={() => setTagModal(null)} />}
      {logModal && <LogBehindModal date={logModal.date} defaultStartMins={logModal.startMins} onSave={handleSaveLog} onClose={() => setLogModal(null)} />}
      {editModal && <EditEventModal ev={editModal} onSave={handleSaveEdit} onDelete={handleDeleteEvent} onClose={() => setEditModal(null)} />}
    </div>
  );
}
