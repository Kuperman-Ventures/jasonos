"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CADENCE_RULE, type RelationshipMetrics } from "@/lib/meeting-prep/metrics";

function dayLabel(value: string | null): string {
  if (!value) return "none";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function split(counts: { mine: number; theirs: number }): string {
  return `${counts.mine} mine · ${counts.theirs} theirs`;
}

export function LiveMetricsClient({
  metrics,
  days,
  error,
}: {
  metrics: RelationshipMetrics | null;
  days: number;
  error: string | null;
}) {
  const router = useRouter();
  const tiles = metrics
    ? [
        { label: "First meetings", value: String(metrics.firstMeetings) },
        { label: "Repeat meetings", value: String(metrics.repeatMeetings) },
        { label: "Repeat within cadence", value: String(metrics.repeatWithinCadence) },
        { label: "Commitments opened", value: split(metrics.commitmentsOpened) },
        { label: "Commitments closed", value: split(metrics.commitmentsClosed) },
        {
          label: "Mark agreement",
          value: metrics.markAgreement.total
            ? `${metrics.markAgreement.agree} of ${metrics.markAgreement.total}`
            : "0 of 0",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Link
        href="/live/library"
        className="inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
      >
        <ChevronLeft className="size-4" />
        Library
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--jos-ink)]">Metrics</h1>
          {metrics ? (
            <p className="text-[14px] text-[var(--jos-muted)]">
              {dayLabel(metrics.from)} through {dayLabel(metrics.to)}
            </p>
          ) : null}
        </div>
        <label className="space-y-1">
          <span className="block text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">Window</span>
          <select
            aria-label="Window"
            value={String(days)}
            className="h-9 bg-transparent text-[14px] font-semibold outline-none"
            onChange={(event) => router.replace(`/live/metrics?days=${event.target.value}`)}
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
          </select>
        </label>
      </header>

      {error ? <p className="text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}

      {metrics ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((tile) => (
              <div key={tile.label} className="border border-[var(--color-neutral-400)] bg-[var(--jos-surface)] p-3">
                <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">{tile.label}</p>
                <p className="mt-1 text-[22px] font-semibold tracking-tight text-[var(--jos-ink)]">{tile.value}</p>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-[var(--jos-muted)]">{CADENCE_RULE}</p>
          {metrics.commitmentsSince ? (
            <p className="text-[13px] text-[var(--jos-muted)]">
              Commitment counts use dates stored on each commitment, since {dayLabel(metrics.commitmentsSince)}. Older
              commitments have no date and are not counted.
            </p>
          ) : null}

          <section className="space-y-2">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">By strategy</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[14px]">
                <thead className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                  <tr>
                    <th className="py-2 pr-3 font-bold">Strategy</th>
                    <th className="py-2 pr-3 font-bold">Meetings</th>
                    <th className="py-2 pr-3 font-bold">Hit</th>
                    <th className="py-2 pr-3 font-bold">Partial</th>
                    <th className="py-2 pr-3 font-bold">Missed</th>
                    <th className="py-2 pr-3 font-bold">Unmarked</th>
                    <th className="py-2 font-bold">Asks</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byStrategy.length === 0 ? (
                    <tr>
                      <td className="py-2 text-[var(--jos-muted)]" colSpan={7}>
                        No Live meetings in this window.
                      </td>
                    </tr>
                  ) : (
                    metrics.byStrategy.map((row) => (
                      <tr key={row.id ?? "none"} className="border-t border-[var(--jos-line)]">
                        <td className="py-2 pr-3">{row.name}</td>
                        <td className="py-2 pr-3">{row.meetings}</td>
                        <td className="py-2 pr-3">{row.hit}</td>
                        <td className="py-2 pr-3">{row.partial}</td>
                        <td className="py-2 pr-3">{row.missed}</td>
                        <td className="py-2 pr-3">{row.unmarked}</td>
                        <td className="py-2">
                          {row.asksCovered}/{row.asksTotal}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">By person</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-[14px]">
                <thead className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                  <tr>
                    <th className="py-2 pr-3 font-bold">Name</th>
                    <th className="py-2 pr-3 font-bold">Live meetings</th>
                    <th className="py-2 pr-3 font-bold">First</th>
                    <th className="py-2 pr-3 font-bold">Last</th>
                    <th className="py-2 pr-3 font-bold">Avg days</th>
                    <th className="py-2 pr-3 font-bold">Open theirs</th>
                    <th className="py-2 pr-3 font-bold">Open mine</th>
                    <th className="py-2 font-bold">Next touch</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byPerson.length === 0 ? (
                    <tr>
                      <td className="py-2 text-[var(--jos-muted)]" colSpan={8}>
                        No people in this window.
                      </td>
                    </tr>
                  ) : (
                    metrics.byPerson.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--jos-line)]">
                        <td className="py-2 pr-3">
                          <Link href={`/live/library?person=${row.id}`} className="font-semibold hover:underline">
                            {row.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">{row.meetings}</td>
                        <td className="py-2 pr-3">{dayLabel(row.firstMeeting)}</td>
                        <td className="py-2 pr-3">{dayLabel(row.lastMeeting)}</td>
                        <td className="py-2 pr-3">{row.avgDaysBetween ?? ""}</td>
                        <td className="py-2 pr-3">{row.openTheirs}</td>
                        <td className="py-2 pr-3">{row.openMine}</td>
                        <td className="py-2">
                          {dayLabel(row.nextTouchDate)}
                          {row.nextTouchOverdue ? " · overdue" : ""}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
