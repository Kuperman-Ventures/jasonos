"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react";
import { LIVE_SECTION_LABEL } from "@/components/jasonos/live";
import { type RelationshipMetrics } from "@/lib/meeting-prep/metrics";
import { cn } from "@/lib/utils";

function dayLabel(value: string | null): string {
  if (!value) return "n/a";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function overdueDays(nextTouchDate: string, today: string): number {
  const [ay, am, ad] = nextTouchDate.split("-").map(Number);
  const [by, bm, bd] = today.split("-").map(Number);
  return Math.max(
    1,
    Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
  );
}

function OutcomeBar({
  hit,
  partial,
  missed,
  unmarked,
}: {
  hit: number;
  partial: number;
  missed: number;
  unmarked: number;
}) {
  const total = hit + partial + missed + unmarked;
  if (!total) {
    return <div className="h-3.5 w-full bg-[#d8d6d6]" />;
  }
  const segments = [
    { key: "hit", value: hit, color: "var(--color-done)" },
    { key: "partial", value: partial, color: "var(--color-process-yellow)" },
    { key: "missed", value: missed, color: "var(--color-accent-2)" },
    { key: "unmarked", value: unmarked, color: "#d8d6d6" },
  ].filter((segment) => segment.value > 0);

  return (
    <div className="flex h-3.5 w-full gap-0.5">
      {segments.map((segment) => (
        <div
          key={segment.key}
          className="min-w-[2px]"
          style={{
            flex: segment.value,
            backgroundColor: segment.color,
          }}
          title={`${segment.key}: ${segment.value}`}
        />
      ))}
    </div>
  );
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
  const windows = [30, 90, 180] as const;
  const agreementPercent =
    metrics && metrics.markAgreement.total
      ? Math.round((metrics.markAgreement.agree / metrics.markAgreement.total) * 100)
      : 0;

  const tiles = metrics
    ? [
        {
          label: "First meetings",
          value: String(metrics.firstMeetings),
          sub: null as string | null,
        },
        {
          label: "Repeat meetings",
          value: String(metrics.repeatMeetings),
          sub: null,
        },
        {
          label: "Repeat within cadence",
          value: String(metrics.repeatWithinCadence),
          sub: `of ${metrics.repeatMeetings}`,
        },
        {
          label: "Commitments opened",
          value: String(metrics.commitmentsOpened.mine),
          sub: `${metrics.commitmentsOpened.theirs} theirs`,
          unit: "yours",
        },
        {
          label: "Commitments closed",
          value: String(metrics.commitmentsClosed.mine),
          sub: `${metrics.commitmentsClosed.theirs} theirs`,
          unit: "yours",
        },
        {
          label: "Mark agreement",
          value: `${agreementPercent}%`,
          sub: "Your mark matches the review",
        },
      ]
    : [];

  const strategyRows = (metrics?.byStrategy ?? []).filter((row) => row.meetings > 0);
  const today = metrics?.to ?? "";

  return (
    <div className="px-10 py-8">
      <Link
        href="/live"
        className="inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
      >
        <CaretLeft size={14} weight="bold" aria-hidden />
        Live
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[44px] font-extrabold leading-none tracking-[-0.02em]">Metrics</h1>
        <div className="flex gap-1">
          {windows.map((window) => (
            <button
              key={window}
              type="button"
              onClick={() => router.replace(`/live/metrics?days=${window}`)}
              className={cn(
                "min-w-14 px-3 py-1.5 text-[13px] font-bold",
                days === window
                  ? "bg-[var(--jos-ink)] text-[var(--jos-bg)]"
                  : "bg-[var(--jos-surface)] text-[var(--jos-ink)]"
              )}
            >
              {window}
            </button>
          ))}
        </div>
      </header>

      {error ? <p className="mt-4 text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}

      {metrics ? (
        <>
          <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 min-[900px]:grid-cols-2 min-[1280px]:grid-cols-3">
            {tiles.map((tile) => (
              <div key={tile.label} className="border-t-2 border-[var(--jos-ink)] pt-3">
                <p className={LIVE_SECTION_LABEL}>{tile.label}</p>
                <p className="mt-2 text-[48px] font-extrabold leading-none tracking-tight tabular-nums">
                  {tile.value}
                  {"unit" in tile && tile.unit ? (
                    <span className="ml-2 text-[15px] font-medium text-[var(--jos-muted)]">
                      {tile.unit}
                    </span>
                  ) : null}
                </p>
                {tile.sub ? (
                  <p className="mt-2 text-[14px] text-[#4a4747]">{tile.sub}</p>
                ) : null}
              </div>
            ))}
          </div>

          <section className="mt-14">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[24px] font-extrabold tracking-tight">By strategy</h2>
              <div className="flex flex-wrap items-center gap-3 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                {[
                  { label: "Hit", color: "var(--color-done)" },
                  { label: "Partial", color: "var(--color-process-yellow)" },
                  { label: "Missed", color: "var(--color-accent-2)" },
                  { label: "Unmarked", color: "#d8d6d6" },
                ].map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3 overflow-x-auto border-t-2 border-[var(--jos-ink)]">
              <table className="w-full min-w-[720px] text-left text-[14px]">
                <thead>
                  <tr className={LIVE_SECTION_LABEL}>
                    <th className="py-3 pr-3 font-bold">Strategy</th>
                    <th className="py-3 pr-3 font-bold tabular-nums">Meetings</th>
                    <th className="py-3 pr-3 font-bold">Outcomes</th>
                    <th className="py-3 font-bold">Asks covered</th>
                  </tr>
                </thead>
                <tbody>
                  {strategyRows.length === 0 ? (
                    <tr>
                      <td className="py-3 text-[var(--jos-muted)]" colSpan={4}>
                        No Live meetings in this window.
                      </td>
                    </tr>
                  ) : (
                    strategyRows.map((row) => (
                      <tr key={row.id ?? "none"} className="border-t border-[var(--jos-line)]">
                        <td className="py-3 pr-3 font-bold">{row.name}</td>
                        <td className="py-3 pr-3 tabular-nums">{row.meetings}</td>
                        <td className="py-3 pr-3 min-w-[160px]">
                          <OutcomeBar
                            hit={row.hit}
                            partial={row.partial}
                            missed={row.missed}
                            unmarked={row.unmarked}
                          />
                        </td>
                        <td className="py-3 tabular-nums">
                          {row.asksCovered} of {row.asksTotal}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-14">
            <h2 className="text-[24px] font-extrabold tracking-tight">By person</h2>
            <div className="mt-3 overflow-x-auto border-t-2 border-[var(--jos-ink)]">
              <table className="w-full min-w-[880px] text-left text-[14px]">
                <thead>
                  <tr className={LIVE_SECTION_LABEL}>
                    <th className="py-3 pr-3 font-bold">Person</th>
                    <th className="py-3 pr-3 font-bold">Meetings</th>
                    <th className="py-3 pr-3 font-bold">First</th>
                    <th className="py-3 pr-3 font-bold">Last</th>
                    <th className="py-3 pr-3 font-bold">Avg days apart</th>
                    <th className="py-3 pr-3 font-bold">Open commitments</th>
                    <th className="py-3 font-bold">Next touch</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byPerson.length === 0 ? (
                    <tr>
                      <td className="py-3 text-[var(--jos-muted)]" colSpan={7}>
                        No people in this window.
                      </td>
                    </tr>
                  ) : (
                    metrics.byPerson.map((row) => {
                      const openTotal = row.openMine + row.openTheirs;
                      return (
                        <tr key={row.id} className="border-t border-[var(--jos-line)]">
                          <td className="py-3 pr-3">
                            <Link
                              href={`/live/library?person=${row.id}`}
                              className="font-bold hover:underline"
                            >
                              {row.name}
                            </Link>
                            {row.company ? (
                              <span className="text-[var(--jos-muted)]"> · {row.company}</span>
                            ) : null}
                          </td>
                          <td className="py-3 pr-3 tabular-nums">{row.meetings}</td>
                          <td className="py-3 pr-3 tabular-nums">{dayLabel(row.firstMeeting)}</td>
                          <td className="py-3 pr-3 tabular-nums">{dayLabel(row.lastMeeting)}</td>
                          <td className="py-3 pr-3 tabular-nums">
                            {row.avgDaysBetween == null ? "n/a" : row.avgDaysBetween}
                          </td>
                          <td
                            className={cn(
                              "py-3 pr-3 font-semibold tabular-nums",
                              openTotal > 0
                                ? "text-[var(--color-todo)]"
                                : "font-normal text-[var(--jos-muted)]"
                            )}
                          >
                            {openTotal > 0 ? openTotal : "None"}
                          </td>
                          <td className="py-3">
                            {!row.nextTouchDate ? (
                              <span className="text-[var(--jos-muted)]">Not set</span>
                            ) : row.nextTouchOverdue ? (
                              <span className="inline-flex bg-[var(--color-accent-2)] px-2 py-0.5 text-[12px] font-bold text-white">
                                Overdue {overdueDays(row.nextTouchDate, today)} d
                              </span>
                            ) : (
                              <span className="tabular-nums">{dayLabel(row.nextTouchDate)}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
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
