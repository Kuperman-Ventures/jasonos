"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cadenceLabel, type CadenceInterval } from "@/lib/outreach/types";
import { MeetingTitleField } from "@/components/jasonos/meeting-prep/live-rename-field";
import type { OutcomeMark } from "@/lib/server-actions/meeting-prep";
import type {
  LibraryFacets,
  LibraryMeeting,
  LibraryRelationship,
} from "@/lib/server-actions/live-library";

const CADENCES = new Set<string>(["weekly", "biweekly", "triweekly", "monthly", "quarterly", "none"]);

const MARK_PILL: Record<OutcomeMark, { label: string; className: string }> = {
  hit: { label: "Hit", className: "bg-[var(--color-done-100)] text-[var(--color-done)]" },
  partial: { label: "Partial", className: "bg-[var(--jos-warn-tint)] text-[var(--jos-ink)]" },
  missed: {
    label: "Missed",
    className: "bg-[var(--color-accent-2-100)] text-[var(--color-accent-2-text)]",
  },
};

export function OutcomePill({ mark }: { mark: OutcomeMark | null }) {
  if (!mark) {
    return (
      <span className="bg-[var(--color-surface)] px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
        Not marked
      </span>
    );
  }
  const pill = MARK_PILL[mark];
  return (
    <span className={`px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em] ${pill.className}`}>
      {pill.label}
    </span>
  );
}

function easternDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayLabel(value: string | null): string {
  if (!value) return "none";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return easternDate(value);
}

