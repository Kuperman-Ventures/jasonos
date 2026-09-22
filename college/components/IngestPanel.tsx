"use client";

import { useMemo, useRef, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar-events";
import {
  appendIngestNotes,
  checklistParents,
  formatIngestNotesBlock,
  INBOX_PARENT_ID,
  type IngestRoute,
  type IngestSourceDraft,
  type PersistedIngestSource,
  type PersistedProjectStep,
  type SuggestedStep,
} from "@/lib/ingest";
import { acceptIngestAttr, INGEST_MAX_BYTES, isIngestFile } from "@/lib/ingest-assets";
import { buildPinNotesFromIngest, type PinNote } from "@/lib/note-board";
import { OWNERS, type Owner, type Phase } from "@/lib/types";

type DraftRow = SuggestedStep;

type PendingFile = {
  file: File;
  previewUrl: string | null;
};

type AsIsDest = {
  note: boolean;
  todo: boolean;
  calendar: boolean;
};

export type IngestConfirmPayload = {
  steps: PersistedProjectStep[];
  source: PersistedIngestSource;
  notes: string;
  noteItems: PinNote[];
  calendarEvents: CalendarEvent[];
};

const ROUTES: { id: IngestRoute; label: string }[] = [
  { id: "todo", label: "To-do" },
  { id: "note", label: "Note" },
  { id: "calendar", label: "Calendar" },
  { id: "drop", label: "Drop" },
];

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function IngestPanel({
  phases,
  projectSteps,
  ingestSources,
  notes,
  noteItems,
  calendarEvents,
  assignedBy,
  onConfirm,
}: {
  phases: Phase[];
  projectSteps: PersistedProjectStep[];
  ingestSources: PersistedIngestSource[];
  notes: string;
  noteItems: PinNote[];
  calendarEvents: CalendarEvent[];
  assignedBy: Owner;
  onConfirm: (payload: IngestConfirmPayload) => Promise<void>;
}) {
  const parents = useMemo(() => checklistParents(phases), [phases]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"ai" | "heuristic" | "">("");
  const [readMethod, setReadMethod] = useState<"embedded" | "ocr" | "">("");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [source, setSource] = useState<IngestSourceDraft | null>(null);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [asIsTitle, setAsIsTitle] = useState("");
  const [asIsDest, setAsIsDest] = useState<AsIsDest>({ note: true, todo: false, calendar: false });
  const [asIsOwner, setAsIsOwner] = useState<Owner>(assignedBy);
  const [asIsDate, setAsIsDate] = useState("");
  const [uploadedAsset, setUploadedAsset] = useState<{
    assetUrl: string | null;
    assetPath: string | null;
    mimeType: string | null;
    fileName: string | null;
  } | null>(null);

  function clearPendingFile() {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
    setUploadedAsset(null);
    setAsIsTitle("");
    setAsIsDest({ note: true, todo: false, calendar: false });
    setAsIsDate("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function pickFile(file: File) {
    setError("");
    setDrafts([]);
    setSource(null);
    if (!isIngestFile(file)) {
      setError("Use a PDF, PNG, JPG, WebP, or GIF.");
      return;
    }
    if (file.size > INGEST_MAX_BYTES) {
      setError("File is too large (max 25 MB).");
      return;
    }
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    setPendingFile({ file, previewUrl });
    setAsIsTitle(title || file.name.replace(/\.[^.]+$/, ""));
    setUploadedAsset(null);
  }

  async function uploadAsset(file: File): Promise<{
    assetUrl: string | null;
    assetPath: string | null;
    mimeType: string | null;
    fileName: string | null;
  }> {
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/ingest/upload", { method: "POST", body: form });
    if (response.status === 503) {
      // Local seed mode — keep a temporary preview URL for images.
      const localUrl = file.type.startsWith("image/")
        ? await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Could not read file"));
            reader.readAsDataURL(file);
          })
        : null;
      return {
        assetUrl: localUrl,
        assetPath: null,
        mimeType: file.type || null,
        fileName: file.name,
      };
    }
    const body = (await response.json()) as {
      error?: string;
      assetUrl?: string;
      assetPath?: string;
      mimeType?: string;
      fileName?: string;
    };
    if (!response.ok) throw new Error(body.error || "Upload failed");
    return {
      assetUrl: body.assetUrl ?? null,
      assetPath: body.assetPath ?? null,
      mimeType: body.mimeType ?? file.type ?? null,
      fileName: body.fileName ?? file.name,
    };
  }

  async function applyParseResponse(response: Response, asset?: typeof uploadedAsset) {
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
    const nextSource = body.source ?? null;
    if (nextSource && asset) {
      nextSource.assetUrl = asset.assetUrl;
      nextSource.assetPath = asset.assetPath;
      nextSource.mimeType = asset.mimeType;
      nextSource.fileName = asset.fileName;
    }
    setSource(nextSource);
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

  async function runReadText() {
    if (!pendingFile) return;
    setBusy(true);
    setError("");
    setStatus("Uploading file…");
    setReadMethod("");
    try {
      const asset = await uploadAsset(pendingFile.file);
      setUploadedAsset(asset);
      const isPdf =
        pendingFile.file.type === "application/pdf" ||
        pendingFile.file.name.toLowerCase().endsWith(".pdf");
      let extracted = "";
      if (isPdf) {
        setStatus("Reading PDF…");
        const { readPdfForIngest } = await import("@/lib/pdf-ocr");
        const bytes = new Uint8Array(await pendingFile.file.arrayBuffer());
        const result = await readPdfForIngest(bytes, (progress) => setStatus(progress.detail));
        extracted = result.text;
        setReadMethod(result.method);
      } else {
        setStatus("Reading image…");
        const { readImageForIngest } = await import("@/lib/image-ocr");
        const result = await readImageForIngest(pendingFile.file, (progress) =>
          setStatus(progress.detail),
        );
        extracted = result.text;
        setReadMethod("ocr");
      }
      setStatus("Suggesting tasks…");
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extracted,
          title:
            title ||
            asIsTitle ||
            pendingFile.file.name.replace(/\.[^.]+$/, "") ||
            "Uploaded file",
          kind: "file",
        }),
      });
      await applyParseResponse(response, asset);
      setStatus("");
      clearPendingFile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read file");
      setDrafts([]);
      setSource(null);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function runSaveAsIs() {
    if (!pendingFile) return;
    if (!asIsDest.note && !asIsDest.todo && !asIsDest.calendar) {
      setError("Pick at least one destination: Note, To-do, or Calendar.");
      return;
    }
    const label = (asIsTitle || pendingFile.file.name).trim();
    if (!label) {
      setError("Add a title for this file.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Uploading file…");
    try {
      const asset = await uploadAsset(pendingFile.file);
      const createdAt = new Date().toISOString();
      const sourceId = newId("file");
      let nextSteps = projectSteps;
      let nextNotes = notes;
      let nextPins = noteItems;
      let nextEvents = calendarEvents;
      let stepCount = 0;
      let noteCount = 0;
      let calendarCount = 0;

      if (asIsDest.todo) {
        stepCount = 1;
        nextSteps = [
          ...projectSteps,
          {
            id: newId("ing"),
            label,
            owner: asIsOwner,
            assignedBy,
            parentId: INBOX_PARENT_ID,
            dueDate: asIsDate || null,
            startDate: null,
            endDate: null,
            sourceId,
            createdAt,
            assetUrl: asset.assetUrl,
          },
        ];
      }
      if (asIsDest.note) {
        noteCount = 1;
        const pins = buildPinNotesFromIngest({
          sourceId,
          sourceTitle: label,
          sourceKind: "file",
          sourceText: "",
          createdAt,
          addedBy: assignedBy,
          noteLabels: [label],
          assetUrl: asset.assetUrl,
          assetPath: asset.assetPath,
          mimeType: asset.mimeType,
          assetAsNote: true,
        });
        nextPins = [...pins, ...noteItems];
        nextNotes = appendIngestNotes(
          notes,
          formatIngestNotesBlock({ title: label, createdAt, notes: [label] }),
        );
      }
      if (asIsDest.calendar) {
        calendarCount = 1;
        nextEvents = [
          {
            id: newId("cal"),
            title: label,
            date: asIsDate || null,
            startTime: null,
            endTime: null,
            notes: "",
            createdAt,
            createdBy: assignedBy,
            sourceId,
            assetUrl: asset.assetUrl,
            assetPath: asset.assetPath,
          },
          ...calendarEvents,
        ];
      }

      const nextSource: PersistedIngestSource = {
        id: sourceId,
        title: label,
        kind: "file",
        excerpt: label.slice(0, 280),
        createdAt,
        stepCount,
        noteCount,
        calendarCount,
        assetUrl: asset.assetUrl,
        assetPath: asset.assetPath,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
      };

      await onConfirm({
        steps: nextSteps,
        source: nextSource,
        notes: nextNotes,
        noteItems: nextPins,
        calendarEvents: nextEvents,
      });
      clearPendingFile();
      setTitle("");
      setStatus("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save file");
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
    const calendarRows = labeled.filter((row) => row.route === "calendar");
    if (!todoRows.length && !noteRows.length && !calendarRows.length) {
      setError("Route at least one row to To-do, Note, or Calendar.");
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
          assetUrl: source.assetUrl ?? null,
        })),
      ];
      const notesBlock = formatIngestNotesBlock({
        title: source.title,
        createdAt: source.createdAt,
        notes: noteRows.map((row) => row.label),
      });
      const nextNotes = appendIngestNotes(notes, notesBlock);
      const createdPins = buildPinNotesFromIngest({
        sourceId: source.id,
        sourceTitle: source.title,
        sourceKind: source.kind,
        sourceText: source.text,
        sourceUrl: source.kind === "url" ? url.trim() || null : null,
        createdAt,
        addedBy: assignedBy,
        noteLabels: noteRows.map((row) => row.label),
        assetUrl: source.assetUrl,
        assetPath: source.assetPath,
        mimeType: source.mimeType,
      });
      const createdEvents: CalendarEvent[] = calendarRows.map((row, index) => ({
        id: `cal-${source.id.slice(0, 8)}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
        title: row.label.trim(),
        date: row.dueDate,
        startTime: null,
        endTime: null,
        notes: "",
        createdAt,
        createdBy: assignedBy,
        sourceId: source.id,
        assetUrl: source.assetUrl ?? null,
        assetPath: source.assetPath ?? null,
      }));
      const nextSource: PersistedIngestSource = {
        id: source.id,
        title: source.title,
        kind: source.kind,
        excerpt: source.text.slice(0, 280),
        createdAt: source.createdAt,
        stepCount: todoRows.length,
        noteCount: noteRows.length,
        calendarCount: calendarRows.length,
        assetUrl: source.assetUrl ?? null,
        assetPath: source.assetPath ?? null,
        mimeType: source.mimeType ?? null,
        fileName: source.fileName ?? null,
      };
      await onConfirm({
        steps,
        source: nextSource,
        notes: nextNotes,
        noteItems: [...createdPins, ...noteItems],
        calendarEvents: [...createdEvents, ...calendarEvents],
      });
      setDrafts([]);
      setSource(null);
      setText("");
      setUrl("");
      setTitle("");
      setMethod("");
      setReadMethod("");
      setStatus("");
      clearPendingFile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const todoCount = drafts.filter((row) => row.route === "todo" && row.label.trim()).length;
  const noteCount = drafts.filter((row) => row.route === "note" && row.label.trim()).length;
  const calendarCount = drafts.filter((row) => row.route === "calendar" && row.label.trim()).length;

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

        <div className="ingest-or">or upload a file (PDF, PNG, JPG, WebP, GIF)</div>

        <label className="stack-field">
          <span className="label">File</span>
          <div className="ingest-file-row">
            <input
              ref={fileInputRef}
              className="field grow ingest-file"
              type="file"
              accept={acceptIngestAttr()}
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) pickFile(file);
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file
            </button>
          </div>
        </label>

        {pendingFile ? (
          <div className="ingest-file-mode">
            <p className="ingest-file-name">
              Selected: <strong>{pendingFile.file.name}</strong>
            </p>
            {pendingFile.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="ingest-file-preview" src={pendingFile.previewUrl} alt="" />
            ) : null}
            <p className="section-sub">
              What should we do with this file? Read the text to suggest to-dos/notes/calendar rows,
              or save the asset as-is onto Notes, a To-do, and/or Calendar.
            </p>
            <div className="ingest-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void runReadText()}
              >
                {busy ? "Working…" : "Read text & suggest"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => clearPendingFile()}
              >
                Clear file
              </button>
            </div>

            <div className="ingest-asis">
              <h3 className="dash-title">Or save as-is</h3>
              <label className="stack-field">
                <span className="label">Title</span>
                <input
                  className="field"
                  value={asIsTitle}
                  onChange={(event) => setAsIsTitle(event.target.value)}
                />
              </label>
              <div className="ingest-asis-dest" role="group" aria-label="Save destinations">
                {(
                  [
                    ["note", "Note"],
                    ["todo", "To-do"],
                    ["calendar", "Calendar"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="ingest-asis-check">
                    <input
                      type="checkbox"
                      checked={asIsDest[key]}
                      onChange={(event) =>
                        setAsIsDest((current) => ({ ...current, [key]: event.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              {asIsDest.todo ? (
                <label className="stack-field">
                  <span className="label">Assign to-do to</span>
                  <select
                    className="field"
                    value={asIsOwner}
                    onChange={(event) => setAsIsOwner(event.target.value as Owner)}
                  >
                    {OWNERS.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {asIsDest.todo || asIsDest.calendar ? (
                <label className="stack-field">
                  <span className="label">Date (optional)</span>
                  <input
                    className="field"
                    type="date"
                    value={asIsDate}
                    onChange={(event) => setAsIsDate(event.target.value)}
                  />
                </label>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void runSaveAsIs()}
              >
                {busy ? "Saving…" : "Save asset"}
              </button>
            </div>
          </div>
        ) : null}

        {status ? <p className="ingest-status" aria-live="polite">{status}</p> : null}

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
          Pick a file first, then choose whether to read its text for suggestions or save the asset
          as-is. Route each suggestion to To-do, Note, Calendar, or Drop.
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
                {readMethod === "ocr" ? " Text came from OCR." : ""}{" "}
                Route each row to To-do, Note, Calendar, or Drop.
                {todoCount || noteCount || calendarCount
                  ? ` Ready: ${todoCount} to-do${todoCount === 1 ? "" : "s"}, ${noteCount} note${noteCount === 1 ? "" : "s"}, ${calendarCount} calendar.`
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
              const isCalendar = row.route === "calendar";
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
                        onChange={(event) =>
                          patchDraft(row.id, { owner: event.target.value as Owner })
                        }
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
                    </>
                  ) : null}
                  {isCalendar ? (
                    <input
                      className="field"
                      type="date"
                      value={row.dueDate ?? ""}
                      onChange={(event) =>
                        patchDraft(row.id, { dueDate: event.target.value || null })
                      }
                      aria-label="Event date"
                    />
                  ) : null}
                  {isNote ? <p className="ingest-note-hint">Goes to the Notes pinboard.</p> : null}
                  {isCalendar ? (
                    <p className="ingest-note-hint">Goes to Calendar events.</p>
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
                      : ""}
                    {item.calendarCount
                      ? ` · ${item.calendarCount} calendar`
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
