"use client";

// Networking Activity — a thin, week-by-week feed of what you DID: conversations
// had, new contacts added, thank-yous sent, referrals received. Current week
// (Tuesday to Tuesday) on top, history scrolling below. No "what wasn't done".
// The "Weekly PDF" prints the current week for the advisor hand-off.

import { Network, Download } from "lucide-react";
import { TierDegreeBadge } from "@/components/jasonos/outreach/tier-degree-badge";
import type {
  NetworkingActivity,
  NsConversation,
  WeekActivity,
} from "@/lib/server-actions/networking-status";

const CHANNEL_LABELS: Record<string, string> = {
  phone: "Call",
  call: "Call",
  video: "Video",
  in_person: "In person",
  calendar: "Meeting",
  coffee_chat: "Coffee",
};

function chLabel(c: string): string {
  return CHANNEL_LABELS[c] ?? c;
}

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
    const rows = current.conversations
      .map(
        (c) => `<tr>
          <td>${escHtml(fmt(c.date))}</td>
          <td>${escHtml(chLabel(c.channel))}</td>
          <td>${escHtml(c.name)}${c.firm ? ` <span class="firm">${escHtml(c.firm)}</span>` : ""}${
          c.browning ? ' <span class="tag">Browning</span>' : ""
        }</td>
          <td>${escHtml(c.brief ?? "")}${
          c.outcome ? `<div class="next">Next: ${escHtml(c.outcome)}</div>` : ""
        }</td>
        </tr>`
      )
      .join("");
    const newList = current.newContacts
      .map(
        (n) =>
          `${escHtml(n.name)}${n.tier || n.degree ? ` (${escHtml(`${n.tier ?? ""}${n.degree ?? ""}`)})` : ""}`
      )
      .join(", ");
    const html = `<!doctype html><html><head><meta charset="utf-8"/>
      <title>Networking Activity ${escHtml(current.weekStart)}</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;margin:32px;}
        h1{font-size:18px;margin:0 0 2px;} .sub{color:#555;font-size:12px;margin:0 0 16px;}
        .kpis{display:flex;gap:18px;margin:0 0 16px;font-size:12px;color:#333;}
        .kpis b{font-size:16px;display:block;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th,td{text-align:left;border-bottom:1px solid #ddd;padding:6px 8px;vertical-align:top;}
        th{background:#f3f3f3;text-transform:uppercase;font-size:10px;letter-spacing:.04em;color:#555;}
        .firm{color:#777;} .tag{background:#eee;border-radius:8px;padding:1px 6px;font-size:9px;color:#555;}
        .next{color:#666;font-size:11px;margin-top:2px;} .new{margin-top:14px;font-size:12px;color:#333;}
        .empty{color:#888;padding:16px;text-align:center;}
      </style></head><body>
      <h1>Networking Activity</h1>
      <p class="sub">Week of ${escHtml(fmt(current.weekStart))} through ${escHtml(fmt(current.weekEnd))} (Tuesday to Tuesday)</p>
      <div class="kpis">
        <span><b>${current.stats.conversations}</b> conversations</span>
        <span><b>${current.stats.newContacts}</b> new contacts</span>
        <span><b>${current.stats.thankYous}</b> thank-yous</span>
        <span><b>${current.stats.referrals}</b> referrals</span>
      </div>
      <table><thead><tr><th>Date</th><th>How</th><th>Who</th><th>Notes / next step</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="empty">No conversations logged this week.</td></tr>'}</tbody></table>
      ${newList ? `<p class="new"><b>New contacts:</b> ${newList}</p>` : ""}
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
            Tuesday to Tuesday. This week on top, history below. Derived from
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

      {quiet ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          No activity logged yet this week.
        </p>
      ) : (
        <>
          {w.conversations.length > 0 ? (
            <ul className="divide-y divide-border">
              {w.conversations.map((c) => (
                <ConversationRow key={c.id} c={c} />
              ))}
            </ul>
          ) : null}

          {w.newContacts.length > 0 ? (
            <div className="border-t border-border/60 px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                New contacts added
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {w.newContacts.map((n) => (
                  <span
                    key={n.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs"
                  >
                    <TierDegreeBadge tier={n.tier} degree={n.degree} />
                    <span className="truncate">{n.name}</span>
                    {n.firm ? (
                      <span className="text-[10px] text-muted-foreground">
                        · {n.firm}
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function ConversationRow({ c }: { c: NsConversation }) {
  return (
    <li className="grid grid-cols-[1fr] gap-x-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/30 sm:grid-cols-[92px_74px_1fr]">
      <span className="hidden shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground sm:block">
        {fmtShort(c.date)}
      </span>
      <span className="hidden pt-0.5 sm:block">
        <span className="rounded-sm border border-border px-1 py-0.5 text-[9px] uppercase text-muted-foreground">
          {chLabel(c.channel)}
        </span>
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <TierDegreeBadge tier={c.tier} degree={c.degree} />
          <span className="min-w-0 flex-1 truncate font-medium">
            {c.name}
            {c.firm ? (
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                · {c.firm}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground sm:hidden">
            {chLabel(c.channel)} · {fmtShort(c.date)}
          </span>
          {c.browning ? (
            <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
              Browning
            </span>
          ) : null}
        </div>
        {c.brief ? (
          <p className="mt-1 text-xs text-muted-foreground">{c.brief}</p>
        ) : null}
        {c.outcome ? (
          <p className="mt-0.5 text-xs text-muted-foreground/80">
            ↳ Next: {c.outcome}
          </p>
        ) : null}
      </div>
    </li>
  );
}
