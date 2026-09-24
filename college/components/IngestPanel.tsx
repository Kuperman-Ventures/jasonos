"use client";

import { useMemo, useRef, useState } from "react";
import {
  appendIngestNotes,
  checklistParents,
  formatIngestNotesBlock,
  type IngestRoute,
  type IngestSourceDraft,
  type PersistedIngestSource,
  type PersistedProjectStep,
  type SuggestedStep,
} from "@/lib/ingest";
import { OWNERS, type Owner, type Phase } from "@/lib/types";

type DraftRow = SuggestedStep;

export type IngestConfirmPayload = {
  steps: PersistedProjectStep[];
  source: PersistedIngestSource;
  notes: string;
};

const ROUTES: { id: IngestRoute; label: string }[] = [
  { id: "todo", label: "To-do" },
  { id: "note", label: "Note" },
  { id: "drop", label: "Drop" },
];

export function IngestPanel({
  phases,
  projectSteps,
  ingestSources,
  notes,
  assignedBy,
  onConfirm,
}: {
  phases: Phase[];
  projectSteps: PersistedProjectStep[];
  ingestSources: PersistedIngestSource[];
  notes: string;
  /** Signed-in person — stamped on to-dos they put on anyone's list. */
  assignedBy: Owner;
  onConfirm: (payload: IngestConfirmPayload) => Promise<void>;
}) {
  const parents = useMemo(() => checklistParents(phases), [phases]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"ai" | "heuristic" | "">("");
  const [pdfMethod, setPdfMethod] = useState<"embedded" | "ocr" | "">("");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [source, setSource] = useState<IngestSourceDraft | null>(null);

  async function applyParseResponse(response: Response) {
    const raw = await response.text();
    let body: {
      error?: string;
      suggestions?: SuggestedStep[];
      method?: "ai" | "heuristic";
      source?: IngestSourceDraft;
    };
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      const { messageFromFailedResponse } = await import("@/lib/pdf");
      throw new Error(messageFromFailedResponse(raw, response.status));
    }
    if (!response.ok) throw new Error(body.error || "Parse failed");
    setDrafts(
      (body.suggestions ?? []).map((row) => ({
        ...row,
        route: row.route ?? "todo",
      })),
    );
    setSource(body.source ?? null);
    setMethod(body.method ?? "");
  }

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
      await applyParseResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
      setDrafts([]);
      setSource(null);
    } finally {
      setBusy(false);
    }
  }

  async function runPdf(file: File) {
    setBusy(true);
    setError("");
    setStatus("Reading PDF…");
    setPdfName(file.name);
    setPdfMethod("");
    try {
      const { isPdfFile, MAX_PDF_BYTES } = await import("@/lib/pdf");
      const { readPdfForIngest } = await import("@/lib/pdf-ocr");
      if (!isPdfFile(file)) throw new Error("Upload a PDF file (.pdf).");
      if (file.size > MAX_PDF_BYTES) {
        throw new Error("PDF is too large (max 25 MB). Try a smaller export or fewer slides.");
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { text: pdfText, pageCount, method: readMethod } = await readPdfForIngest(
        bytes,
        (progress) => setStatus(progress.detail),
      );
      setPdfMethod(readMethod);
      setStatus(
        readMethod === "ocr"
          ? "OCR done — suggesting tasks…"
          : "Text extracted — suggesting tasks…",
      );
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: pdfText,
          title: title || file.name.replace(/\.pdf$/i, "") || `PDF (${pageCount} pages)`,
          kind: "file",
        }),
      });
      await applyParseResponse(response);
      setStatus("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF parse failed");
      setDrafts([]);
      setSource(null);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function patchDraft(id: string, patch: Partial<DraftRow>) {
    setDrafts((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function trashDraft(id: string) {
    setDrafts((current) => current.filter((row) => row.id !== id));
  }

  async function confirm() {
    if (!source) return;
    const labeled = drafts.filter((row) => row.label.trim());
    const todoRows = labeled.filter((row) => row.route === "todo");
    const noteRows = labeled.filter((row) => row.route === "note");
    if (!todoRows.length && !noteRows.length) {
      setError("Route at least one row to To-do or Note, or trash the rest and try again.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const createdAt = new Date().toISOString();
      const steps: PersistedProjectStep[] = [
        ...projectSteps,
        ...todoRows.map((row, index) => ({
          id: `ing-${source.id.slice(0, 8)}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
          label: row.label.trim(),
          owner: row.owner,
          assignedBy,
          parentId: row.parentId,
          dueDate: row.dueDate,
          startDate: row.startDate,
          endDate: row.endDate,
          sourceId: source.id,
          createdAt,
        })),
      ];
      const notesBlock = formatIngestNotesBlock({
        title: source.title,
        createdAt: source.createdAt,
        notes: noteRows.map((row) => row.label),
      });
      const nextNotes = appendIngestNotes(notes, notesBlock);
      const nextSource: PersistedIngestSource = {
        id: source.id,
        title: source.title,
        kind: source.kind,
        excerpt: source.text.slice(0, 280),
        createdAt: source.createdAt,
        stepCount: todoRows.length,
        noteCount: noteRows.length,
      };
      await onConfirm({ steps, source: nextSource, notes: nextNotes });
      setDrafts([]);
      setSource(null);
      setText("");
      setUrl("");
      setTitle("");
      setPdfName("");
      setMethod("");
      setPdfMethod("");
      setStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const todoCount = drafts.filter((row) => row.route === "todo" && row.label.trim()).length;
  const noteCount = drafts.filter((row) => row.route === "note" && row.label.trim()).length;

  return (
    <div className="pm-panel ingest-panel">
      <div className="ingest-compose">
        <label className="stack-field">
          <span className="label">Source title</span>
          <input
            className="field"
            value={title}
            placeholder="Webinar slides, article title, Granola paste…"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="stack-field">
          <span className="label">Paste text</span>
          <textarea
            className="field ingest-textarea"
            rows={8}
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

        <div className="ingest-or">or upload webinar slides (PDF)</div>

        <label className="stack-field">
          <span className="label">PDF file</span>
          <div className="ingest-file-row">
            <input
              ref={fileInputRef}
              className="field grow ingest-file"
              type="file"
              accept="application/pdf,.pdf"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void runPdf(file);
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? "Working…" : "Choose PDF"}
            </button>
          </div>
          {pdfName ? <p className="ingest-file-name">{pdfName}</p> : null}
          {status ? <p className="ingest-status" aria-live="polite">{status}</p> : null}
        </label>

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
          PDFs are read in your browser. Selectable-text decks are fast; image-only webinar slides run
          OCR page by page (first run downloads the OCR engine). Only the text is sent for
          suggestions. Route each row to To-do, Note, or Drop — trash removes OCR junk.
        </p>
      </div>

      {error ? <p className="ingest-error">{error}</p> : null}

      {drafts.length ? (
        <div className="ingest-review">
          <header className="ingest-review-head">
            <div>
              <h3 className="dash-title">Review suggestions</h3>
              <p className="section-sub">
                {method === "ai" ? "Parsed with AI." : "Parsed with local heuristics."}
                {pdfMethod === "ocr" ? " PDF text came from OCR." : ""}{" "}
                Send To-dos into the checklist, Notes into the shared Notes tab. Dropped rows are
                ignored.
                {todoCount || noteCount
                  ? ` Ready: ${todoCount} to-do${todoCount === 1 ? "" : "s"}, ${noteCount} note${noteCount === 1 ? "" : "s"}.`
                  : ""}
              </p>
            </div>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>
              {busy ? "Saving…" : "Confirm"}
            </button>
          </header>

          <ul className="ingest-draft-list">
            {drafts.map((row) => {
              const isTodo = row.route === "todo";
              const isNote = row.route === "note";
              const isDrop = row.route === "drop";
              return (
                <li
                  key={row.id}
                  className={isDrop ? "ingest-draft muted-row" : "ingest-draft"}
                  data-route={row.route}
                >
                  <div className="ingest-route" role="group" aria-label="Route">
                    {ROUTES.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={row.route === option.id ? "active" : ""}
                        aria-pressed={row.route === option.id}
                        onClick={() => patchDraft(row.id, { route: option.id })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <input
                    className="field ingest-label"
                    value={row.label}
                    onChange={(event) => patchDraft(row.id, { label: event.target.value })}
                    aria-label="Suggestion text"
                  />
                  {isTodo ? (
                    <>
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
                        onChange={(event) =>
                          patchDraft(row.id, { dueDate: event.target.value || null })
                        }
                        aria-label="Due date"
                      />
                      <input
                        className="field"
                        type="date"
                        value={row.startDate ?? ""}
                        onChange={(event) =>
                          patchDraft(row.id, { startDate: event.target.value || null })
                        }
                        aria-label="Start date"
                      />
                      <input
                        className="field"
                        type="date"
                        value={row.endDate ?? ""}
                        onChange={(event) =>
                          patchDraft(row.id, { endDate: event.target.value || null })
                        }
                        aria-label="End date"
                      />
                    </>
                  ) : null}
                  {isNote ? (
                    <p className="ingest-note-hint">Goes to shared Notes — not To-dos.</p>
                  ) : null}
                  {isDrop ? <p className="ingest-note-hint">Won’t be saved.</p> : null}
                  <button
                    type="button"
                    className="btn btn-secondary ingest-trash"
                    aria-label="Trash this row"
                    title="Trash"
                    onClick={() => trashDraft(row.id)}
                  >
                    Trash
                  </button>
                </li>
              );
            })}
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
                    {item.stepCount} to-do{item.stepCount === 1 ? "" : "s"}
                    {item.noteCount
                      ? ` · ${item.noteCount} note${item.noteCount === 1 ? "" : "s"}`
                      : ""}{" "}
                    · {item.kind} ·{" "}
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
