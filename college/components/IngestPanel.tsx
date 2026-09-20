"use client";

import { useMemo, useState } from "react";
import {
  checklistParents,
  type IngestSourceDraft,
  type PersistedIngestSource,
  type PersistedProjectStep,
  type SuggestedStep,
} from "@/lib/ingest";
import { OWNERS, type Owner, type Phase } from "@/lib/types";

type DraftRow = SuggestedStep;

export function IngestPanel({
  phases,
  projectSteps,
  ingestSources,
  onConfirm,
}: {
  phases: Phase[];
  projectSteps: PersistedProjectStep[];
  ingestSources: PersistedIngestSource[];
  onConfirm: (steps: PersistedProjectStep[], source: PersistedIngestSource) => Promise<void>;
}) {
  const parents = useMemo(() => checklistParents(phases), [phases]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"ai" | "heuristic" | "">("");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [source, setSource] = useState<IngestSourceDraft | null>(null);

  async function runParse(kind: "paste" | "url") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "url"
            ? { url, title: title || url, kind: "url" }
            : { text, title: title || "Pasted notes", kind: "paste" },
        ),
      });
      const body = (await response.json()) as {
        error?: string;
        suggestions?: SuggestedStep[];
        method?: "ai" | "heuristic";
        source?: IngestSourceDraft;
      };
      if (!response.ok) throw new Error(body.error || "Parse failed");
      setDrafts(body.suggestions ?? []);
      setSource(body.source ?? null);
      setMethod(body.method ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
      setDrafts([]);
      setSource(null);
    } finally {
      setBusy(false);
    }
  }

  function patchDraft(id: string, patch: Partial<DraftRow>) {
    setDrafts((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function confirm() {
    if (!source) return;
    const selected = drafts.filter((row) => row.include && row.label.trim());
    if (!selected.length) {
      setError("Keep at least one task checked, or edit the list first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const createdAt = new Date().toISOString();
      const steps: PersistedProjectStep[] = [
        ...projectSteps,
        ...selected.map((row, index) => ({
          id: `ing-${source.id.slice(0, 8)}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
          label: row.label.trim(),
          owner: row.owner,
          parentId: row.parentId,
          dueDate: row.dueDate,
          startDate: row.startDate,
          endDate: row.endDate,
          sourceId: source.id,
          createdAt,
        })),
      ];
      const nextSource: PersistedIngestSource = {
        id: source.id,
        title: source.title,
        kind: source.kind,
        excerpt: source.text.slice(0, 280),
        createdAt: source.createdAt,
        stepCount: selected.length,
      };
      await onConfirm(steps, nextSource);
      setDrafts([]);
      setSource(null);
      setText("");
      setUrl("");
      setTitle("");
      setMethod("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save tasks");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pm-panel ingest-panel">
      <div className="ingest-compose">
        <label className="stack-field">
          <span className="label">Source title</span>
          <input
            className="field"
            value={title}
            placeholder="Webinar notes, article title, Granola paste…"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="stack-field">
          <span className="label">Paste text</span>
          <textarea
            className="field ingest-textarea"
            rows={10}
            value={text}
            placeholder="Paste article text, webinar notes, or a Granola transcript export here."
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <div className="ingest-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !text.trim()}
            onClick={() => void runParse("paste")}
          >
            {busy ? "Reading…" : "Suggest tasks from paste"}
          </button>
        </div>

        <div className="ingest-or">or pull from a URL</div>

        <label className="stack-field">
          <span className="label">URL</span>
          <div className="ingest-url-row">
            <input
              className="field grow"
              value={url}
              placeholder="https://"
              onChange={(event) => setUrl(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || !url.trim()}
              onClick={() => void runParse("url")}
            >
              Fetch & suggest
            </button>
          </div>
        </label>

        <p className="section-sub">
          PDFs: paste the text for now. Live Granola pull comes later — paste the note body the same
          way.
        </p>
      </div>

      {error ? <p className="ingest-error">{error}</p> : null}

      {drafts.length ? (
        <div className="ingest-review">
          <header className="ingest-review-head">
            <div>
              <h3 className="dash-title">Review suggested tasks</h3>
              <p className="section-sub">
                {method === "ai" ? "Parsed with AI." : "Parsed with local heuristics."} Edit, assign,
                date, then confirm to send them into To-dos.
              </p>
            </div>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>
              {busy ? "Saving…" : "Confirm into To-dos"}
            </button>
          </header>

          <ul className="ingest-draft-list">
            {drafts.map((row) => (
              <li key={row.id} className={row.include ? "ingest-draft" : "ingest-draft muted-row"}>
                <label className="ingest-include">
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={(event) => patchDraft(row.id, { include: event.target.checked })}
                  />
                  <span>Keep</span>
                </label>
                <input
                  className="field"
                  value={row.label}
                  onChange={(event) => patchDraft(row.id, { label: event.target.value })}
                  aria-label="Task label"
                />
                <select
                  className="field"
                  value={row.owner}
                  onChange={(event) => patchDraft(row.id, { owner: event.target.value as Owner })}
                  aria-label="Owner"
                >
                  {OWNERS.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.label}
                    </option>
                  ))}
                </select>
                <select
                  className="field"
                  value={row.parentId}
                  onChange={(event) => patchDraft(row.id, { parentId: event.target.value })}
                  aria-label="Parent checklist item"
                >
                  {parents.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.phase}: {parent.label.slice(0, 80)}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  type="date"
                  value={row.dueDate ?? ""}
                  onChange={(event) => patchDraft(row.id, { dueDate: event.target.value || null })}
                  aria-label="Due date"
                />
                <input
                  className="field"
                  type="date"
                  value={row.startDate ?? ""}
                  onChange={(event) => patchDraft(row.id, { startDate: event.target.value || null })}
                  aria-label="Start date"
                />
                <input
                  className="field"
                  type="date"
                  value={row.endDate ?? ""}
                  onChange={(event) => patchDraft(row.id, { endDate: event.target.value || null })}
                  aria-label="End date"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ingestSources.length ? (
        <div className="ingest-history">
          <h3 className="dash-title">Recent ingest</h3>
          <ul className="ingest-history-list">
            {ingestSources
              .slice()
              .reverse()
              .slice(0, 8)
              .map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span>
                    {item.stepCount} tasks · {item.kind} ·{" "}
                    {new Date(item.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
