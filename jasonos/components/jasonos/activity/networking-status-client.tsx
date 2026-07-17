"use client";

// Networking Status — cumulative, all-time view of the network (roster by
// relevance/closeness, real conversations, awaiting-response, KPIs). Plus a
// Tuesday-to-Tuesday PDF export for the advisor hand-off. All data is derived;
// nothing new to log.

import { useMemo, useState } from "react";
import { Network, Download, Users, MessagesSquare, Clock } from "lucide-react";
import { TierDegreeBadge } from "@/components/jasonos/outreach/tier-degree-badge";
import type {
  NetworkingStatus,
  NsConversation,
  NsRosterEntry,
  NsStatus,
} from "@/lib/server-actions/networking-status";

const CHANNEL_LABELS: Record<string, string> = {
  phone: "Call",
  call: "Call",
  video: "Video",
  in_person: "In person",
  calendar: "Meeting",
  coffee_chat: "Coffee",
};

const STATUS_META: Record<NsStatus, { label: string; cls: string }> = {
  spoke: { label: "Spoke", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  scheduled: { label: "Scheduled", cls: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  overdue: { label: "Overdue", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
  awaiting: { label: "Awaiting reply", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  contacted: { label: "Contacted", cls: "border-border bg-muted text-muted-foreground" },
  new: { label: "Not contacted", cls: "border-border bg-muted/50 text-muted-foreground" },
};

function fmt(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function chLabel(c: string): string {
  return CHANNEL_LABELS[c] ?? c;
}

// Tuesday→Tuesday window: last Tuesday (inclusive) through this Monday.
function weekWindow(): { start: string; end: string } {
  const d = new Date();
  const back = (d.getUTCDay() - 2 + 7) % 7; // Tue = 2
  const anchor = new Date(d);
  anchor.setUTCDate(d.getUTCDate() - back);
  const start = new Date(anchor);
  start.setUTCDate(anchor.getUTCDate() - 7);
  const end = new Date(anchor);
  end.setUTCDate(anchor.getUTCDate() - 1);
  const ymd = (x: Date) => x.toISOString().split("T")[0];
  return { start: ymd(start), end: ymd(end) };
}

function escHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function NetworkingStatusClient({ data }: { data: NetworkingStatus }) {
  const [brOnly, setBrOnly] = useState(false);

  const conversations = useMemo(
    () => (brOnly ? data.conversations.filter((c) => c.browning) : data.conversations),
    [data.conversations, brOnly]
  );

  // Group roster by combined code (A1, A2, …), preserving the server sort.
  const groups = useMemo(() => {
    const out: { code: string; entries: NsRosterEntry[] }[] = [];
    for (const r of data.roster) {
      const code = r.code || "Unclassified";
      const last = out[out.length - 1];
      if (last && last.code === code) last.entries.push(r);
      else out.push({ code, entries: [r] });
    }
    return out;
  }, [data.roster]);

  function downloadWeeklyPdf() {
    const { start, end } = weekWindow();
    const weekConvos = data.conversations.filter(
      (c) => c.date >= start && c.date <= end
    );
    const rows = weekConvos
      .map(
        (c) => `<tr>
          <td>${escHtml(fmt(c.date))}</td>
          <td>${escHtml(c.name)}${c.firm ? ` <span class="firm">${escHtml(c.firm)}</span>` : ""}${
          c.browning ? ' <span class="tag">Browning</span>' : ""
        }</td>
          <td>${escHtml(chLabel(c.channel))}</td>
          <td>${escHtml(c.brief ?? "")}${
          c.outcome ? `<div class="next">Next: ${escHtml(c.outcome)}</div>` : ""
        }</td>
        </tr>`
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/>
      <title>Networking Recap ${escHtml(start)} to ${escHtml(end)}</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;margin:32px;}
        h1{font-size:18px;margin:0 0 2px;} .sub{color:#555;font-size:12px;margin:0 0 16px;}
        .kpis{display:flex;gap:18px;margin:0 0 18px;font-size:12px;color:#333;}
        .kpis b{font-size:16px;display:block;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th,td{text-align:left;border-bottom:1px solid #ddd;padding:6px 8px;vertical-align:top;}
        th{background:#f3f3f3;text-transform:uppercase;font-size:10px;letter-spacing:.04em;color:#555;}
        .firm{color:#777;} .tag{background:#eee;border-radius:8px;padding:1px 6px;font-size:9px;color:#555;}
        .next{color:#666;font-size:11px;margin-top:2px;}
        .empty{color:#888;padding:16px;text-align:center;}
      </style></head><body>
      <h1>Networking Recap</h1>
      <p class="sub">Week of ${escHtml(fmt(start))} through ${escHtml(fmt(end))} (Tuesday to Tuesday)</p>
      <div class="kpis">
        <span><b>${weekConvos.length}</b> conversations this week</span>
        <span><b>${data.kpis.total}</b> in network</span>
        <span><b>${data.kpis.spoke}</b> spoken with (all time)</span>
        <span><b>${data.kpis.awaiting}</b> awaiting reply</span>
      </div>
      <table><thead><tr><th>Date</th><th>Who</th><th>How</th><th>Notes / next step</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="empty">No conversations logged this week.</td></tr>'}</tbody></table>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-300">
            <Network className="h-4 w-4" />
            Networking Status
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Your network, broken out by relevance and closeness
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cumulative, all-time. Derived from your outreach data — nothing extra
            to log.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadWeeklyPdf}
          className="inline-flex items-center gap-2 self-start rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted/80"
        >
          <Download className="h-4 w-4" />
          Weekly PDF (Tue→Tue)
        </button>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="In network" value={data.kpis.total} />
        <Kpi label="Spoken with" value={data.kpis.spoke} />
        <Kpi label="Awaiting reply" value={data.kpis.awaiting} />
        <Kpi label="Thank-yous sent" value={data.kpis.thankYous} />
        <Kpi label="Referrals received" value={data.kpis.referrals} />
      </section>

      {/* Tier matrix */}
      {data.kpis.tierMatrix.length > 0 ? (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            By relevance + closeness
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {data.kpis.tierMatrix.map((t) => (
              <span
                key={t.code}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs"
              >
                <span className="font-semibold tabular-nums">{t.code}</span>
                <span className="text-muted-foreground">{t.count}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* Network by tier */}
      <section className="rounded-xl border bg-card">
        <SectionHeader icon={<Users className="h-4 w-4" />} title="Network by tier" count={data.roster.length} />
        {groups.length === 0 ? (
          <Empty text="No contacts in your network yet." />
        ) : (
          <div className="divide-y divide-border">
            {groups.map((g) => (
              <div key={g.code}>
                <div className="flex items-center gap-2 bg-muted/30 px-4 py-1.5">
                  {g.code === "Unclassified" ? (
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Unclassified
                    </span>
                  ) : (
                    <span className="text-xs font-semibold tabular-nums">{g.code}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {g.entries.length}
                  </span>
                </div>
                {g.entries.map((r) => (
                  <RosterRow key={r.id} r={r} />
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Conversation log */}
      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <MessagesSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-tight">Conversation log</h2>
            <span className="text-[11px] text-muted-foreground">
              {conversations.length}
            </span>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={brOnly}
              onChange={(e) => setBrOnly(e.target.checked)}
              className="h-3 w-3"
            />
            Browning only
          </label>
        </div>
        {conversations.length === 0 ? (
          <Empty text="No conversations logged yet. Real conversations (call, video, coffee, meeting) show here — email doesn't count." />
        ) : (
          <ul className="divide-y divide-border">
            {conversations.map((c) => (
              <ConversationRow key={c.id} c={c} />
            ))}
          </ul>
        )}
      </section>

      {/* Awaiting response */}
      <section className="rounded-xl border bg-card">
        <SectionHeader
          icon={<Clock className="h-4 w-4" />}
          title="Awaiting response"
          count={data.noResponse.length}
        />
        {data.noResponse.length === 0 ? (
          <Empty text="Nobody is sitting unanswered — nice." />
        ) : (
          <ul className="divide-y divide-border">
            {data.noResponse.map((n) => (
              <li key={n.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {n.name}
                    {n.firm ? (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">
                        · {n.firm}
                      </span>
                    ) : null}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {chLabel(n.channel)} · {fmt(n.lastOutreach)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground">
        Generated {fmt(data.generatedAt)}. The Weekly PDF covers the most recent
        completed Tuesday-to-Tuesday week for the advisor hand-off.
      </p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <span className="text-[11px] text-muted-foreground">{count}</span>
    </div>
  );
}

function RosterRow({ r }: { r: NsRosterEntry }) {
  const st = STATUS_META[r.status];
  return (
    <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-muted/30 sm:grid-cols-[44px_1fr_150px_120px]">
      <TierDegreeBadge tier={r.tier} degree={r.degree} />
      <div className="min-w-0">
        <p className="truncate font-medium">
          {r.name}
          {r.browning ? (
            <span className="ml-1.5 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
              Browning
            </span>
          ) : null}
        </p>
        {r.firm ? (
          <p className="truncate text-[11px] text-muted-foreground">{r.firm}</p>
        ) : null}
      </div>
      <span className="hidden shrink-0 text-right text-[11px] text-muted-foreground sm:block">
        {r.nextTouch
          ? `Next ${fmt(r.nextTouch)}`
          : r.lastTouch
          ? `Last ${fmt(r.lastTouch)}`
          : "—"}
      </span>
      <span
        className={`justify-self-end rounded-full border px-2 py-0.5 text-[10px] font-medium ${st.cls}`}
      >
        {st.label}
      </span>
    </div>
  );
}

function ConversationRow({ c }: { c: NsConversation }) {
  return (
    <li className="grid grid-cols-[1fr] gap-x-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/30 sm:grid-cols-[92px_74px_1fr]">
      <span className="hidden shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground sm:block">
        {fmt(c.date)}
      </span>
      <span className="hidden pt-0.5 sm:block">
        <span className="rounded-sm border border-border px-1 py-0.5 text-[9px] uppercase text-muted-foreground">
          {chLabel(c.channel)}
        </span>
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-medium">
            {c.name}
            {c.firm ? (
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                · {c.firm}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground sm:hidden">
            {chLabel(c.channel)} · {fmt(c.date)}
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

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{text}</p>;
}
