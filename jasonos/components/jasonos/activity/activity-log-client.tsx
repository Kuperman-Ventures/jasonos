"use client";

// Weekly Log — a Browning-advisor-facing recap of the week: outreach activity
// plus the Browning coaching loop. Read-only; "Copy recap" produces a
// markdown summary to paste into an email/doc for the advisor.

import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  FileDown,
  Flame,
  Radar,
  Target,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WeeklyActivityLog } from "@/lib/server-actions/activity-log";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  phone: "Phone",
  call: "Call",
  video: "Video Call",
  in_person: "In Person",
  calendar: "Meeting",
  coffee_chat: "Coffee",
  text: "Text",
  thank_you_note: "Thank-you",
  value_sharing: "Value-share",
  other: "Other",
};

function chLabel(c: string): string {
  return CHANNEL_LABELS[c] ?? c;
}

function fmtRange(startYmd: string, endYmd: string): string {
  const s = new Date(`${startYmd}T12:00:00`);
  const e = new Date(`${endYmd}T12:00:00`);
  const sM = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const eM = e.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${sM} – ${eM}`;
}

function delta(cur: number, prev: number): string {
  const d = cur - prev;
  if (d === 0) return "—";
  return d > 0 ? `▲ ${d}` : `▼ ${Math.abs(d)}`;
}

function buildRecap(data: WeeklyActivityLog): string {
  const o = data.outreach;
  const b = data.browning;
  const lines: string[] = [];
  lines.push(`# Networking Status Report — ${fmtRange(data.weekStart, data.weekEnd)}`);
  lines.push("");
  lines.push("## Outreach");
  lines.push(
    `- Touches: ${o.touchCount} (prior week ${o.prevTouchCount}) — ${o.outbound} outbound, ${o.inbound} inbound`
  );
  if (o.byChannel.length) {
    lines.push(
      `- By channel: ${o.byChannel.map((c) => `${chLabel(c.channel)} ${c.count}`).join(", ")}`
    );
  }
  lines.push(`- New contacts added: ${o.newContacts.length}`);
  lines.push(`- Coverage: ${o.overdueCount} overdue, ${o.dueNext7Count} due in the next 7 days`);
  if (o.engaged.length) {
    lines.push("");
    lines.push("### People engaged");
    for (const e of o.engaged) {
      const who = e.firm ? `${e.name} (${e.firm})` : e.name;
      const detail = e.outcome || e.brief || "";
      lines.push(
        `- ${who} — ${chLabel(e.channel)}, ${e.date}${detail ? ` — ${detail}` : ""}`
      );
    }
  }
  lines.push("");
  lines.push("## Browning");
  lines.push(
    `- Conversations scored: ${b.conversations} / ${b.target} target (prior week ${b.prevConversations})`
  );
  lines.push(
    `- Avg warmth: ${b.avgWarmth ?? "—"} · Avg quality: ${b.avgQuality ?? "—"}`
  );
  lines.push(
    `- Referrals received: ${b.referralsReceived} · Thank-yous sent: ${b.thankYousSent} · Leads produced: ${b.leadsProduced}`
  );
  if (b.nextGate) {
    lines.push(
      `- Next gate: ${b.nextGate.gateCode} — ${b.nextGate.description}${b.nextGate.targetDate ? ` (target ${b.nextGate.targetDate})` : ""}`
    );
  }
  if (b.coachingNotes.length) {
    lines.push("");
    lines.push("### Coaching reflections");
    for (const n of b.coachingNotes) {
      if (n.whatWasHard) lines.push(`- ${n.name} — Hard: ${n.whatWasHard}`);
      if (n.whatToDoDifferently)
        lines.push(`- ${n.name} — Next time: ${n.whatToDoDifferently}`);
    }
  }
  return lines.join("\n");
}

