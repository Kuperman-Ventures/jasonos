"use client";

import Link from "next/link";
import { callOfThree, statusLabel } from "@/lib/meeting-prep/people";
import type { PersonListRow } from "@/lib/server-actions/person";
import { ExportLog } from "./export-log";
import { OverduePill, Past48hPill, shortDay } from "./people-pills";

export function PeopleIndexClient({
  people,
  error,
  weekStart,
}: {
  people: PersonListRow[];
  error: string | null;
  weekStart: string;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 min-[900px]:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--jos-ink)]">People</h1>
          <p className="mt-1 text-[14px] text-[var(--jos-muted)]">
            Everyone in the networking pipeline. Late referrals and overdue follow-ups first.
          </p>
        </div>
        <ExportLog weekStart={weekStart} />
      </header>
      {error ? <p className="text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {people.length === 0 && !error ? (
        <p className="text-[15px] text-[var(--jos-muted)]">No one in the pipeline yet.</p>
      ) : null}
      {people.length ? (
        <ul className="divide-y divide-[var(--jos-line)] border-y border-[var(--jos-line)]">
          {people.map((person) => (
            <li key={person.id}>
              <Link
                href={`/live/people/${person.id}`}
                className="grid grid-cols-1 gap-x-4 gap-y-1 px-1 py-3 hover:bg-[var(--jos-surface)] focus-visible:bg-[var(--jos-surface)] focus-visible:outline-none min-[700px]:grid-cols-[minmax(0,1fr)_9rem_7rem_9rem] min-[700px]:items-center"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-bold text-[var(--jos-ink)]">{person.name}</span>
                  {person.company ? (
                    <span className="block truncate text-[14px] text-[var(--jos-muted)]">{person.company}</span>
                  ) : null}
                </span>
                <span className="text-[14px] text-[var(--jos-ink)]">{statusLabel(person.status)}</span>
                <span className="text-[14px] tabular-nums text-[var(--jos-muted)]">{callOfThree(person.touchCount)}</span>
                <span className="flex flex-wrap items-center gap-2 text-[14px] tabular-nums text-[var(--jos-ink)] min-[700px]:justify-end">
                  {person.overdue48h ? <Past48hPill /> : null}
                  {person.overdueNext ? <OverduePill /> : null}
                  {person.nextContact ? (
                    <span>Next {shortDay(person.nextContact)}</span>
                  ) : (
                    <span className="text-[var(--jos-muted)]">No next contact</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
