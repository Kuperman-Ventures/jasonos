"use client";

import { useEffect, useMemo, useState } from "react";
import { MemberBadge } from "@/components/MemberBadge";
import {
  entityTypeLabel,
  formatActivityWhen,
  groupActivityByPerson,
  sortActivityEntries,
  type ActivityEntry,
  type ActivityLogSort,
} from "@/lib/activity-log";
import type { MemberProfile } from "@/lib/member-avatars";

function profileForActor(
  profiles: MemberProfile[],
  entry: ActivityEntry,
): MemberProfile | null {
  const byId = profiles.find((p) => p.id === entry.actorId);
  if (byId) return byId;
  const name = entry.actorName.trim().toLowerCase();
  if (!name) return null;
  return (
    profiles.find((p) => p.displayName.trim().toLowerCase() === name) ??
    profiles.find((p) => p.displayName.trim().toLowerCase().startsWith(name.split(/\s+/)[0] ?? "")) ??
    null
  );
}

export function LogTab({
  dateline,
  memberProfiles = [],
}: {
  dateline: string;
  memberProfiles?: MemberProfile[];
}) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<ActivityLogSort>("recency");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/activity?limit=150");
        const body = (await response.json()) as { entries?: ActivityEntry[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Could not load log");
        if (!cancelled) setEntries(body.entries ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load log");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => sortActivityEntries(entries, sort), [entries, sort]);
  const personGroups = useMemo(
    () => (sort === "person" ? groupActivityByPerson(sorted) : []),
    [sorted, sort],
  );

  return (
    <section className="log-panel">
      <header className="page-head log-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Log</h2>
        </div>
        <label className="log-sort">
          <span className="log-sort-label">Sort</span>
          <select
            className="field"
            value={sort}
            onChange={(e) => setSort(e.target.value as ActivityLogSort)}
            aria-label="Sort activity log"
          >
            <option value="recency">Most recent</option>
            <option value="person">By person</option>
          </select>
        </label>
      </header>
      <p className="section-sub">
        Household trail of what Jason, Kat, Kyle, and anyone else does here — college edits,
        archives, to-dos, notes, ingest, and more. Everyone sees the same log.
      </p>

      {loading ? <p className="todo-empty">Loading activity…</p> : null}
      {error ? <p className="ingest-error">{error}</p> : null}
      {!loading && !error && !entries.length ? (
        <p className="todo-empty">No activity recorded yet. Changes from here on will show up.</p>
      ) : null}

      {entries.length && sort === "recency" ? (
        <ol className="log-list">
          {sorted.map((entry) => (
            <LogEntryRow
              key={entry.id}
              entry={entry}
              profile={profileForActor(memberProfiles, entry)}
            />
          ))}
        </ol>
      ) : null}

      {entries.length && sort === "person"
        ? personGroups.map((group) => {
            const profile =
              memberProfiles.find((p) => p.id === group.actorId) ??
              profileForActor(memberProfiles, group.entries[0]!);
            return (
              <section key={group.actorId} className="log-person-group">
                <header className="log-person-head">
                  <MemberBadge
                    name={group.actorName}
                    avatarUrl={profile?.avatarUrl}
                    size="md"
                  />
                  <span className="log-person-count mono">
                    {group.entries.length}{" "}
                    {group.entries.length === 1 ? "entry" : "entries"}
                  </span>
                </header>
                <ol className="log-list">
                  {group.entries.map((entry) => (
                    <LogEntryRow
                      key={entry.id}
                      entry={entry}
                      profile={profile}
                      hideActorName
                    />
                  ))}
                </ol>
              </section>
            );
          })
        : null}
    </section>
  );
}

function LogEntryRow({
  entry,
  profile,
  hideActorName = false,
}: {
  entry: ActivityEntry;
  profile: MemberProfile | null;
  hideActorName?: boolean;
}) {
  return (
    <li className="log-entry">
      <div className="log-when mono">{formatActivityWhen(entry.createdAt)}</div>
      <div className="log-body">
        <div className="log-meta">
          {hideActorName ? null : (
            <MemberBadge
              name={entry.actorName}
              avatarUrl={profile?.avatarUrl}
              size="sm"
            />
          )}
          <span className="log-entity">{entityTypeLabel(entry.entityType)}</span>
        </div>
        <p className="log-summary">{entry.summary}</p>
      </div>
    </li>
  );
}
