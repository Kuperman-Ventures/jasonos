"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SCOREBOARD_STATUSES,
  SCOREBOARD_STATUS_DOT,
  SCOREBOARD_STATUS_LABELS,
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

export function ScoreboardClient({
  applications,
}: {
  applications: ScoreboardApplication[];
}) {
  const [rows, setRows] = useState(applications);
  const [filter, setFilter] = useState<ScoreboardStatus | "all">("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    const map = Object.fromEntries(
      SCOREBOARD_STATUSES.map((s) => [s, 0])
    ) as Record<ScoreboardStatus, number>;
    for (const row of rows) map[row.scoreboard_status] += 1;
    return map;
  }, [rows]);

  const visible = useMemo(
    () =>
      filter === "all"
        ? rows
        : rows.filter((row) => row.scoreboard_status === filter),
    [rows, filter]
  );

  const onSelect = (id: string, status: ScoreboardStatus) => {
    const prev = rows.find((r) => r.id === id)?.scoreboard_status;
    if (prev === status) return;

    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, scoreboard_status: status } : row
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
          Track where each submitted application stands.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Submitted Applications
            </h2>
            <p className="text-xs text-muted-foreground">
              From NYUI · {rows.length} total
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label={`All ${rows.length}`}
            />
            {SCOREBOARD_STATUSES.map((status) => (
              <FilterChip
                key={status}
                active={filter === status}
                onClick={() => setFilter(status)}
                label={`${SCOREBOARD_STATUS_LABELS[status]} ${counts[status]}`}
                dotClass={SCOREBOARD_STATUS_DOT[status]}
              />
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {visible.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? "No submitted applications logged in NYUI yet."
                : "Nothing in this status."}
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

function FilterChip({
  active,
  onClick,
  label,
  dotClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dotClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
        active
          ? "border-foreground/30 bg-muted text-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {dotClass ? (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
      ) : null}
      {label}
    </button>
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
    </div>
  );
}