function channelLabel(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

const MARKS: Array<{ id: string; label: string }> = [
  { id: "", label: "All" },
  { id: "hit", label: "Hit" },
  { id: "partial", label: "Partial" },
  { id: "missed", label: "Missed" },
  { id: "unmarked", label: "Unmarked" },
];

function replaceParam(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}

export function LiveLibraryClient({
  meetings,
  facets,
  relationship,
  error,
}: {
  meetings: LibraryMeeting[];
  facets: LibraryFacets;
  relationship: LibraryRelationship | null;
  error: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [seenQ, setSeenQ] = useState(urlQ);
  if (urlQ !== seenQ) {
    setSeenQ(urlQ);
    setQ(urlQ);
  }

  const group = params.get("group") === "strategy" ? "strategy" : "person";
  const person = params.get("person") ?? "";
  const strategy = params.get("strategy") ?? "";
  const mark = params.get("mark") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const push = (next: URLSearchParams) => {
    const query = next.toString();
    router.replace(query ? `/live/library?${query}` : "/live/library");
  };

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    replaceParam(next, key, value);
    push(next);
  };

  const peopleById = new Map(facets.people.map((item) => [item.id, item]));
  const groups = new Map<string, { title: string; meta: string | null; rows: LibraryMeeting[] }>();
  for (const meeting of meetings) {
    const key =
      group === "person" ? meeting.primaryContactId ?? "" : meeting.strategyId ?? "";
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(meeting);
      continue;
    }
    if (group === "person") {
      const facet = key ? peopleById.get(key) : undefined;
      const cadence = facet && CADENCES.has(facet.cadence ?? "")
        ? cadenceLabel(facet.cadence as CadenceInterval)
        : key
          ? "No cadence"
          : null;
      const touch = facet?.lastTouchDate
        ? `last touch ${dayLabel(facet.lastTouchDate)}${channelLabel(facet.lastTouchChannel) ? ` · ${channelLabel(facet.lastTouchChannel)}` : ""}`
        : key
          ? "no last touch"
          : null;
      groups.set(key, {
        title: meeting.primaryContactName || "No person",
        meta: [cadence, touch].filter(Boolean).join(" · ") || null,
        rows: [meeting],
      });
    } else {
      groups.set(key, {
        title: meeting.strategyName || "No strategy",
        meta: null,
        rows: [meeting],
      });
    }
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    if (!a[0]) return 1;
    if (!b[0]) return -1;
    return a[1].title.localeCompare(b[1].title);
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 min-[900px]:px-10">
      <header>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--jos-ink)]">Library</h1>
        <p className="mt-1 text-[14px] text-[var(--jos-muted)]">
          Click a meeting name to retitle it. Open for the full record.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">Person</span>
          <select
            aria-label="Person"
            value={person}
            className="h-9 bg-transparent text-[14px] font-semibold outline-none"
            onChange={(event) => setFilter("person", event.target.value)}
          >
            <option value="">All people</option>
            {facets.people.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.count})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            Strategy
          </span>
          <select
            aria-label="Strategy"
            value={strategy}
            className="h-9 bg-transparent text-[14px] font-semibold outline-none"
            onChange={(event) => setFilter("strategy", event.target.value)}
          >
            <option value="">All strategies</option>
            {facets.strategies.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.count})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">From</span>
          <input
            type="date"
            aria-label="From"
            value={from}
            className="h-9 bg-transparent text-[14px] outline-none"
            onChange={(event) => setFilter("from", event.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">To</span>
          <input
            type="date"
            aria-label="To"
            value={to}
            className="h-9 bg-transparent text-[14px] outline-none"
            onChange={(event) => setFilter("to", event.target.value)}
          />
        </label>
        <label className="min-w-40 flex-1 space-y-1">
          <span className="block text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">Search</span>
          <input
            aria-label="Search"
            value={q}
            placeholder="Title or person"
            className="h-9 w-full border-0 border-b border-[var(--color-neutral-400)] bg-transparent text-[14px] outline-none"
            onChange={(event) => setQ(event.target.value)}
            onBlur={() => {
              if (q.trim() !== urlQ) setFilter("q", q.trim());
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") setFilter("q", q.trim());
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {MARKS.map((item) => {
          const active = mark === item.id;
          const count =
            item.id === ""
              ? facets.marks.all
              : facets.marks[item.id as keyof typeof facets.marks];
          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={active}
              className={`px-2 py-1 text-[12px] font-bold uppercase tracking-[0.08em] ${
                active ? "bg-[var(--jos-ink)] text-[var(--jos-bg)]" : "text-[var(--jos-muted)]"
              }`}
              onClick={() => setFilter("mark", item.id)}
            >
              {item.label} {count}
            </button>
          );
        })}
        <span className="mx-2 text-[var(--jos-muted)]">|</span>
        <button
          type="button"
          aria-pressed={group === "person"}
          className={`text-[13px] font-semibold ${group === "person" ? "underline" : "text-[var(--jos-muted)]"}`}
          onClick={() => setFilter("group", "")}
        >
          By person
        </button>
        <button
          type="button"
          aria-pressed={group === "strategy"}
          className={`text-[13px] font-semibold ${group === "strategy" ? "underline" : "text-[var(--jos-muted)]"}`}
          onClick={() => setFilter("group", "strategy")}
        >
          By strategy
        </button>
      </div>

      {error ? <p className="text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}

      {relationship ? <RelationshipCard card={relationship} /> : null}

      {meetings.length === 0 ? (
        <p className="text-[15px] text-[var(--jos-muted)]">
          No Live meetings match. Run a meeting through Live and it appears here.
        </p>
      ) : (
        <div className="space-y-6">
          {ordered.map(([key, groupRow]) => (
            <section key={key || "none"} className="space-y-2">
              <h2 className="text-[14px] font-semibold text-[var(--jos-ink)]">
                {groupRow.title}{" "}
                <span className="font-normal text-[var(--jos-muted)]">{groupRow.rows.length}</span>
              </h2>
              {groupRow.meta ? <p className="text-[13px] text-[var(--jos-muted)]">{groupRow.meta}</p> : null}
              <ul className="divide-y divide-[var(--jos-line)] border-t border-b border-[var(--jos-line)]">
                {groupRow.rows.map((row) => {
                  const mismatch =
                    row.outcomeMark && row.suggestedMark && row.outcomeMark !== row.suggestedMark;
                  return (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
                    >
                      <Link
                        href={`/live/library/${row.id}`}
                        className="text-[13px] text-[var(--jos-muted)] hover:underline"
                      >
                        {easternDate(row.startsAt)}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <MeetingTitleField
                          prepId={row.id}
                          title={row.title}
                          className="truncate text-[16px] font-semibold tracking-tight"
                        />
                      </div>
                      <span className="truncate text-[13px] text-[var(--jos-muted)]">
                        {row.strategyName || "No strategy"}
                      </span>
                      <OutcomePill mark={row.outcomeMark} />
                      {row.asksTotal > 0 ? (
                        <span className="text-[13px] text-[var(--jos-ink)]">
                          Asks {row.asksCovered}/{row.asksTotal}
                        </span>
                      ) : null}
                      {row.hasReview ? (
                        <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                          Reviewed
                        </span>
                      ) : null}
                      {mismatch ? (
                        <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--color-accent-2-text)]">
                          Mismatch
                        </span>
                      ) : null}
                      <Link
                        href={`/live/library/${row.id}`}
                        className="text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
                      >
                        Open
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function RelationshipCard({ card }: { card: LibraryRelationship }) {
  return (
    <section className="space-y-3 border border-[var(--color-neutral-400)] bg-[var(--jos-surface)] p-4">
      <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">Relationship</h2>
      <p className="text-[18px] font-semibold text-[var(--jos-ink)]">{card.name}</p>
      {card.personalGoal ? (
        <p className="text-[14px] text-[var(--jos-muted)]">Your goal for {card.name}: {card.personalGoal}</p>
      ) : null}
      <p className="text-[14px] text-[var(--jos-ink)]">
        {card.cadenceLabel}
        {" · "}
        Next touch {dayLabel(card.nextTouchDate)}
        {card.nextTouchOverdue ? " · overdue" : ""}
        {" · "}
        Last touch {dayLabel(card.lastTouchDate)}
        {channelLabel(card.lastTouchChannel) ? ` · ${channelLabel(card.lastTouchChannel)}` : ""}
      </p>
      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
        <CommitmentList label="Theirs" items={card.commitmentsTheirs} />
        <CommitmentList label="Mine" items={card.commitmentsMine} />
      </div>
      <p className="text-[14px] text-[var(--jos-ink)]">
        {card.liveMeetings === 1 ? "1 Live meeting" : `${card.liveMeetings} Live meetings`}
        {card.daysSinceLastLive != null
          ? ` · ${card.daysSinceLastLive === 1 ? "1 day" : `${card.daysSinceLastLive} days`} since the last`
          : ""}
      </p>
    </section>
  );
}

function CommitmentList({ label, items }: { label: string; items: LibraryRelationship["commitmentsMine"] }) {
  return (
    <div className="space-y-1">
      <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">{label}</h3>
      {items.length === 0 ? (
        <p className="text-[14px] text-[var(--jos-muted)]">None open</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={`${item.text}-${item.due ?? ""}`} className="text-[14px] text-[var(--jos-ink)]">
              {item.text}
              {item.due ? <span className="text-[var(--jos-muted)]"> · due {dayLabel(item.due)}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
