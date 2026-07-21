"use client";

// Networking Activity — a thin, week-by-week feed of what you DID: conversations
// had, new contacts added, thank-yous sent, referrals received. Current week
// (Wednesday to Tuesday) on top, history scrolling below. No "what wasn't done".
// The "Weekly PDF" prints the current week for the advisor hand-off.

import { Network, Download } from "lucide-react";
import type {
  NetworkingActivity,
  NsConversation,
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

function weekTitle(w: WeekActivity): string {
  return w.isCurrent ? "This week" : `Week of ${fmtShort(w.weekStart)}`;
}

export function NetworkingActivityClient({ data }: { data: NetworkingActivity }) {
  const current = data.weeks.find((w) => w.isCurrent) ?? data.weeks[0];

  function downloadWeeklyPdf() {
    if (!current) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"/>
      <title>Networking Activity ${escHtml(current.weekStart)}</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;margin:32px;}
        h1{font-size:18px;margin:0 0 2px;} .sub{color:#555;font-size:12px;margin:0 0 16px;}
        .kpis{display:flex;gap:18px;margin:0 0 18px;font-size:12px;color:#333;}
        .kpis b{font-size:16px;display:block;}
        table.heat{border-collapse:collapse;font-size:12px;}
        table.heat th,table.heat td{border:1px solid #e5e7eb;padding:8px 12px;min-width:40px;}
        table.heat thead th{background:#f3f3f3;font-size:11px;color:#555;text-align:center;}
        table.heat .rowlab{background:#fafafa;font-weight:600;text-align:left;}
        .legend{color:#777;font-size:11px;margin-top:10px;}
        .empty{color:#888;padding:16px;}
      </style></head><body>
      <h1>Networking Activity</h1>
      <p class="sub">Week of ${escHtml(fmt(current.weekStart))} through ${escHtml(fmt(current.weekEnd))} (Wednesday to Tuesday)</p>
      <div class="kpis">
        <span><b>${current.stats.conversations}</b> conversations</span>
        <span><b>${current.stats.newContacts}</b> new contacts</span>
        <span><b>${current.stats.thankYous}</b> thank-yous</span>
        <span><b>${current.stats.referrals}</b> referrals</span>
      </div>
      ${heatmapHtml(current.conversations)}
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

      {data.weeks.map((w) => (
        <WeekCard key={w.weekStart} w={w} />
      ))}
    </div>
  );
}

function WeekCard({ w }: { w: WeekActivity }) {
  const chips: { label: string; value: number }[] = [
    { label: "conversations", value: w.stats.conversations },
    { label: "new contacts", value: w.stats.newContacts },
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
          <WeekHeatmap conversations={w.conversations} />
        </div>
      )}
    </section>
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
  let hasUnclassified = false;
  let hasUnknownDeg = false;
  for (const c of conversations) {
    const t = c.tier === "A" || c.tier === "B" || c.tier === "C" ? c.tier : "—";
    if (t === "—") hasUnclassified = true;
    const d = c.degree === 1 || c.degree === 2 || c.degree === 3 ? c.degree : 0;
    if (d === 0) hasUnknownDeg = true;
    grid[t][d] += 1;
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
  return { grid, rows, cols, max, rowTotals };
}

function cellBg(count: number, max: number): string {
  if (count <= 0) return "rgba(148,163,184,0.06)";
  const alpha = 0.16 + 0.6 * (count / max);
  return `rgba(16,185,129,${alpha.toFixed(3)})`;
}

function colLabel(deg: number): string {
  return deg === 0 ? "?" : String(deg);
}

// Same matrix, rendered as a static HTML table for the printable PDF.
function heatmapHtml(conversations: NsConversation[]): string {
  if (conversations.length === 0) {
    return '<p class="empty">No conversations logged this week.</p>';
  }
  const { grid, rows, cols, max, rowTotals } = buildMatrix(conversations);
  const head = `<tr><th></th>${cols
    .map((d) => `<th>${escHtml(colLabel(d))}</th>`)
    .join("")}<th>Total</th></tr>`;
  const body = rows
    .map((r) => {
      const cells = cols
        .map((d) => {
          const count = grid[r][d];
          const bg =
            count > 0
              ? `background:rgba(16,185,129,${(0.16 + 0.6 * (count / max)).toFixed(3)});`
              : "background:#f5f7f6;";
          return `<td style="text-align:center;${bg}">${count > 0 ? count : ""}</td>`;
        })
        .join("");
      const label = r === "—" ? "Unclass." : r;
      return `<tr><th class="rowlab">${escHtml(label)}</th>${cells}<td style="text-align:right;font-weight:600;">${rowTotals[r]}</td></tr>`;
    })
    .join("");
  return `<table class="heat"><thead>${head}</thead><tbody>${body}</tbody></table>
    <p class="legend">Rows = relevance (A most &rarr; C). Columns = closeness (1 = know well &rarr; 3). Darker = more conversations.</p>`;
}

function WeekHeatmap({ conversations }: { conversations: NsConversation[] }) {
  const { grid, rows, cols, max, rowTotals } = buildMatrix(conversations);
  const template = `64px repeat(${cols.length}, minmax(34px, 1fr)) 44px`;

  return (
    <div>
      {/* Column header */}
      <div className="grid items-center gap-1" style={{ gridTemplateColumns: template }}>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Rel ⇣ / Close ⇢
        </span>
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
              return (
                <div
                  key={`${r}-${d}`}
                  className="flex h-8 items-center justify-center rounded-sm text-[11px] font-medium tabular-nums"
                  style={{ backgroundColor: cellBg(count, max) }}
                  title={`Relevance ${r} · closeness ${colLabel(d)} — ${count} conversation${count === 1 ? "" : "s"}`}
                >
                  {count > 0 ? count : ""}
                </div>
              );
            })}
            <span className="text-right text-[11px] font-semibold tabular-nums">
              {rowTotals[r]}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
        Rows = relevance (A most → C). Columns = closeness (1 = know well → 3).
        Darker = more conversations.
      </p>
    </div>
  );
}