// HTML-escape for the printable report.
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Build a polished, light-themed, print-optimized status report as a
// standalone HTML document. Opens in a new tab and triggers the browser's
// print dialog so it can be saved as a PDF and emailed.
function buildReportHtml(data: WeeklyActivityLog): string {
  const o = data.outreach;
  const b = data.browning;
  const range = fmtRange(data.weekStart, data.weekEnd);
  const generated = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const kpi = (label: string, value: string | number, sub = "") => `
    <div class="kpi">
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-value">${esc(value)}</div>
      ${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ""}
    </div>`;

  const engagedRows = o.engaged.length
    ? o.engaged
        .map(
          (e) => `<tr>
            <td>${esc(e.date)}</td>
            <td><strong>${esc(e.name)}</strong>${e.firm ? ` <span class="muted">· ${esc(e.firm)}</span>` : ""}</td>
            <td>${esc(chLabel(e.channel))}${e.direction === "inbound" ? " (in)" : ""}</td>
            <td>${esc(e.outcome || e.brief || "")}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="muted">No touches logged this week.</td></tr>`;

  const coaching = b.coachingNotes.length
    ? `<ul class="notes">${b.coachingNotes
        .map(
          (n) =>
            `<li><strong>${esc(n.name)}</strong>${n.avgQuality != null ? ` <span class="muted">· quality ${esc(n.avgQuality)}</span>` : ""}${n.whatWasHard ? `<div class="muted">Hard: ${esc(n.whatWasHard)}</div>` : ""}${n.whatToDoDifferently ? `<div class="muted">Next time: ${esc(n.whatToDoDifferently)}</div>` : ""}</li>`
        )
        .join("")}</ul>`
    : `<p class="muted">No scored conversations with reflections this week.</p>`;

  const newContacts = o.newContacts.length
    ? `<p>${o.newContacts.map((c) => esc(c.name) + (c.firm ? ` (${esc(c.firm)})` : "")).join(" · ")}</p>`
    : `<p class="muted">None added this week.</p>`;

  return `<!doctype html><html><head><meta charset="utf-8" />
    <title>Networking Status Report — ${esc(range)}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0;padding:40px;background:#fff}
      .head{border-bottom:3px solid #ea580c;padding-bottom:16px;margin-bottom:24px}
      .eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#ea580c;font-weight:700}
      h1{font-size:26px;margin:6px 0 2px}
      .sub{color:#475569;font-size:13px;margin:0}
      h2{font-size:15px;margin:28px 0 10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.05em;color:#334155}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:8px 0 4px}
      .kpi{border:1px solid #e2e8f0;border-radius:10px;padding:12px}
      .kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:600}
      .kpi-value{font-size:22px;font-weight:700;margin-top:2px}
      .kpi-sub{font-size:10px;color:#64748b}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
      th,td{border:1px solid #e2e8f0;padding:6px 9px;text-align:left;vertical-align:top}
      th{background:#f8fafc;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:#475569}
      .muted{color:#64748b}
      .chips{margin:6px 0 0}
      .chip{display:inline-block;border:1px solid #e2e8f0;border-radius:999px;padding:2px 9px;font-size:11px;color:#475569;margin:0 6px 6px 0}
      ul.notes{margin:6px 0;padding-left:18px;font-size:12px} ul.notes li{margin-bottom:6px}
      .foot{margin-top:32px;border-top:1px solid #e2e8f0;padding-top:10px;color:#94a3b8;font-size:10px}
      @media print{body{padding:16mm} h2{page-break-after:avoid} table,ul.notes,.kpis{page-break-inside:avoid}}
    </style></head><body>
    <div class="head">
      <div class="eyebrow">Networking Status Report</div>
      <h1>${esc(range)}</h1>
      <p class="sub">Prepared for Browning Associates · Generated ${esc(generated)}</p>
    </div>

    <h2>Outreach activity</h2>
    <div class="kpis">
      ${kpi("Touches", o.touchCount, `${delta(o.touchCount, o.prevTouchCount)} vs prior week`)}
      ${kpi("Outbound / Inbound", `${o.outbound} / ${o.inbound}`)}
      ${kpi("New contacts", o.newContacts.length)}
      ${kpi("Overdue / Due 7d", `${o.overdueCount} / ${o.dueNext7Count}`)}
    </div>
    ${o.byChannel.length ? `<div class="chips">${o.byChannel.map((c) => `<span class="chip">${esc(chLabel(c.channel))} · ${c.count}</span>`).join("")}</div>` : ""}

    <h2>People engaged</h2>
    <table>
      <thead><tr><th>Date</th><th>Contact</th><th>Channel</th><th>Outcome / next step</th></tr></thead>
      <tbody>${engagedRows}</tbody>
    </table>

    <h2>New to the network</h2>
    ${newContacts}

    <h2>Browning coaching loop</h2>
    <div class="kpis">
      ${kpi("Conversations", `${b.conversations} / ${b.target}`, `${delta(b.conversations, b.prevConversations)} vs prior week`)}
      ${kpi("Avg warmth", b.avgWarmth ?? "—")}
      ${kpi("Avg quality", b.avgQuality ?? "—")}
      ${kpi("Referrals / Thanks / Leads", `${b.referralsReceived} / ${b.thankYousSent} / ${b.leadsProduced}`)}
    </div>
    ${b.nextGate ? `<p class="muted">Next gate: <strong>${esc(b.nextGate.gateCode)}</strong> — ${esc(b.nextGate.description)}${b.nextGate.targetDate ? ` (target ${esc(b.nextGate.targetDate)})` : ""}</p>` : ""}
    <h3 style="font-size:12px;margin:14px 0 4px;text-transform:uppercase;letter-spacing:.05em;color:#334155">Coaching reflections</h3>
    ${coaching}

    <div class="foot">JasonOS · Networking status report · ${esc(range)}. Reporting week runs Tuesday to Tuesday.</div>
    </body></html>`;
}

function openPrintableReport(data: WeeklyActivityLog): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(buildReportHtml(data));
  win.document.close();
  setTimeout(() => win.print(), 400);
  return true;
}

