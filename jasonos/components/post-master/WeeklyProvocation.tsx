"use client";

import { useEffect, useRef, useState } from "react";
import { listWeeklyProvocations } from "@/lib/server-actions/weekly-provocation";
import type { WeeklyProvocationListItem } from "@/lib/post-master/weekly-provocation/types";

type WeeklyProvocationPanelProps = {
  items: WeeklyProvocationListItem[];
  active: boolean;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: WeeklyProvocationListItem["status"]): string {
  if (status === "ready") return "Ready to read";
  if (status === "researching") return "Pulling sources";
  if (status === "failed") return "Needs a retry";
  return "Needs background";
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function sourceLabel(title: string | null, url: string): string {
  if (title?.trim()) return title.trim();
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function WeeklyProvocationPanel({
  items: initialItems,
  active,
}: WeeklyProvocationPanelProps) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());

  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  async function refreshList() {
    const next = await listWeeklyProvocations();
    setItems(next);
    return next;
  }

  async function research(id: string, force = false) {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setWorkingId(id);
    setError(null);
    try {
      const res = await fetch("/api/post-master/weekly-provocation/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, force }),
      });
      const data = (await res.json()) as {
        item?: WeeklyProvocationListItem;
        busy?: boolean;
        error?: string;
      };
      if (data.busy) {
        window.setTimeout(() => {
          void refreshList();
        }, 4000);
        return;
      }
      if (!res.ok || !data.item) {
        throw new Error(data.error || "Could not prepare that brief.");
      }
      setItems((current) =>
        current.map((item) => (item.id === data.item!.id ? data.item! : item))
      );
      setSelectedId(data.item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare that brief.");
      await refreshList().catch(() => undefined);
    } finally {
      inFlight.current.delete(id);
      setWorkingId((current) => (current === id ? null : current));
    }
  }

  useEffect(() => {
    if (!active) return;
    const pending = items.find((item) => item.status === "detected");
    if (pending && !workingId) {
      const timer = window.setTimeout(() => {
        void research(pending.id);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const stillReading = items.some((item) => item.status === "researching");
    if (!stillReading || workingId) return;
    const timer = window.setTimeout(() => {
      void refreshList();
    }, 4000);
    return () => window.clearTimeout(timer);
    // The queue should follow the list, not a new function identity each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items, workingId]);

  if (!items.length) {
    return (
      <section className="pm-panel wp-empty">
        <h2 className="wp-empty-title">No Weekly Provocation emails yet</h2>
        <p>
          The next Sync checks Gmail and Outlook for notes from Will Duffy or
          Rover that ask for a response. They show up here after that.
        </p>
      </section>
    );
  }

  return (
    <div className="wp-layout">
      <div className="wp-list" role="list" aria-label="Weekly Provocations">
        {items.map((item) => {
          const current = selected?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              className="wp-list-item"
              data-active={current}
              onClick={() => {
                setSelectedId(item.id);
                setError(null);
              }}
            >
              <span className="wp-list-date pm-mono">{formatWhen(item.receivedAt)}</span>
              <span className="wp-list-subject">
                {item.subject || "Weekly Provocation"}
              </span>
              <span className="wp-list-from">
                {item.fromName || item.fromEmail}
              </span>
              <span className="wp-status" data-status={item.status}>
                {workingId === item.id ? "Pulling sources" : statusLabel(item.status)}
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <article className="wp-detail">
          <header className="wp-detail-head">
            <p className="pm-label">
              {formatWhen(selected.receivedAt)}
              {selected.fromName || selected.fromEmail
                ? ` · ${selected.fromName || selected.fromEmail}`
                : ""}
            </p>
            <h2 className="wp-detail-title">
              {selected.subject || "Weekly Provocation"}
            </h2>
            <div className="pm-actions">
              {selected.threadUrl ? (
                <a
                  className="pm-btn pm-btn-ghost"
                  href={selected.threadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open email
                </a>
              ) : null}
              {selected.status === "ready" || selected.status === "failed" ? (
                <button
                  type="button"
                  className="pm-btn pm-btn-ghost"
                  disabled={workingId === selected.id}
                  onClick={() => void research(selected.id, true)}
                >
                  {workingId === selected.id ? "Pulling sources…" : "Refresh sources"}
                </button>
              ) : null}
            </div>
          </header>

          {error ? <p className="pm-error">{error}</p> : null}
          {selected.error && selected.status === "failed" ? (
            <p className="pm-error">{selected.error}</p>
          ) : null}

          {selected.tldr ? (
            <section className="pm-panel wp-block">
              <h3 className="pm-label">Brief</h3>
              {paragraphs(selected.tldr).map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
              ))}
            </section>
          ) : (
            <section className="pm-panel wp-block">
              <p>
                {workingId === selected.id
                  ? "Reading the email and pulling sources."
                  : "This one is waiting on a brief."}
              </p>
            </section>
          )}

          {selected.questions.length ? (
            <ol className="wp-questions">
              {selected.questions.map((question, index) => (
                <li key={question.id} className="pm-panel wp-question">
                  <p className="pm-label">Question {index + 1}</p>
                  <h3 className="wp-question-text">{question.prompt}</h3>
                  {question.background ? (
                    <div className="wp-background">
                      <p className="pm-label">Background</p>
                      {paragraphs(question.background).map((paragraph, index) => (
                        <p key={`${question.id}-${index}`}>{paragraph}</p>
                      ))}
                    </div>
                  ) : workingId === selected.id ? (
                    <p className="wp-pending">Pulling sources for this question.</p>
                  ) : null}
                  {question.sources.length ? (
                    <div className="wp-sources">
                      <p className="pm-label">Sources</p>
                      <ul>
                        {question.sources.map((source) => (
                          <li key={source.url}>
                            <a href={source.url} target="_blank" rel="noreferrer">
                              {sourceLabel(source.title, source.url)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
