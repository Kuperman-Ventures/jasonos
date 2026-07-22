"use client";

// Networking Activity — a thin, week-by-week feed of what you DID: conversations
// had, new contacts added, thank-yous sent, referrals received. Current week
// (Wednesday to Tuesday) on top, history scrolling below. No "what wasn't done".
// The "Weekly PDF" prints the current week for the advisor hand-off.

import { useState } from "react";
import { Network, Download, Sparkles, Repeat, Briefcase } from "lucide-react";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import {
  TierDegreeBadge,
  tierDegreeLabel,
} from "@/components/jasonos/outreach/tier-degree-badge";
import type {
  NetworkingActivity,
  NsConversation,
  NyuiWeekSummary,
  WeekActivity,
} from "@/lib/server-actions/networking-status";

function fmt(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtShort(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function escHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Ordinal for "spoken to repeatedly" — priorContactCount is how many talks came
// before, so this conversation is the (count + 1)-th.
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function weekTitle(w: WeekActivity): string {
  return w.isCurrent ? "This week" : `Week of ${fmtShort(w.weekStart)}`;
}

export function NetworkingActivityClient({ data }: { data: NetworkingActivity }) {
  const current = data.weeks.find((w) => w.isCurrent) ?? data.weeks[0];
  const [target, setTarget] = useState<NsConversation | null>(null);

  function downloadWeeklyPdf() {
    if (!current) return;
    const title = current.isCurrent
      ? "This week"
      : `Week of ${fmtShort(current.weekStart)}`;
    const range = `${fmt(current.weekStart)} through ${fmt(current.weekEnd)}`;
    const chips = [
      { label: "conversations", value: current.stats.conversations },
      { label: "thank-yous", value: current.stats.thankYous },
      { label: "referrals", value: current.stats.referrals },
    ]
      .filter((c) => c.value > 0)
      .map((c) => `<span class="chip"><b>${c.value}</b> ${c.label}</span>`)
      .join("");

    const nr = newRepeatHtml(current);
    const apps = nyuiHtml(current);

    const f = current.funnel;
    const target = data.goalTarget || 10;
    const goalPct = Math.min(100, Math.round((f.freshOutreach / target) * 100));
    const goalMet = f.freshOutreach >= target;
    const cum = data.cumulative;
    const goalCard = `<section class="card">
        <div class="card-h">Weekly outreach goal</div>
        <div class="card-b">
          <div class="nr-legend"><span><b>${f.freshOutreach}</b> / ${target} fresh outreach</span><span class="muted">people not contacted in the last 30 days</span></div>
          <div class="bar"><div style="width:${goalPct}%;background:${goalMet ? "#10b981" : "#38bdf8"}"></div></div>
          <div class="chips" style="margin-top:12px;">
            <span class="chip"><b>${f.reachedOut}</b> reached out</span>
            <span class="chip"><b>${f.replied}</b> replied</span>
            <span class="chip"><b>${f.metHeld}</b> met &middot; held</span>
          </div>
          <p class="sub" style="margin-top:8px;">All-time: reached ${cum.reachedOut} of ${cum.listSize} networking contacts &middot; ${cum.replied} replied &middot; ${cum.metHeld} met</p>
        </div>
      </section>`;

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
      <title>Jason Kuperman — Networking Activity — ${escHtml(range)}</title>
      <style>
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;background:#fff;margin:0;padding:24px;max-width:960px;}
        .eyebrow{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#059669;}
        h1{font-size:24px;font-weight:800;color:#0f172a;margin:5px 0 2px;}
        .sub{color:#64748b;font-size:12px;margin:0;}
        .chips{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 4px;}
        .chip{border:1px solid #e2e8f0;border-radius:999px;padding:3px 11px;font-size:11px;color:#475569;}
        .chip b{color:#0f172a;font-weight:700;}
        .card{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-top:16px;page-break-inside:avoid;}
        .card-h{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#334155;}
        .card-b{padding:14px;}
        .heat{display:flex;flex-direction:column;gap:5px;max-width:440px;}
        .hrow{display:grid;gap:5px;align-items:center;}
        .hc{font-size:10px;font-weight:600;color:#64748b;text-align:center;}
        .hrl-h{font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;}
        .hrl{font-size:13px;font-weight:800;}
        .hcell{position:relative;height:30px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:12px;font-weight:700;color:#0f172a;}
        .htot{text-align:right;font-size:12px;font-weight:800;color:#0f172a;}
        .ndot{position:absolute;top:3px;right:3px;width:6px;height:6px;border-radius:50%;background:#f59e0b;}
        .legend{color:#94a3b8;font-size:10px;margin:10px 0 0;line-height:1.5;}
        .ilegend{display:inline-block;width:6px;height:6px;border-radius:50%;background:#f59e0b;vertical-align:middle;}
        .nr-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:#334155;align-items:center;}
        .nr-legend b{color:#0f172a;}
        .dot{display:inline-block;width:9px;height:9px;border-radius:50%;vertical-align:middle;margin-right:5px;}
        .dot.amber{background:#f59e0b;} .dot.sky{background:#38bdf8;}
        .bar{display:flex;height:8px;border-radius:999px;overflow:hidden;background:#e2e8f0;margin-top:10px;max-width:440px;}
        .bar-new{background:#f59e0b;} .bar-rep{background:#38bdf8;}
        .muted{color:#94a3b8;}
        .sub2{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:14px 0 6px;}
        ul.list{list-style:none;margin:0;padding:0;border:1px solid #e2e8f0;border-radius:10px;}
        ul.list li{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:6px 12px;font-size:12px;color:#1e293b;border-top:1px solid #f1f5f9;}
        ul.list li:first-child{border-top:none;}
        ul.list li b{font-weight:600;}
        .li-main{min-width:0;}
        .li-date{color:#94a3b8;font-size:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-right:2px;}
        .li-right{display:flex;gap:6px;flex-shrink:0;align-items:center;}
        .li-meta{flex-shrink:0;color:#64748b;font-size:10px;border:1px solid #e2e8f0;border-radius:999px;padding:1px 8px;white-space:nowrap;}
        .li-meta.ok{color:#047857;border-color:#a7f3d0;background:#ecfdf5;}
        .li-meta.warn{color:#b45309;border-color:#fde68a;background:#fffbeb;}
        .li-meta.bad{color:#b91c1c;border-color:#fecaca;background:#fef2f2;}
        .li-meta.neutral{color:#64748b;border-color:#e2e8f0;}
        .empty{color:#94a3b8;font-size:12px;font-style:italic;margin:0;}
        .foot{margin-top:28px;border-top:1px solid #e2e8f0;padding-top:10px;color:#94a3b8;font-size:10px;}
        @media print{body{padding:9mm;}}
      </style></head><body>
      <div class="head">
        <div class="eyebrow">Jason Kuperman's Networking Activity</div>
        <h1>${escHtml(title)}</h1>
        <p class="sub">Week of ${escHtml(range)} · Wednesday to Tuesday</p>
      </div>
      ${chips ? `<div class="chips">${chips}</div>` : ""}
      ${goalCard}
      <section class="card">
        <div class="card-h">This Week's Conversation Log</div>
        <div class="card-b">${heatmapHtml(current.conversations)}</div>
      </section>
      ${
        nr
          ? `<section class="card"><div class="card-h">New vs. repeat</div><div class="card-b">${nr}</div></section>`
          : ""
      }
      ${
        apps
          ? `<section class="card"><div class="card-h">Search Activity (${current.nyui.applicationCount})</div><div class="card-b">${apps}</div></section>`
          : ""
      }
      <div class="foot">JasonOS &middot; Networking activity &middot; ${escHtml(range)}. Reporting week runs Wednesday to Tuesday.</div>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-300">
            <Network className="h-4 w-4" />
            Networking Activity
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            What you did, week by week
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wednesday to Tuesday. This week on top, history below. Derived from
            your outreach data.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadWeeklyPdf}
          className="inline-flex items-center gap-2 self-start rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted/80"
        >
          <Download className="h-4 w-4" />
          Weekly PDF
        </button>
      </header>

      <FunnelSummary data={data} />

      {data.weeks.map((w) => (
        <WeekCard key={w.weekStart} w={w} onOpenContact={setTarget} />
      ))}

      <OutreachModal
        open={!!target}
        onOpenChange={(o) => {
          if (!o) setTarget(null);
        }}
        contactId={target?.contactId}
        initialDisplay={
          target ? { name: target.name, title: null, firm: target.firm } : undefined
        }
      />
    </div>
  );
}

// Top-of-report summary: the weekly fresh-outreach goal + the reach → reply →
// meeting funnel (this week) and all-time coverage of the networking list.
function FunnelSummary({ data }: { data: NetworkingActivity }) {
  const current = data.weeks.find((w) => w.isCurrent) ?? data.weeks[0];
  if (!current) return null;
  const f = current.funnel;
  const target = data.goalTarget || 10;
  const pct = Math.min(100, Math.round((f.freshOutreach / target) * 100));
  const met = f.freshOutreach >= target;
  const cum = data.cumulative;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      {/* Weekly fresh-outreach goal */}
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold tracking-tight">Weekly outreach goal</span>
          <span className="tabular-nums text-muted-foreground">
            {f.freshOutreach} / {target}
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full ${met ? "bg-emerald-400" : "bg-sky-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Fresh outreach — people you hadn&rsquo;t contacted in the last 30 days.{" "}
          {met
            ? "Goal met."
            : `${target - f.freshOutreach} to go this week.`}
        </p>
      </div>

      {/* This week's funnel */}
      <div className="grid grid-cols-3 gap-2">
        <FunnelStat label="Reached out" value={f.reachedOut} />
        <FunnelStat label="Replied" value={f.replied} />
        <FunnelStat label="Met · held" value={f.metHeld} />
      </div>

      {/* All-time coverage */}
      <p className="text-[11px] text-muted-foreground">
        All-time: reached{" "}
        <span className="font-semibold text-foreground">{cum.reachedOut}</span> of{" "}
        {cum.listSize} networking contacts ·{" "}
        <span className="font-semibold text-foreground">{cum.replied}</span> replied
        · <span className="font-semibold text-foreground">{cum.metHeld}</span> met
      </p>
    </section>
  );
}

function FunnelStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function WeekCard({
  w,
  onOpenContact,
}: {
  w: WeekActivity;
  onOpenContact: (c: NsConversation) => void;
}) {
  const chips: { label: string; value: number }[] = [
    { label: "thank-yous", value: w.stats.thankYous },
    { label: "referrals", value: w.stats.referrals },
  ].filter((c) => c.value > 0);

  const quiet =
    w.conversations.length === 0 && w.newContacts.length === 0 && chips.length === 0;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{weekTitle(w)}</h2>
          <span className="text-[11px] text-muted-foreground">
            {fmtShort(w.weekStart)} – {fmt(w.weekEnd)}
          </span>
          {w.isCurrent ? (
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
              Current
            </span>
          ) : null}
        </div>
        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                <span className="font-semibold tabular-nums text-foreground">
                  {c.value}
                </span>
                {c.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {w.conversations.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          {quiet
            ? "No activity logged yet this week."
            : "No conversations logged this week."}
        </p>
      ) : (
        <div className="p-4">
          <WeekHeatmap conversations={w.conversations} onOpenContact={onOpenContact} />
        </div>
      )}

      <NyuiPanel nyui={w.nyui} />
    </section>
  );
}

// Job applications (NYUI work searches) logged inside this reporting week.
// Aligned to the Wed→Tue reporting week — count + the company/position for
// each. Business hours are intentionally excluded from this report.
function NyuiPanel({ nyui }: { nyui: NyuiWeekSummary }) {
  if (nyui.applicationCount === 0) return null;

  return (
    <div className="border-t bg-muted/10 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Briefcase className="h-3.5 w-3.5 text-violet-300" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Search Activity
        </h3>
        <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-violet-300">
          {nyui.applicationCount}
        </span>
      </div>
      <ul className="divide-y divide-border/40 rounded-lg border border-border bg-background/40">
        {nyui.applications.map((a, i) => (
          <li
            key={i}
            className="flex items-baseline justify-between gap-2 px-3 py-1.5 text-xs"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {fmtShort(a.date)}
              </span>
              <span className="min-w-0">
                <span className="font-medium text-foreground">{a.company}</span>
                <span className="text-muted-foreground"> · {a.position}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {a.method}
              </span>
              {a.result && a.result !== "—" ? (
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[10px] ${RESULT_PILL[resultTone(a.result)]}`}
                >
                  {a.result}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Relevance × closeness heatmap — the graphic. Rows = relevance (A best → C),
// columns = closeness (1 = know well → 3). Cell = # conversations that week.
// ---------------------------------------------------------------------------

const TIER_META: Record<string, { label: string; text: string }> = {
  A: { label: "A", text: "text-emerald-300" },
  B: { label: "B", text: "text-sky-300" },
  C: { label: "C", text: "text-slate-300" },
  "—": { label: "Unclass.", text: "text-muted-foreground" },
};

function buildMatrix(conversations: NsConversation[]) {
  const grid: Record<string, Record<number, number>> = {
    A: { 1: 0, 2: 0, 3: 0, 0: 0 },
    B: { 1: 0, 2: 0, 3: 0, 0: 0 },
    C: { 1: 0, 2: 0, 3: 0, 0: 0 },
    "—": { 1: 0, 2: 0, 3: 0, 0: 0 },
  };
  // Parallel grid counting only first-ever ("new") communications, so we can
  // flag which squares landed a brand-new contact this week.
  const newGrid: Record<string, Record<number, number>> = {
    A: { 1: 0, 2: 0, 3: 0, 0: 0 },
    B: { 1: 0, 2: 0, 3: 0, 0: 0 },
    C: { 1: 0, 2: 0, 3: 0, 0: 0 },
    "—": { 1: 0, 2: 0, 3: 0, 0: 0 },
  };
  let hasUnclassified = false;
  let hasUnknownDeg = false;
  for (const c of conversations) {
    const t = c.tier === "A" || c.tier === "B" || c.tier === "C" ? c.tier : "—";
    if (t === "—") hasUnclassified = true;
    const d = c.degree === 1 || c.degree === 2 || c.degree === 3 ? c.degree : 0;
    if (d === 0) hasUnknownDeg = true;
    grid[t][d] += 1;
    if (c.isFirstContact) newGrid[t][d] += 1;
  }
  const rows = hasUnclassified ? ["A", "B", "C", "—"] : ["A", "B", "C"];
  const cols: number[] = hasUnknownDeg ? [1, 2, 3, 0] : [1, 2, 3];
  let max = 1;
  const rowTotals: Record<string, number> = {};
  for (const r of rows) {
    let tot = 0;
    for (const col of cols) {
      const v = grid[r][col];
      tot += v;
      if (v > max) max = v;
    }
    rowTotals[r] = tot;
  }
  return { grid, newGrid, rows, cols, max, rowTotals };
}

function cellBg(count: number, max: number): string {
  if (count <= 0) return "rgba(148,163,184,0.06)";
  const alpha = 0.16 + 0.6 * (count / max);
  return `rgba(16,185,129,${alpha.toFixed(3)})`;
}

function colLabel(deg: number): string {
  return deg === 0 ? "?" : String(deg);
}

// Tier accent colors for the printable heatmap row labels, echoing the
// on-screen tier colors (A emerald, B sky, C slate, unclassified muted).
const TIER_HEX: Record<string, string> = {
  A: "#059669",
  B: "#0284c7",
  C: "#475569",
  "—": "#94a3b8",
};

// Relevance × closeness heatmap rendered as a CSS-grid graphic for the
// printable PDF — mirrors the on-screen grid (rounded emerald cells, tier-
// colored row labels, per-row totals, and an amber dot on any square that
// landed a first-ever contact).
function heatmapHtml(conversations: NsConversation[]): string {
  if (conversations.length === 0) {
    return '<p class="empty">No conversations logged this week.</p>';
  }
  const { grid, newGrid, rows, cols, max, rowTotals } = buildMatrix(conversations);
  const gridCols = `grid-template-columns:76px repeat(${cols.length},1fr) 46px`;
  const head = `<div class="hrow" style="${gridCols}"><div class="hrl-h"></div>${cols
    .map((d) => `<div class="hc">${escHtml(colLabel(d))}</div>`)
    .join("")}<div class="hc">Total</div></div>`;
  const body = rows
    .map((r) => {
      const cells = cols
        .map((d) => {
          const count = grid[r][d];
          const newCount = newGrid[r][d];
          const bg =
            count > 0
              ? `rgba(16,185,129,${(0.16 + 0.6 * (count / max)).toFixed(3)})`
              : "#f1f5f9";
          const dot = newCount > 0 ? '<span class="ndot"></span>' : "";
          return `<div class="hcell" style="background:${bg}">${count > 0 ? count : ""}${dot}</div>`;
        })
        .join("");
      const label = r === "—" ? "Uncl." : r;
      return `<div class="hrow" style="${gridCols}"><div class="hrl" style="color:${TIER_HEX[r]}">${escHtml(label)}</div>${cells}<div class="htot">${rowTotals[r]}</div></div>`;
    })
    .join("");
  return `<div class="heat">${head}${body}</div>`;
}

// Printable HTML for the new-vs-repeat split and the NYS DOL snapshot, so the
// advisor hand-off PDF carries the same two additions shown on screen.
function newRepeatHtml(w: WeekActivity): string {
  const total = w.stats.conversations;
  if (total === 0) return "";
  const newC = w.stats.newConversations;
  const repeat = w.stats.repeatConversations;
  const pct = Math.round((newC / total) * 100);
  const seen = new Set<string>();
  const newNames = w.conversations
    .filter((c) => c.isFirstContact && !seen.has(c.contactId) && seen.add(c.contactId))
    .map((c) => {
      const rank = tierDegreeLabel(c.tier, c.degree);
      return `<li><span class="li-main"><b>${escHtml(c.name)}</b>${c.firm ? ` <span class="muted">&middot; ${escHtml(c.firm)}</span>` : ""}</span>${rank ? `<span class="li-meta">${escHtml(rank)}</span>` : ""}</li>`;
    })
    .join("");
  return `<div class="nr-legend">
      <span><span class="dot amber"></span><b>${newC}</b> new contact${newC === 1 ? "" : "s"}</span>
      <span><span class="dot sky"></span><b>${repeat}</b> repeat conversation${repeat === 1 ? "" : "s"}</span>
      <span class="muted">&middot; ${pct}% new</span>
    </div>
    <div class="bar">${newC > 0 ? `<div class="bar-new" style="width:${pct}%"></div>` : ""}${repeat > 0 ? `<div class="bar-rep" style="width:${100 - pct}%"></div>` : ""}</div>
    ${newNames ? `<div class="sub2">New contacts</div><ul class="list">${newNames}</ul>` : ""}`;
}

// Result → tone bucket for the colored result pill on Search Activity rows.
type ResultTone = "ok" | "warn" | "bad" | "neutral";
function resultTone(result: string): ResultTone {
  if (result === "Offer Received") return "ok";
  if (result === "Interview Scheduled") return "warn";
  if (result === "Rejected") return "bad";
  return "neutral";
}
const RESULT_PILL: Record<ResultTone, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  neutral: "border-border text-muted-foreground",
};

function nyuiHtml(w: WeekActivity): string {
  const n = w.nyui;
  if (n.applicationCount === 0) return "";
  const rows = n.applications
    .map((a) => {
      const resultPill =
        a.result && a.result !== "—"
          ? `<span class="li-meta ${resultTone(a.result)}">${escHtml(a.result)}</span>`
          : "";
      return `<li><span class="li-main"><span class="li-date">${escHtml(fmtShort(a.date))}</span> <b>${escHtml(a.company)}</b> <span class="muted">&middot; ${escHtml(a.position)}</span></span><span class="li-right"><span class="li-meta">${escHtml(a.method)}</span>${resultPill}</span></li>`;
    })
    .join("");
  return `<ul class="list">${rows}</ul>`;
}

function normTier(t: NsConversation["tier"]): string {
  return t === "A" || t === "B" || t === "C" ? t : "—";
}
function normDeg(d: NsConversation["degree"]): number {
  return d === 1 || d === 2 || d === 3 ? d : 0;
}

function WeekHeatmap({
  conversations,
  onOpenContact,
}: {
  conversations: NsConversation[];
  onOpenContact: (c: NsConversation) => void;
}) {
  const { grid, newGrid, rows, cols, max, rowTotals } = buildMatrix(conversations);
  const template = `64px repeat(${cols.length}, minmax(34px, 1fr)) 44px`;
  const [sel, setSel] = useState<{ tier: string; deg: number } | null>(null);

  const selected =
    sel &&
    conversations.filter(
      (c) => normTier(c.tier) === sel.tier && normDeg(c.degree) === sel.deg
    );

  return (
    <div>
      {/* Column header */}
      <div className="grid items-center gap-1" style={{ gridTemplateColumns: template }}>
        <span aria-hidden />
        {cols.map((d) => (
          <span
            key={`h-${d}`}
            className="text-center text-[10px] font-semibold tabular-nums text-muted-foreground"
          >
            {colLabel(d)}
          </span>
        ))}
        <span className="text-right text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Total
        </span>
      </div>

      {/* Rows */}
      <div className="mt-1 space-y-1">
        {rows.map((r) => (
          <div
            key={r}
            className="grid items-center gap-1"
            style={{ gridTemplateColumns: template }}
          >
            <span className={`text-[11px] font-semibold ${TIER_META[r].text}`}>
              {TIER_META[r].label}
            </span>
            {cols.map((d) => {
              const count = grid[r][d];
              const newCount = newGrid[r][d];
              const isSel = sel?.tier === r && sel?.deg === d;
              return (
                <button
                  key={`${r}-${d}`}
                  type="button"
                  disabled={count === 0}
                  onClick={() => setSel(isSel ? null : { tier: r, deg: d })}
                  className={`relative flex h-8 items-center justify-center rounded-sm text-[11px] font-medium tabular-nums transition-[box-shadow,transform] disabled:cursor-default ${
                    count > 0 ? "cursor-pointer hover:brightness-125" : ""
                  } ${isSel ? "ring-2 ring-emerald-300 ring-offset-1 ring-offset-card" : ""}`}
                  style={{ backgroundColor: cellBg(count, max) }}
                  title={
                    count > 0
                      ? `Relevance ${r} · closeness ${colLabel(d)} — ${count} conversation${count === 1 ? "" : "s"}${newCount > 0 ? `, ${newCount} with a new contact` : ""} (click to see who)`
                      : `Relevance ${r} · closeness ${colLabel(d)} — none`
                  }
                >
                  {count > 0 ? count : ""}
                  {newCount > 0 ? (
                    <span
                      className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 ring-1 ring-card"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
            <span className="text-right text-[11px] font-semibold tabular-nums">
              {rowTotals[r]}
            </span>
          </div>
        ))}
      </div>

      <NewRepeatSummary conversations={conversations} />

      {/* Drill-down: who is counted in the clicked square */}
      {sel && selected ? (
        <div className="mt-3 rounded-lg border border-border bg-muted/20 p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold">
              {sel.tier === "—" ? "Unclassified" : `Relevance ${sel.tier}`} ·
              closeness {colLabel(sel.deg)}
              <span className="ml-1.5 text-muted-foreground">
                ({selected.length})
              </span>
            </p>
            <button
              type="button"
              onClick={() => setSel(null)}
              className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <ul className="divide-y divide-border/60">
            {selected.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onOpenContact(c)}
                  className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-xs transition-colors hover:bg-muted/50"
                >
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {fmtShort(c.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {c.name}
                    {c.firm ? (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        · {c.firm}
                      </span>
                    ) : null}
                  </span>
                  <ContactKindBadge
                    isFirstContact={c.isFirstContact}
                    priorContactCount={c.priorContactCount}
                  />
                  {c.browning ? (
                    <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                      Browning
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// New vs. repeat split for a set of conversations — a clear, at-a-glance
// indicator of how much of the week was fresh outreach vs. staying in touch.
function NewRepeatSummary({ conversations }: { conversations: NsConversation[] }) {
  const total = conversations.length;
  if (total === 0) return null;
  const newConversations = conversations.filter((c) => c.isFirstContact);
  const newCount = newConversations.length;
  const repeatCount = total - newCount;
  const newPct = Math.round((newCount / total) * 100);
  // Dedupe by contact (a contact's first-ever touch is unique, but guard anyway).
  const seen = new Set<string>();
  const newContacts = newConversations.filter((c) =>
    seen.has(c.contactId) ? false : (seen.add(c.contactId), true)
  );

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/20 p-2.5">
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-amber-300">
          <Sparkles className="h-3.5 w-3.5" />
          {newCount} new contact{newCount === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-sky-300">
          <Repeat className="h-3.5 w-3.5" />
          {repeatCount} repeat conversation{repeatCount === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground">· {newPct}% new</span>
      </div>
      {/* Split bar: amber = new, sky = repeat */}
      <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-border">
        {newCount > 0 ? (
          <div className="h-full bg-amber-400" style={{ width: `${newPct}%` }} />
        ) : null}
        {repeatCount > 0 ? (
          <div className="h-full bg-sky-400" style={{ width: `${100 - newPct}%` }} />
        ) : null}
      </div>

      {/* Names of the new contacts reached this week */}
      {newContacts.length > 0 ? (
        <div className="mt-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
            New contacts
          </p>
          <ul className="divide-y divide-border/40 rounded-lg border border-border bg-background/40">
            {newContacts.map((c) => (
              <li
                key={c.contactId}
                className="flex items-baseline justify-between gap-2 px-3 py-1.5 text-xs"
              >
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{c.name}</span>
                  {c.firm ? (
                    <span className="text-muted-foreground"> · {c.firm}</span>
                  ) : null}
                </span>
                <TierDegreeBadge
                  tier={c.tier}
                  degree={c.degree}
                  className="shrink-0"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// Per-contact indicator: a first-ever communication ("New") vs. a repeat
// conversation with someone already spoken to (showing which touch this is,
// so "spoken to repeatedly" is legible at a glance).
function ContactKindBadge({
  isFirstContact,
  priorContactCount,
}: {
  isFirstContact: boolean;
  priorContactCount: number;
}) {
  if (isFirstContact) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
        <Sparkles className="h-2.5 w-2.5" />
        New
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-400/40 bg-sky-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-300"
      title={`You've communicated with this contact ${priorContactCount} time${priorContactCount === 1 ? "" : "s"} before — this is the ${ordinal(priorContactCount + 1)} touch.`}
    >
      <Repeat className="h-2.5 w-2.5" />
      Repeat · {ordinal(priorContactCount + 1)}
    </span>
  );
}
