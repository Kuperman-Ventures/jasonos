"use client";

import { useState } from "react";
import {
  AlertCircle,
  Clock,
  CalendarClock,
  BarChart3,
  ExternalLink,
  ArrowUpRight,
  PlugZap,
} from "lucide-react";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import { TierDegreeBadge } from "@/components/jasonos/outreach/tier-degree-badge";
import { Logo } from "@/components/jasonos/logo";
import type { AttentionContact, HomeData, SitePanel } from "@/lib/data/home";

const COLUMN_LABEL: Record<string, string> = {
  network_growth: "Growth",
  network_maintenance: "Maintenance",
  browning_cold: "Browning",
  // Legacy labels (kept so old payloads still render cleanly).
  warm: "Growth",
  specific: "Growth",
  cold: "Browning",
};

export function HomeClient({
  data,
  children,
}: {
  data: HomeData;
  /** Server-rendered slot (e.g. Morning Brief) placed under the header. */
  children?: React.ReactNode;
}) {
  const [target, setTarget] = useState<AttentionContact | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="flex items-center gap-3">
        <Logo size={36} />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Home</h1>
          <p className="text-xs text-muted-foreground">
            What needs attention across outreach and sites.
          </p>
        </div>
      </header>

      {children}

      {/* ---- Needs attention ------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-3">
        <AttentionCard
          tone="red"
          icon={<AlertCircle className="h-4 w-4" />}
          title="Overdue"
          subtitle="Past their next-touch date"
          contacts={data.overdue}
          emptyText="Nothing overdue. Clear."
          onOpen={setTarget}
          mode="overdue"
        />
        <AttentionCard
          tone="sky"
          icon={<CalendarClock className="h-4 w-4" />}
          title="Due this week"
          subtitle="Today through Friday — same band as the queue"
          contacts={data.dueSoon}
          emptyText="Nothing due this week."
          onOpen={setTarget}
          mode="dueSoon"
        />
        <AttentionCard
          tone="amber"
          icon={<Clock className="h-4 w-4" />}
          title="Cadence drift"
          subtitle="No next touch · cadence lapsed or needs scheduling"
          contacts={data.drift}
          emptyText="No drift — everyone active is scheduled."
          onOpen={setTarget}
          mode="drift"
        />
      </div>

      {/* ---- Pre-launch site traffic ------------------------------------- */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight">Site traffic</h2>
          <span className="text-[11px] text-muted-foreground">last 30 days</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {data.sites.map((s) => (
            <TrafficPanel key={s.key} site={s} />
          ))}
        </div>
      </section>

      <OutreachModal
        open={!!target}
        onOpenChange={(o) => {
          if (!o) setTarget(null);
        }}
        contactId={target?.id}
        initialDisplay={
          target
            ? { name: target.name, title: target.title, firm: target.firm }
            : undefined
        }
      />
    </div>
  );
}

function AttentionCard({
  tone,
  icon,
  title,
  subtitle,
  contacts,
  emptyText,
  onOpen,
  mode,
}: {
  tone: "red" | "amber" | "sky";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  contacts: AttentionContact[];
  emptyText: string;
  onOpen: (c: AttentionContact) => void;
  mode: "overdue" | "dueSoon" | "drift";
}) {
  const headerBg =
    tone === "red"
      ? "bg-red-700/70"
      : tone === "sky"
        ? "bg-sky-700/70"
        : "bg-amber-600/60";
  const accent =
    tone === "red"
      ? "text-red-300"
      : tone === "sky"
        ? "text-sky-300"
        : "text-amber-300";

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className={`flex items-center gap-2 px-4 py-2.5 text-white ${headerBg}`}>
        {icon}
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="ml-auto rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-medium tabular-nums">
          {contacts.length}
        </span>
      </div>
      <p className="border-b px-4 py-1.5 text-[11px] text-muted-foreground">
        {subtitle}
      </p>
      {contacts.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
          {contacts.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onOpen(c)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-muted/40"
              >
                <TierDegreeBadge tier={c.tier} degree={c.degree} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {c.name}
                    {c.firm ? (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">
                        · {c.firm}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <span className="rounded-sm border border-border px-1 py-0.5 text-[9px] uppercase tracking-wider">
                      {COLUMN_LABEL[c.column] ?? c.column}
                    </span>
                    {(mode === "drift" || mode === "dueSoon") && c.note ? (
                      <span className="ml-1.5">{c.note}</span>
                    ) : null}
                  </p>
                </div>
                <span className={`shrink-0 text-[11px] font-medium ${accent}`}>
                  {mode === "overdue"
                    ? `${c.daysOverdue}d overdue`
                    : mode === "dueSoon"
                      ? c.note === "Due today"
                        ? "Today"
                        : c.nextTouch ?? ""
                      : c.note?.startsWith("Set a next")
                        ? "Needs date"
                        : `${c.daysOverdue}d drift`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TrafficPanel({ site }: { site: SitePanel }) {
  const t = site.traffic;
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold tracking-tight">{site.label}</h3>
        {site.url ? (
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            title={site.url}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      {!t.configured ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
          <PlugZap className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-xs font-medium">Connect Web Analytics</p>
          <p className="text-[11px] text-muted-foreground">
            Add the Vercel token + this project&rsquo;s ID to show traffic.
          </p>
        </div>
      ) : !t.ok ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
          <AlertCircle className="h-6 w-6 text-amber-400/70" />
          <p className="text-[11px] text-muted-foreground">{t.error}</p>
        </div>
      ) : (
        <div className="flex-1 space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Visitors" value={t.visitors} />
            <Stat label="Page views" value={t.pageViews} />
          </div>

          <TrafficList
            title="Top pages"
            rows={t.topPages.map((p) => ({
              label: p.path,
              value: p.pageViews,
            }))}
          />
          <TrafficList
            title="Top referrers"
            rows={t.topReferrers.map((r) => ({
              label: r.referrer,
              value: r.pageViews,
            }))}
          />
          {t.topEvents.length > 0 ? (
            <TrafficList
              title="What they do (events)"
              rows={t.topEvents.map((e) => ({ label: e.name, value: e.count }))}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background/60 p-2.5">
      <p className="flex items-center gap-1 text-xl font-semibold tabular-nums leading-none">
        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function TrafficList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-0.5">
        {rows.map((r, i) => (
          <li
            key={`${r.label}-${i}`}
            className="flex items-center justify-between gap-2 text-[11px]"
          >
            <span className="min-w-0 truncate text-foreground/80">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {r.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
