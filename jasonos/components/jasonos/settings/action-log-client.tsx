"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  actionLogDayKey,
  actionLogDayLabel,
  actionLogHaystack,
  actionLogTimeLabel,
  type ActionLogRow,
} from "@/lib/actions/action-log-format";
import {
  groupUpcoming,
  upcomingHaystack,
  upcomingRowWhen,
  type UpcomingItem,
} from "@/lib/actions/upcoming-format";

export function ActionLogClient({
  rows,
  upcoming,
  today,
  capped,
}: {
  rows: ActionLogRow[];
  upcoming: UpcomingItem[];
  today: string;
  capped: boolean;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const visibleUpcoming = useMemo(() => {
    if (!needle) return upcoming;
    return upcoming.filter((item) => upcomingHaystack(item, today).includes(needle));
  }, [needle, today, upcoming]);

  const upcomingGroups = useMemo(
    () => groupUpcoming(visibleUpcoming, today),
    [today, visibleUpcoming]
  );

  const visible = useMemo(() => {
    if (!needle) return rows;
    return rows.filter((row) => actionLogHaystack(row).includes(needle));
  }, [needle, rows]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byDay = new Map<string, ActionLogRow[]>();
    for (const row of visible) {
      const key = actionLogDayKey(row.acted_at) || row.id;
      const list = byDay.get(key);
      if (list) list.push(row);
      else {
        byDay.set(key, [row]);
        order.push(key);
      }
    }
    return order.map((key) => ({
      key,
      label: actionLogDayLabel(byDay.get(key)?.[0]?.acted_at ?? key),
      rows: byDay.get(key) ?? [],
    }));
  }, [visible]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a name, snooze, or day"
          aria-label="Search the action log"
          className="h-8 sm:w-64"
        />
      </div>
      <UpcomingSection
        groups={upcomingGroups}
        shown={visibleUpcoming.length}
        total={upcoming.length}
        filtered={Boolean(needle)}
        today={today}
      />
      <HistorySection
        groups={groups}
        shown={visible.length}
        total={rows.length}
        filtered={Boolean(needle)}
        capped={capped}
        empty={rows.length === 0}
      />
    </div>
  );
}

function UpcomingSection({
  groups,
  shown,
  total,
  filtered,
  today,
}: {
  groups: ReturnType<typeof groupUpcoming>;
  shown: number;
  total: number;
  filtered: boolean;
  today: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">Coming up</h2>
          <p className="text-[12px] text-muted-foreground">
            Snoozes and dates you set. They stay on this list until you deal with them.
          </p>
        </div>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {shown}
          {filtered ? ` of ${total}` : ""}
        </span>
      </div>
      {total === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          Nothing is waiting. Snooze a follow-up or set a day and it shows up here.
        </p>
      ) : groups.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          No matches for that search.
        </p>
      ) : (
        <div>
          {groups.map((group) => (
            <div key={group.key}>
              <h3 className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </h3>
              <ul>
                {group.rows.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4"
                  >
                    <p className="w-32 shrink-0 text-[12px] text-muted-foreground">
                      {upcomingRowWhen(item.dueOn, today)}
                    </p>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-muted-foreground">{item.area}</p>
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="mt-0.5 block text-sm font-medium underline underline-offset-2"
                        >
                          {item.subject}
                        </Link>
                      ) : (
                        <p className="mt-0.5 text-sm font-medium">{item.subject}</p>
                      )}
                      {item.detail ? (
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{item.detail}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HistorySection({
  groups,
  shown,
  total,
  filtered,
  capped,
  empty,
}: {
  groups: { key: string; label: string; rows: ActionLogRow[] }[];
  shown: number;
  total: number;
  filtered: boolean;
  capped: boolean;
  empty: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-tight">What you did</h2>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {shown}
          {filtered ? ` of ${total}` : ""}
        </span>
      </div>
      {empty ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          Nothing recorded yet. Snooze, skip, or mark a follow-up done and it
          shows up here.
        </p>
      ) : groups.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          No matches for that search.
        </p>
      ) : (
        <div>
          {groups.map((group) => (
            <div key={group.key}>
              <h3 className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </h3>
              <ul>
                {group.rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4"
                  >
                    <p className="w-20 shrink-0 text-[12px] tabular-nums text-muted-foreground">
                      {actionLogTimeLabel(row.acted_at)}
                    </p>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-medium">{row.verb}</span>
                        <span className="text-muted-foreground"> · {row.area}</span>
                        {row.actor === "claude" ? (
                          <span className="text-muted-foreground"> · Claude</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-sm">{row.subject}</p>
                      {row.detail ? (
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          {row.detail}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {capped && !filtered ? (
            <p className="px-4 py-3 text-center text-[11px] text-muted-foreground">
              Showing the latest {total}.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