export function ActivityLogClient({ data }: { data: WeeklyActivityLog }) {
  const o = data.outreach;
  const b = data.browning;

  const downloadPdf = () => {
    const opened = openPrintableReport(data);
    if (!opened) {
      toast.error("Pop-up blocked — allow pop-ups to download the PDF.");
      return;
    }
    toast.success("Report opened — use your browser's Save as PDF.");
  };

  const copyRecap = async () => {
    try {
      await navigator.clipboard.writeText(buildRecap(data));
      toast.success("Recap copied — paste it into an email or doc.");
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-300">
            <Radar className="h-4 w-4" />
            Networking Status Report
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {fmtRange(data.weekStart, data.weekEnd)}
            {data.isCurrentWeek ? (
              <span className="ml-2 align-middle text-[11px] font-medium uppercase tracking-wider text-emerald-300">
                Latest week
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            All networking activity + the Browning coaching loop, for the
            Browning advisor. Reporting week runs Tuesday to Tuesday.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-sm" title="Previous week" render={<Link href={`/activity?week=${data.prevWeek}`} />}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!data.isCurrentWeek ? (
            <Button variant="outline" size="sm" render={<Link href="/activity" />}>
              Latest
            </Button>
          ) : null}
          <Button variant="outline" size="icon-sm" title="Next week" render={<Link href={`/activity?week=${data.nextWeek}`} />}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={copyRecap} title="Copy a markdown recap">
            <ClipboardCopy className="h-4 w-4" />
            Copy
          </Button>
          <Button onClick={downloadPdf}>
            <FileDown className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </header>

      {/* Outreach */}
      <section className="rounded-xl border bg-card/40">
        <header className="flex items-center gap-2 border-b px-4 py-2.5">
          <Radar className="h-4 w-4 text-sky-300" />
          <h2 className="text-sm font-semibold tracking-tight">Outreach</h2>
        </header>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Stat label="Touches" value={o.touchCount} sub={`${delta(o.touchCount, o.prevTouchCount)} vs prior`} />
          <Stat label="Outbound / Inbound" value={`${o.outbound} / ${o.inbound}`} />
          <Stat label="New contacts" value={o.newContacts.length} />
          <Stat label="Overdue / Due 7d" value={`${o.overdueCount} / ${o.dueNext7Count}`} />
        </div>
        {o.byChannel.length ? (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            {o.byChannel.map((c) => (
              <span
                key={c.channel}
                className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {chLabel(c.channel)} · {c.count}
              </span>
            ))}
          </div>
        ) : null}

        <div className="border-t px-4 py-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            People engaged
          </h3>
          {o.engaged.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">No touches logged this week.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {o.engaged.map((e, i) => (
                <li key={`${e.contactId}-${i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 text-sm">
                  <span className="font-medium">{e.name}</span>
                  {e.firm ? <span className="text-xs text-muted-foreground">· {e.firm}</span> : null}
                  <span className="text-[11px] text-muted-foreground">
                    · {chLabel(e.channel)}{e.direction === "inbound" ? " (in)" : ""} · {e.date}
                  </span>
                  {e.outcome || e.brief ? (
                    <span className="w-full text-[11px] text-muted-foreground/80">
                      ↳ {e.outcome || e.brief}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {o.newContacts.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <UserPlus className="h-3 w-3" /> Added
              </span>
              {o.newContacts.map((c, i) => (
                <span key={i} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {c.name}{c.firm ? ` · ${c.firm}` : ""}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Browning */}
      <section className="rounded-xl border bg-card/40">
        <header className="flex items-center gap-2 border-b px-4 py-2.5">
          <Flame className="h-4 w-4 text-rose-300" />
          <h2 className="text-sm font-semibold tracking-tight">Browning coaching loop</h2>
        </header>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Stat
            label="Conversations"
            value={`${b.conversations} / ${b.target}`}
            sub={`${delta(b.conversations, b.prevConversations)} vs prior`}
          />
          <Stat label="Avg warmth" value={b.avgWarmth ?? "—"} />
          <Stat label="Avg quality" value={b.avgQuality ?? "—"} />
          <Stat
            label="Referrals / Thanks / Leads"
            value={`${b.referralsReceived} / ${b.thankYousSent} / ${b.leadsProduced}`}
          />
        </div>

        {b.nextGate || b.gatesMoved.length ? (
          <div className="border-t px-4 py-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Target className="h-3 w-3" /> Gates
            </h3>
            {b.gatesMoved.map((g) => (
              <p key={g.gateCode} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{g.gateCode}</span> — {g.description} ·{" "}
                {g.status}
                {g.completedDate ? ` (completed ${g.completedDate})` : ""}
              </p>
            ))}
            {b.nextGate ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Next: <span className="font-medium text-foreground">{b.nextGate.gateCode}</span> —{" "}
                {b.nextGate.description}
                {b.nextGate.targetDate ? ` (target ${b.nextGate.targetDate})` : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="border-t px-4 py-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Coaching reflections
          </h3>
          {b.coachingNotes.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">
              No scored conversations with reflections this week.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {b.coachingNotes.map((n, i) => (
                <li key={i} className="text-xs">
                  <span className="font-medium">{n.name}</span>
                  {n.avgQuality != null ? (
                    <span className="text-muted-foreground"> · quality {n.avgQuality}</span>
                  ) : null}
                  {n.whatWasHard ? (
                    <div className="text-muted-foreground/80">Hard: {n.whatWasHard}</div>
                  ) : null}
                  {n.whatToDoDifferently ? (
                    <div className="text-muted-foreground/80">Next time: {n.whatToDoDifferently}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {b.deliverables.length ? (
          <div className="border-t px-4 py-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Deliverables this month
            </h3>
            <ul className="space-y-1">
              {b.deliverables.map((d, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  {d.promised} — {d.deliveredStatus ?? "pending"}
                  {d.escalate ? " · ⚠ escalate" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
      {sub ? <p className="text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
