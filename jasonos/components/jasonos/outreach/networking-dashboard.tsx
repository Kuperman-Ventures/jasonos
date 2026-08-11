"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Inbox,
  MessageSquare,
  Newspaper,
  Sparkles,
  UserPlus,
  Briefcase,
} from "lucide-react";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import type { NetworkingReport } from "@/lib/server-actions/networking-status";

// Site-styled twin of the Browning Weekly Report paper. Same getNetworkingReport
// payload — every person name opens the contact card.

function weekHref(weekStart: string): string {
  return `/outreach/dashboard?week=${weekStart}`;
}

function ContactName({
  id,
  name,
  onOpen,
}: {
  id: string;
  name: string;
  onOpen: (id: string, name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(id, name)}
      className="font-medium text-sky-300 underline decoration-sky-400/30 underline-offset-2 hover:text-sky-200 hover:decoration-sky-300"
    >
      {name}
    </button>
  );
}

function Section({
  icon,
  title,
  children,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2.5 border-b-2 border-border px-4 py-3.5">
        <span className="text-foreground/70 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">
          {title}
        </h2>
        {hint ? (
          <span className="ml-auto rounded-md bg-muted/60 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </div>
      <div className="p-4 pt-5">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-4 text-center text-xs italic text-muted-foreground">
      {children}
    </p>
  );
}

function FigureCard({
  label,
  value,
  qualifier,
  hotZero,
}: {
  label: string;
  value: number;
  qualifier: string;
  hotZero?: boolean;
}) {
  const zeroHot = hotZero && value === 0;
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-4xl font-semibold tabular-nums leading-none ${
          zeroHot ? "text-rose-300" : value > 0 && hotZero ? "text-emerald-300" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-[12px] text-muted-foreground">{qualifier}</p>
    </div>
  );
}

export function NetworkingDashboard({ report }: { report: NetworkingReport }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [openName, setOpenName] = useState<string | null>(null);

  const open = (id: string, name: string) => {
    setOpenId(id);
    setOpenName(name);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Same week as the Browning Weekly Report — names open the contact card.
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {report.weekLabel}
            <span className="mx-1.5 text-border">·</span>
            No. {report.issueNumber}
            <span className="mx-1.5 text-border">·</span>
            {report.summary}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={weekHref(report.prevWeekStart)}
            className="rounded-md border bg-background/60 px-2.5 py-1.5 text-[12px] font-medium hover:bg-muted"
            prefetch={false}
          >
            ← Previous week
          </Link>
          {!report.isCurrentWeek ? (
            <Link
              href="/outreach/dashboard"
              className="rounded-md border bg-background/60 px-2.5 py-1.5 text-[12px] font-medium hover:bg-muted"
              prefetch={false}
            >
              This week
            </Link>
          ) : null}
          {report.nextWeekStart ? (
            <Link
              href={weekHref(report.nextWeekStart)}
              className="rounded-md border bg-background/60 px-2.5 py-1.5 text-[12px] font-medium hover:bg-muted"
              prefetch={false}
            >
              Next week →
            </Link>
          ) : (
            <span className="rounded-md border border-border/60 px-2.5 py-1.5 text-[12px] text-muted-foreground opacity-70">
              Next week →
            </span>
          )}
          <Link
            href={
              report.isCurrentWeek
                ? "/activity"
                : `/activity?week=${report.weekStart}`
            }
            className="rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
            prefetch={false}
          >
            Open print report
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <FigureCard
          label="Reached out"
          value={report.reachedOut}
          qualifier={report.reachedQualifier}
        />
        <FigureCard
          label="Met with"
          value={report.metWith}
          qualifier={report.metQualifier}
        />
        <FigureCard
          label="Referrals given"
          value={report.referralsGiven}
          qualifier={report.referralsQualifier}
          hotZero
        />
      </div>

      {/* Outreach | Upcoming — aligned like the paper report */}
      <div
        className={
          report.isCurrentWeek
            ? "grid gap-5 lg:grid-cols-2"
            : "grid gap-5"
        }
      >
        <Section
          icon={<Inbox className="h-4 w-4" />}
          title="Fresh outreach"
          hint={`${report.outreach.length}`}
        >
          {report.outreach.length === 0 ? (
            <Empty>
              No fresh outreach this week. Only people you hadn&rsquo;t contacted
              in 90+ days count — ongoing follow-ups stay off this list.
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {report.outreach.map((o) => (
                <li
                  key={o.contactId}
                  className="flex items-baseline justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <ContactName id={o.contactId} name={o.name} onOpen={open} />
                    {(o.company || o.role) && (
                      <p className="truncate text-[12px] text-muted-foreground">
                        {o.company}
                        {o.company && o.role ? " · " : ""}
                        {o.role ? (
                          <span className="text-sky-300/90">{o.role}</span>
                        ) : null}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {o.channel} · {o.date}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {report.isCurrentWeek ? (
          <Section
            icon={<CalendarDays className="h-4 w-4" />}
            title="Upcoming meetings"
            hint={`${report.upcomingMeetings.length}`}
          >
            {report.upcomingMeetings.length === 0 ? (
              <Empty>None scheduled.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {report.upcomingMeetings.map((m, i) => (
                  <li
                    key={`${m.contactId}-${m.date}-${i}`}
                    className="flex items-baseline justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <ContactName
                        id={m.contactId}
                        name={m.name}
                        onOpen={open}
                      />
                      <p className="truncate text-[12px] text-muted-foreground">
                        {[m.company, m.medium, m.time].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {m.date}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          icon={<MessageSquare className="h-4 w-4" />}
          title="Meetings"
          hint={`${report.meetings.length}`}
        >
          {report.meetings.length === 0 ? (
            <Empty>
              {report.reachedOut > 0
                ? `None. ${report.reachedOut} thread${
                    report.reachedOut === 1 ? "" : "s"
                  } open, no conversation yet.`
                : "None logged this week."}
            </Empty>
          ) : (
            <ul className="space-y-3">
              {report.meetings.map((m) => (
                <li
                  key={m.contactId}
                  className="rounded-lg border-l-2 border-sky-400/40 pl-3"
                >
                  <div className="text-sm">
                    <ContactName id={m.contactId} name={m.name} onOpen={open} />
                    {m.company ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {m.company}
                      </span>
                    ) : null}{" "}
                    <span className="text-[12px] text-muted-foreground">
                      {m.medium}
                    </span>
                  </div>
                  {m.notes ? (
                    <p className="mt-1 text-[13px] leading-relaxed text-foreground/85">
                      {m.notes}
                    </p>
                  ) : null}
                  {m.referralsProduced > 0 ? (
                    <p className="mt-1 text-[12px] text-sky-300/90">
                      Gave {m.referralsProduced} referral
                      {m.referralsProduced === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          icon={<Sparkles className="h-4 w-4" />}
          title="Referrals"
          hint={`${report.referrals.length} need follow-up`}
        >
          {report.referrals.length === 0 ? (
            <Empty>No referrals need follow-up.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {report.referrals.map((r) => (
                <li
                  key={r.contactId}
                  className="flex items-baseline justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <ContactName id={r.contactId} name={r.name} onOpen={open} />
                    {r.company || r.role ? (
                      <p className="truncate text-[12px] text-muted-foreground">
                        {r.company}
                        {r.company && r.role ? " · " : ""}
                        {r.role ? (
                          <span className="text-sky-300/90">{r.role}</span>
                        ) : null}
                      </p>
                    ) : null}
                    {r.chain.length > 0 ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        via{" "}
                        {r.chain.map((n, i) => (
                          <span key={`${r.chainIds[i]}-${i}`}>
                            {i > 0 ? " → " : null}
                            {r.chainIds[i] ? (
                              <ContactName
                                id={r.chainIds[i]}
                                name={n}
                                onOpen={open}
                              />
                            ) : (
                              n
                            )}
                          </span>
                        ))}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-amber-200/90">
                      {r.followUpText}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {r.date}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 space-y-1 border-t pt-3 text-[12px] text-muted-foreground">
            <div className="flex justify-between gap-2">
              <span>Introductions all time</span>
              <span className="tabular-nums text-foreground">
                {report.tally.allTime}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Of those, met</span>
              <span className="tabular-nums text-foreground">
                {report.tally.ofThoseMet}
              </span>
            </div>
            {report.tally.topConnectorName && report.tally.topConnectorId ? (
              <div className="flex justify-between gap-2">
                <span>
                  Made by{" "}
                  <ContactName
                    id={report.tally.topConnectorId}
                    name={report.tally.topConnectorName}
                    onOpen={open}
                  />
                </span>
                <span className="tabular-nums text-foreground">
                  {report.tally.topConnectorCount}
                </span>
              </div>
            ) : null}
          </div>
        </Section>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Section
          icon={<UserPlus className="h-4 w-4" />}
          title="Added without an introduction"
          hint={`${report.addedWithoutIntro.length}`}
        >
          {report.addedWithoutIntro.length === 0 ? (
            <Empty>None this week.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {report.addedWithoutIntro.map((a) => (
                <li
                  key={a.contactId}
                  className="flex items-baseline justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
                >
                  <ContactName id={a.contactId} name={a.name} onOpen={open} />
                  {a.ranking ? (
                    <span className="text-[11px] text-muted-foreground">
                      {a.ranking}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          icon={<Briefcase className="h-4 w-4" />}
          title="Applications filed"
          hint={`${report.applications.length}`}
        >
          {report.applications.length === 0 ? (
            <Empty>None this week.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {report.applications.map((a, i) => (
                <li
                  key={`${a.company}-${i}`}
                  className="flex items-baseline justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{a.company}</p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {a.role}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {a.date}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Newspaper className="h-3.5 w-3.5" />
        Data source: the same weekly networking report used under Browning.
      </p>

      <OutreachModal
        open={!!openId}
        onOpenChange={(o) => {
          if (!o) {
            setOpenId(null);
            setOpenName(null);
          }
        }}
        contactId={openId}
        initialDisplay={
          openId && openName ? { name: openName, title: null, firm: null } : undefined
        }
      />
    </div>
  );
}
