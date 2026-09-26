"use client";

import { useEffect, useState } from "react";
import {
  entityTypeLabel,
  formatActivityWhen,
  type ActivityEntry,
} from "@/lib/activity-log";

export function LogTab({ dateline }: { dateline: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <section className="log-panel">
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Log</h2>
        </div>
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

      {entries.length ? (
        <ol className="log-list">
          {entries.map((entry) => (
            <li key={entry.id} className="log-entry">
              <div className="log-when mono">{formatActivityWhen(entry.createdAt)}</div>
              <div className="log-body">
                <div className="log-meta">
                  <span className="log-actor">{entry.actorName}</span>
                  <span className="log-entity">{entityTypeLabel(entry.entityType)}</span>
                </div>
                <p className="log-summary">{entry.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
