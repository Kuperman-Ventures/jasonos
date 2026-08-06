"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  SCOREBOARD_STATUSES,
  SCOREBOARD_STATUS_DOT,
  SCOREBOARD_STATUS_LABELS,
  SCOREBOARD_SUBMITTED_STALE_DAYS,
  type ScoreboardApplication,
  type ScoreboardStatus,
} from "@/lib/scoreboard/types";
import { setScoreboardStatus } from "@/lib/server-actions/scoreboard";

function fmtDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function matchesSearch(row: ScoreboardApplication, q: string) {
  return [
    row.company_name,
    row.position_applied,
    row.contact_method,
    row.result,
    SCOREBOARD_STATUS_LABELS[row.scoreboard_status],
    fmtDate(row.date),
  ]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(q));
}

export function ScoreboardClient({
  applications,
}: {
  applications: ScoreboardApplication[];
}) {
  const [rows, setRows] = useState(applications);
  const [filter, setFilter] = useState<ScoreboardStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    const map = Object.fromEntries(
      SCOREBOARD_STATUSES.map((s) => [s, 0])
    ) as Record<ScoreboardStatus, number>;
    for (const row of rows) map[row.scoreboard_status] += 1;
    return map;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.scoreboard_status !== filter) return false;
      if (q && !matchesSearch(row, q)) return false;
      return true;
    });
  }, [rows, filter, query]);

  const hasActiveSearch = query.trim().length > 0;

  const onSelect = (id: string, status: ScoreboardStatus) => {
    const prev = rows.find((r) => r.id === id)?.scoreboard_status;
    if (prev === status) return;

    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              scoreboard_status: status,
              scoreboard_status_set_at: new Date().toISOString(),
            }
          : row
      )
    );
    setPendingId(id);
    startTransition(async () => {
      const result = await setScoreboardStatus(id, status);
      setPendingId(null);
      if (!result.ok) {
        setRows((current) =>
          current.map((row) =>
            row.id === id && prev
              ? { ...row, scoreboard_status: prev }
              : row
          )
        );
        toast.error(result.error ?? "Couldn't update status");
        return;
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Scoreboard</h1>
        <p className="text-sm text-muted-foreground">
          Track where each submitted application stands. Blues age to orange
          after {SCOREBOARD_SUBMITTED_STALE_DAYS} days unless you move them.
        </p>
      </header>

      <StatusSummary
        total={rows.length}
        counts={counts}
        filter={filter}
        onFilter={setFilter}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Submitted Applications
            </h2>
            <p className="text-xs text-muted-foreground">
              From NYUI
              {hasActiveSearch || filter !== "all"
                ? ` · ${visible.length} of ${rows.length}`
                : ` · ${rows.length} total`}
              {filter !== "all"
                ? ` · ${SCOREBOARD_STATUS_LABELS[filter]}`
                : null}
              {hasActiveSearch ? ` · “${query.trim()}”` : null}
            </p>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company or role…"
              className="h-9 pl-8"
              aria-label="Search applications"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {visible.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {rows.length === 0 ? (
                "No submitted applications logged in NYUI yet."
              ) : hasActiveSearch ? (
                <div className="space-y-2">
                  <p>
                    No applications match &ldquo;{query.trim()}&rdquo;
                    {filter !== "all"
                      ? ` in ${SCOREBOARD_STATUS_LABELS[filter]}`
                      : null}
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-xs text-foreground underline underline-offset-2"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                "Nothing in this status."
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((app) => (
                <li
                  key={app.id}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 transition-opacity",
                    pendingId === app.id && "opacity-60"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="truncate text-sm font-medium text-foreground">
                        {app.company_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {app.position_applied}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {fmtDate(app.date)}
                      {app.contact_method
                        ? ` · ${app.contact_method}`
                        : null}
                    </p>
                  </div>

                  <StatusDots
                    value={app.scoreboard_status}
                    disabled={pendingId === app.id}
                    onSelect={(status) => onSelect(app.id, status)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <Legend />
      </section>
    </div>
  );
}

function StatusSummary({
  total,
  counts,
  filter,
  onFilter,
}: {
  total: number;
  counts: Record<ScoreboardStatus, number>;
  filter: ScoreboardStatus | "all";
  onFilter: (next: ScoreboardStatus | "all") => void;
}) {
  const max = Math.max(1, ...SCOREBOARD_STATUSES.map((s) => counts[s]));

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/30">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 px-5 py-5">
        <button
          type="button"
          onClick={() => onFilter("all")}
          className={cn(
            "text-left transition-opacity",
            filter !== "all" && "opacity-70 hover:opacity-100"
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Pipeline
          </p>
          <p className="mt-1 font-heading text-5xl font-semibold tracking-tight tabular-nums text-foreground">
            {total}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            applications in play
          </p>
        </button>

        <div className="flex min-w-[12rem] flex-1 flex-col justify-end gap-2 pb-1 sm:max-w-xs">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {SCOREBOARD_STATUSES.map((status) => {
              const n = counts[status];
              if (!n) return null;
              return (
                <button
                  key={status}
                  type="button"
                  title={`${SCOREBOARD_STATUS_LABELS[status]}: ${n}`}
                  onClick={() => onFilter(status)}
                  className={cn(
                    "h-full transition-opacity hover:opacity-90",
                    SCOREBOARD_STATUS_DOT[status],
                    filter !== "all" && filter !== status && "opacity-30"
                  )}
                  style={{ width: `${(n / total) * 100 || 0}%` }}
                />
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Click a bar or card to filter the list
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-5">
        {SCOREBOARD_STATUSES.map((status) => {
          const n = counts[status];
          const active = filter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => onFilter(active ? "all" : status)}
              className={cn(
                "relative flex flex-col gap-2 bg-card px-4 py-4 text-left transition-colors hover:bg-muted/40",
                active && "bg-muted/50 ring-1 ring-inset ring-foreground/15"
              )}
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  SCOREBOARD_STATUS_DOT[status]
                )}
              />
              <span className="font-heading text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                {n}
              </span>
              <span className="text-[11px] font-medium leading-tight text-muted-foreground">
                {SCOREBOARD_STATUS_LABELS[status]}
              </span>
              <span
                className="absolute inset-x-4 bottom-0 h-0.5 origin-left rounded-full bg-current opacity-20"
                style={{
                  color: "currentColor",
                  transform: `scaleX(${n / max})`,
                }}
                aria-hidden
              />
              <span
                className={cn(
                  "absolute inset-x-4 bottom-0 h-0.5 origin-left rounded-full",
                  SCOREBOARD_STATUS_DOT[status]
                )}
                style={{ transform: `scaleX(${n / max})` }}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StatusDots({
  value,
  disabled,
  onSelect,
}: {
  value: ScoreboardStatus;
  disabled?: boolean;
  onSelect: (status: ScoreboardStatus) => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5"
      role="radiogroup"
      aria-label="Application status"
    >
      {SCOREBOARD_STATUSES.map((status) => {
        const selected = value === status;
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={SCOREBOARD_STATUS_LABELS[status]}
            title={SCOREBOARD_STATUS_LABELS[status]}
            disabled={disabled}
            onClick={() => onSelect(status)}
            className={cn(
              "grid h-6 w-6 place-items-center rounded-full transition-transform outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "scale-110" : "opacity-40 hover:opacity-80",
              disabled && "cursor-not-allowed"
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                SCOREBOARD_STATUS_DOT[status],
                selected && "ring-2 ring-offset-2 ring-offset-card ring-foreground/40"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {SCOREBOARD_STATUSES.map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span
            className={cn("h-2 w-2 rounded-full", SCOREBOARD_STATUS_DOT[status])}
          />
          {SCOREBOARD_STATUS_LABELS[status]}
        </span>
      ))}
      <span className="text-muted-foreground/70">
        · Blue → orange after {SCOREBOARD_SUBMITTED_STALE_DAYS}d if untouched
      </span>
    </div>
  );
}
