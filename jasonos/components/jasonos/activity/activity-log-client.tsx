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
  lines.push(`# Weekly Log — ${fmtRange(data.weekStart, data.weekEnd)}`);
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

export function ActivityLogClient({ data }: { data: WeeklyActivityLog }) {
  const o = data.outreach;
  const b = data.browning;

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
            Weekly Log
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {fmtRange(data.weekStart, data.weekEnd)}
            {data.isCurrentWeek ? (
              <span className="ml-2 align-middle text-[11px] font-medium uppercase tracking-wider text-emerald-300">
                This week
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Outreach activity + the Browning coaching loop — a recap for the
            advisor. Week runs Saturday–Friday.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-sm" title="Previous week" render={<Link href={`/activity?week=${data.prevWeekEnd}`} />}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!data.isCurrentWeek ? (
            <Button variant="outline" size="sm" render={<Link href="/activity" />}>
              This week
            </Button>
          ) : null}
          <Button variant="outline" size="icon-sm" title="Next week" render={<Link href={`/activity?week=${data.nextWeekEnd}`} />}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={copyRecap}>
            <ClipboardCopy className="h-4 w-4" />
            Copy recap
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
