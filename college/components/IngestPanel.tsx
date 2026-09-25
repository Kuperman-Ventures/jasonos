"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { CalendarEvent } from "@/lib/calendar-events";
import {
  appendIngestNotes,
  formatIngestNotesBlock,
  INBOX_PARENT_ID,
  type IngestHandoff,
  type IngestSourceDraft,
  type PersistedIngestSource,
  type PersistedProjectStep,
  type SuggestedStep,
} from "@/lib/ingest";
import {
  acceptIngestAttr,
  formatBytes,
  INGEST_MAX_BYTES,
  ingestFileKind,
  isIngestFile,
  type IngestAssetKind,
} from "@/lib/ingest-assets";
import { buildPinNotesFromIngest, type PinNote } from "@/lib/note-board";
import { OWNERS, type Owner, type Phase } from "@/lib/types";

export type IngestConfirmPayload = {
  steps: PersistedProjectStep[];
  source: PersistedIngestSource;
  notes: string;
  noteItems: PinNote[];
  calendarEvents: CalendarEvent[];
};

type JobsState = { note: boolean; todo: boolean; cal: boolean };

type AssetInfo = {
  file: File;
  kind: IngestAssetKind;
  name: string;
  meta: string;
};

type TodoDraft = {
  id: string;
  title: string;
  owner: Owner;
  dueDate: string | null;
  evidence: string | null;
  updatesExisting: string | null;
  sourceLocator: string;
  parentId: string;
  skipped: boolean;
};

type EventDraft = {
  id: string;
  title: string;
  location: string;
  date: string | null;
  time: string;
  sourceLocator: string;
  skipped: boolean;
};

const JOB_CARDS: { id: keyof JobsState; title: string; description: string }[] = [
  {
    id: "note",
    title: "Save as a note",
    description: "The whole asset, pinned to Notes as one item. Nothing to review.",
  },
  {
    id: "todo",
    title: "Find to-dos",
    description: "Pull out tasks. You review each one before it’s added.",
  },
  {
    id: "cal",
    title: "Find calendar events",
    description: "Pull out dates. You review each one before it’s added.",
  },
];

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function kindLabel(kind: IngestAssetKind): string {
  if (kind === "email") return "Email";
  if (kind === "pdf") return "PDF";
  return "Deck";
}

function defaultNoteTitle(asset: AssetInfo | null, paste: string): string {
  if (asset) return asset.name.replace(/\.[^.]+$/, "");
  if (paste.trim()) return "Pasted text";
  return "";
}

function isCalendarSuggestion(row: SuggestedStep): boolean {
  return row.category === "visit_event" || row.route === "calendar";
}

function toTodoDraft(row: SuggestedStep): TodoDraft {
  return {
    id: row.id,
    title: row.label,
    owner: row.owner,
    dueDate: row.dueDate,
    evidence: row.evidence ?? null,
    updatesExisting: row.updatesExisting ?? null,
    sourceLocator: row.details ? "Doc" : "—",
    parentId: row.parentId || INBOX_PARENT_ID,
    skipped: false,
  };
}

function toEventDraft(row: SuggestedStep): EventDraft {
  return {
    id: row.id,
    title: row.label,
    location: row.school?.trim() || "",
    date: row.dueDate,
    time: "",
    sourceLocator: "—",
    skipped: false,
  };
}

export function IngestPanel({
  projectSteps,
  ingestSources,
  notes,
  noteItems,
  calendarEvents,
  assignedBy,
  schoolNames,
  openTodos,
  handoff,
  onHandoffConsumed,
  onConfirm,
}: {
  phases: Phase[];
  projectSteps: PersistedProjectStep[];
  ingestSources: PersistedIngestSource[];
  notes: string;
  noteItems: PinNote[];
  calendarEvents: CalendarEvent[];
  assignedBy: Owner;
  schoolNames: string[];
  openTodos: { title: string; school: string | null; dueDate: string | null }[];
  /** When set, jump to Jobs with this text/title and job toggles. */
  handoff?: IngestHandoff | null;
  onHandoffConsumed?: () => void;
  onConfirm: (payload: IngestConfirmPayload) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [paste, setPaste] = useState("");
  const [asset, setAsset] = useState<AssetInfo | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const [jobs, setJobs] = useState<JobsState>({ note: true, todo: true, cal: true });
  const [noteTitle, setNoteTitle] = useState("");
  const [todos, setTodos] = useState<TodoDraft[]>([]);
  const [events, setEvents] = useState<EventDraft[]>([]);
  const [source, setSource] = useState<IngestSourceDraft | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<{
    assetUrl: string | null;
    assetPath: string | null;
    mimeType: string | null;
    fileName: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [handoffBanner, setHandoffBanner] = useState("");

  useEffect(() => {
    if (!handoff) return;
    setAsset(null);
    setUploadedAsset(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPaste(handoff.text);
    setNoteTitle(handoff.title);
    setJobs({ ...handoff.jobs });
    setTodos([]);
    setEvents([]);
    setSource(null);
    setError("");
    setStatus("");
    setStep(2);
    setHandoffBanner(
      handoff.fromNoteId
        ? `From note “${handoff.title}”. Pick jobs, then find items.`
        : `Loaded “${handoff.title}”. Pick jobs, then find items.`,
    );
    onHandoffConsumed?.();
    // Only react when a new handoff id arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff?.id]);

  const hasSource = Boolean(asset) || paste.trim().length > 0;
  const anyJob = jobs.note || jobs.todo || jobs.cal;
  const onlyNote = jobs.note && !jobs.todo && !jobs.cal;
  const sourceName = asset
    ? asset.name
    : noteTitle.trim() || (paste.trim() ? "Pasted text" : "");

  const keptTodos = useMemo(() => todos.filter((row) => !row.skipped && row.title.trim()), [todos]);
  const keptEvents = useMemo(
    () => events.filter((row) => !row.skipped && row.title.trim()),
    [events],
  );

  function saveSummary(): string {
    const parts: string[] = [];
    if (jobs.note) parts.push("note");
    if (jobs.todo && keptTodos.length) parts.push(plural(keptTodos.length, "to-do"));
    if (jobs.cal && keptEvents.length) parts.push(plural(keptEvents.length, "event"));
    return parts.length ? `Save ${parts.join(" + ")}` : "Nothing to save";
  }

  function clearAsset() {
    setAsset(null);
    setUploadedAsset(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function pickFile(file: File) {
    setError("");
    if (!isIngestFile(file)) {
      setError("Use a PowerPoint, Keynote, PDF or email file.");
      return;
    }
    if (file.size > INGEST_MAX_BYTES) {
      setError("File is too large (max 25 MB).");
      return;
    }
    const kind = ingestFileKind(file);
    if (!kind) {
      setError("Use a PowerPoint, Keynote, PDF or email file.");
      return;
    }
    setAsset({
      file,
      kind,
      name: file.name,
      meta: formatBytes(file.size),
    });
    setNoteTitle(file.name.replace(/\.[^.]+$/, ""));
    setUploadedAsset(null);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDropOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) pickFile(file);
  }

  async function uploadAsset(file: File) {
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/ingest/upload", { method: "POST", body: form });
    if (response.status === 503) {
      return {
        assetUrl: null as string | null,
        assetPath: null as string | null,
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

  async function extractTextFromAsset(info: AssetInfo): Promise<string> {
    if (info.kind === "pdf") {
      setStatus("Reading PDF…");
      const { readPdfForIngest } = await import("@/lib/pdf-ocr");
      const bytes = new Uint8Array(await info.file.arrayBuffer());
      const result = await readPdfForIngest(bytes, (progress) => setStatus(progress.detail));
      return result.text;
    }
    if (info.kind === "email" && info.name.toLowerCase().endsWith(".eml")) {
      setStatus("Reading email…");
      return await info.file.text();
    }
    throw new Error(
      "Can’t extract text from this file yet. Paste the text, or save as a note only.",
    );
  }

  async function runFindItems() {
    if (!anyJob) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      // Note-only: skip extraction and go straight to save review.
      if (onlyNote) {
        if (asset) {
          setStatus("Uploading file…");
          const uploaded = await uploadAsset(asset.file);
          setUploadedAsset(uploaded);
        }
        setTodos([]);
        setEvents([]);
        setSource({
          id: newId(asset ? "file" : "paste"),
          title: noteTitle.trim() || defaultNoteTitle(asset, paste) || "Ingest",
          kind: asset ? "file" : "paste",
          text: asset ? "" : paste,
          createdAt: new Date().toISOString(),
          assetUrl: null,
          assetPath: null,
          mimeType: asset?.file.type ?? null,
          fileName: asset?.name ?? null,
        });
        if (!noteTitle.trim()) setNoteTitle(defaultNoteTitle(asset, paste));
        setStep(3);
        setStatus("");
        return;
      }

      let text = paste.trim();
      let uploaded = uploadedAsset;
      if (asset) {
        setStatus(asset.kind === "deck" ? "Reading deck…" : "Uploading file…");
        uploaded = await uploadAsset(asset.file);
        setUploadedAsset(uploaded);
        text = await extractTextFromAsset(asset);
      }
      if (!text.trim()) {
        throw new Error("No text found. Paste the contents, or save as a note only.");
      }

      setStatus(jobs.todo && jobs.cal ? "Finding items…" : jobs.todo ? "Finding to-dos…" : "Finding calendar events…");
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: noteTitle.trim() || defaultNoteTitle(asset, paste) || (asset ? asset.name : "Pasted notes"),
          kind: asset ? "file" : "paste",
          fileName: asset?.name ?? "pasted-notes.txt",
          schoolNames,
          openTodos,
        }),
      });
      const raw = await response.text();
      let body: {
        error?: string;
        suggestions?: SuggestedStep[];
        documentSummary?: string;
        source?: IngestSourceDraft;
      };
      try {
        body = JSON.parse(raw) as typeof body;
      } catch {
        const { messageFromFailedResponse } = await import("@/lib/pdf");
        throw new Error(messageFromFailedResponse(raw, response.status));
      }
      if (!response.ok) throw new Error(body.error || "Parse failed");

      const suggestions = body.suggestions ?? [];
      const nextSource = body.source ?? null;
      if (nextSource && uploaded) {
        nextSource.assetUrl = uploaded.assetUrl;
        nextSource.assetPath = uploaded.assetPath;
        nextSource.mimeType = uploaded.mimeType;
        nextSource.fileName = uploaded.fileName;
      }
      setSource(nextSource);

      const calRows = suggestions.filter(isCalendarSuggestion);
      const todoRows = suggestions.filter((row) => !isCalendarSuggestion(row));
      setTodos(jobs.todo ? (jobs.cal ? todoRows : suggestions).map(toTodoDraft) : []);
      setEvents(jobs.cal ? (jobs.todo ? calRows : suggestions).map(toEventDraft) : []);
      if (!noteTitle.trim()) setNoteTitle(defaultNoteTitle(asset, paste));
      setStep(3);
      setStatus("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find items");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    setBusy(true);
    setError("");
    setStatus("Saving…");
    try {
      const createdAt = new Date().toISOString();
      const title = (noteTitle.trim() || defaultNoteTitle(asset, paste) || "Ingest").slice(0, 160);
      let assetMeta = uploadedAsset;
      if (asset && !assetMeta) {
        assetMeta = await uploadAsset(asset.file);
        setUploadedAsset(assetMeta);
      }

      const sourceId = source?.id ?? newId(asset ? "file" : "paste");
      const sourceKind: PersistedIngestSource["kind"] = asset ? "file" : "paste";
      const sourceText = asset ? source?.text ?? "" : paste;

      // Feedback: kept to-dos and events = approved.
      if (jobs.todo || jobs.cal) {
        const feedbackRows = [
          ...todos.map((row) => ({
            sourceId,
            title: row.title.trim(),
            category: null as string | null,
            confidence: null as number | null,
            approved: !row.skipped && Boolean(row.title.trim()),
          })),
          ...events.map((row) => ({
            sourceId,
            title: row.title.trim(),
            category: "visit_event" as string | null,
            confidence: null as number | null,
            approved: !row.skipped && Boolean(row.title.trim()),
          })),
        ];
        void fetch("/api/ingest/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: feedbackRows }),
        }).catch(() => {
          /* non-blocking */
        });
      }

      let nextSteps = projectSteps;
      let nextNotes = notes;
      let nextPins = noteItems;
      let nextEvents = calendarEvents;
      let stepCount = 0;
      let noteCount = 0;
      let calendarCount = 0;

      if (jobs.todo) {
        stepCount = keptTodos.length;
        nextSteps = [
          ...projectSteps,
          ...keptTodos.map((row, index) => ({
            id: `ing-${sourceId.slice(0, 8)}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
            label: row.title.trim(),
            owner: row.owner,
            assignedBy,
            parentId: row.parentId || INBOX_PARENT_ID,
            dueDate: row.dueDate,
            startDate: null,
            endDate: null,
            sourceId,
            createdAt,
            assetUrl: assetMeta?.assetUrl ?? source?.assetUrl ?? null,
          })),
        ];
      }

      if (jobs.note) {
        noteCount = 1;
        const pins = buildPinNotesFromIngest({
          sourceId,
          sourceTitle: title,
          sourceKind,
          sourceText,
          createdAt,
          addedBy: assignedBy,
          noteLabels: [title],
          wholeTextAsNote: !asset,
          assetAsNote: Boolean(asset),
          assetUrl: assetMeta?.assetUrl ?? source?.assetUrl ?? null,
          assetPath: assetMeta?.assetPath ?? source?.assetPath ?? null,
          mimeType: assetMeta?.mimeType ?? source?.mimeType ?? null,
        });
        nextPins = [...pins, ...noteItems];
        nextNotes = appendIngestNotes(
          notes,
          formatIngestNotesBlock({
            title,
            createdAt,
            notes: [asset ? title : sourceText.trim() || title],
          }),
        );
      }

      if (jobs.cal) {
        calendarCount = keptEvents.length;
        nextEvents = [
          ...keptEvents.map((row, index) => ({
            id: `cal-${sourceId.slice(0, 8)}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
            title: row.title.trim(),
            date: row.date,
            startTime: row.time.trim() || null,
            endTime: null,
            notes: row.location.trim(),
            createdAt,
            createdBy: assignedBy,
            sourceId,
            assetUrl: assetMeta?.assetUrl ?? source?.assetUrl ?? null,
            assetPath: assetMeta?.assetPath ?? source?.assetPath ?? null,
          })),
          ...calendarEvents,
        ];
      }

      if (!jobs.note && !stepCount && !calendarCount) {
        setError("Keep at least one to-do or event, or turn on Save as a note.");
        setStatus("");
        return;
      }

      const nextSource: PersistedIngestSource = {
        id: sourceId,
        title,
        kind: sourceKind,
        excerpt: (asset ? title : sourceText).slice(0, 280),
        createdAt: source?.createdAt ?? createdAt,
        stepCount,
        noteCount,
        calendarCount,
        assetUrl: assetMeta?.assetUrl ?? source?.assetUrl ?? null,
        assetPath: assetMeta?.assetPath ?? source?.assetPath ?? null,
        mimeType: assetMeta?.mimeType ?? source?.mimeType ?? null,
        fileName: assetMeta?.fileName ?? source?.fileName ?? asset?.name ?? null,
      };

      await onConfirm({
        steps: nextSteps,
        source: nextSource,
        notes: nextNotes,
        noteItems: nextPins,
        calendarEvents: nextEvents,
      });

      setPaste("");
      clearAsset();
      setJobs({ note: true, todo: true, cal: true });
      setNoteTitle("");
      setTodos([]);
      setEvents([]);
      setSource(null);
      setStep(1);
      setStatus("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  const jobsSub =
    JOB_CARDS.filter((card) => jobs[card.id])
      .map((card) => card.title.replace(/^Find /, "").replace(/^Save as a /, ""))
      .join(" · ") || "None picked";

  const stepsMeta: { n: string; label: string; sub: string; reach: boolean }[] = [
    {
      n: "01",
      label: "Asset",
      sub: hasSource ? sourceName : "File or pasted text",
      reach: true,
    },
    {
      n: "02",
      label: "Jobs",
      sub: jobsSub,
      reach: hasSource,
    },
    {
      n: "03",
      label: onlyNote ? "Save" : "Review",
      sub: onlyNote ? "Nothing to review" : "Only what was found",
      reach: hasSource && anyJob,
    },
  ];

  return (
    <div className="pm-panel ingest-panel">
      <nav className="ingest-steps" aria-label="Ingest steps">
        {stepsMeta.map((meta, index) => {
          const k = (index + 1) as 1 | 2 | 3;
          const on = k === step;
          const done = k < step;
          return (
            <button
              key={meta.n}
              type="button"
              className={`ingest-step${on ? " is-on" : ""}${done ? " is-done" : ""}`}
              disabled={!meta.reach || busy}
              aria-current={on ? "step" : undefined}
              onClick={() => {
                if (meta.reach) setStep(k);
              }}
            >
              <span className="ingest-step-n">{meta.n}</span>
              <span className="ingest-step-l">{meta.label}</span>
              <span className="ingest-step-sub">{meta.sub}</span>
            </button>
          );
        })}
      </nav>

      {step === 1 ? (
        <div className="ingest-panel-body">
          <label
            className={`ingest-drop${dropOver ? " is-over" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDropOver(true);
            }}
            onDragLeave={() => setDropOver(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept={acceptIngestAttr()}
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) pickFile(file);
              }}
            />
            <strong>Drop a PowerPoint or an email</strong>
            <span className="ingest-datum">.pptx · .key · .pdf · .eml · .msg</span>
          </label>

          <span className="label">or paste text</span>
          <textarea
            className="field ingest-paste"
            value={paste}
            placeholder="Paste an email, article, webinar notes or a transcript."
            disabled={busy}
            onChange={(event) => setPaste(event.target.value)}
          />

          {asset ? (
            <div className="ingest-asset">
              <span className="ingest-kind">{kindLabel(asset.kind)}</span>
              <span className="ingest-asset-name">{asset.name}</span>
              <span className="ingest-datum">{asset.meta}</span>
              <button type="button" className="ingest-ghost" disabled={busy} onClick={clearAsset}>
                Remove
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="ingest-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="ingest-actions">
            <button
              type="button"
              className="btn btn-primary ingest-primary"
              disabled={busy || !hasSource}
              onClick={() => {
                setError("");
                setStep(2);
              }}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="ingest-panel-body">
          {handoffBanner ? <p className="ingest-status">{handoffBanner}</p> : null}
          <h2 className="ingest-jobs-heading">What should we do with {sourceName}?</h2>
          <div className="ingest-jobs">
            {JOB_CARDS.map((card) => {
              const on = jobs[card.id];
              return (
                <button
                  key={card.id}
                  type="button"
                  className="ingest-job"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => setJobs((current) => ({ ...current, [card.id]: !current[card.id] }))}
                >
                  <span className="ingest-job-box" aria-hidden="true">
                    {on ? "✓" : ""}
                  </span>
                  <span className="ingest-job-t">{card.title}</span>
                  <span className="ingest-job-d">{card.description}</span>
                </button>
              );
            })}
          </div>
          {error ? (
            <p className="ingest-error" role="alert">
              {error}
            </p>
          ) : null}
          {status ? (
            <p className="ingest-status" aria-live="polite">
              {status}
            </p>
          ) : null}
          <div className="ingest-actions">
            <button
              type="button"
              className="btn btn-primary ingest-primary"
              disabled={busy || !anyJob}
              onClick={() => void runFindItems()}
            >
              {busy ? "Working…" : onlyNote ? "Next: save" : "Find items"}
            </button>
            <button
              type="button"
              className="ingest-ghost"
              disabled={busy}
              onClick={() => setStep(1)}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="ingest-panel-body ingest-review-body">
          {jobs.note ? (
            <div className="ingest-note-row">
              <span className="label">Note</span>
              <input
                className="field"
                value={noteTitle}
                aria-label="Note title"
                disabled={busy}
                onChange={(event) => setNoteTitle(event.target.value)}
              />
              <span className="ingest-datum">
                whole {asset ? kindLabel(asset.kind).toLowerCase() : "paste"} · to Notes pinboard
              </span>
            </div>
          ) : null}

          {jobs.todo ? (
            <div className="ingest-group">
              <div className="ingest-group-head">
                <h2>To-dos</h2>
                <span className="ingest-datum">
                  {keptTodos.length} of {todos.length} kept
                </span>
              </div>
              {todos.length ? (
                todos.map((row) => (
                  <div
                    key={row.id}
                    className={`ingest-row${row.skipped ? " is-skip" : ""}`}
                  >
                    <div className="ingest-seg" role="group" aria-label="Keep or skip">
                      <button
                        type="button"
                        aria-pressed={!row.skipped}
                        disabled={busy}
                        onClick={() =>
                          setTodos((current) =>
                            current.map((item) =>
                              item.id === row.id ? { ...item, skipped: false } : item,
                            ),
                          )
                        }
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        aria-pressed={row.skipped}
                        disabled={busy}
                        onClick={() =>
                          setTodos((current) =>
                            current.map((item) =>
                              item.id === row.id ? { ...item, skipped: true } : item,
                            ),
                          )
                        }
                      >
                        Skip
                      </button>
                    </div>
                    <div className="ingest-row-main">
                      <div className="ingest-row-title-line">
                        <span className="ingest-row-title">{row.title}</span>
                        {row.updatesExisting ? (
                          <span className="ingest-tag">Updates existing</span>
                        ) : null}
                      </div>
                      {row.evidence ? (
                        <span className="ingest-quote">“{row.evidence}”</span>
                      ) : null}
                    </div>
                    <select
                      className="field"
                      aria-label="Owner"
                      value={row.owner}
                      disabled={busy || row.skipped}
                      onChange={(event) =>
                        setTodos((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, owner: event.target.value as Owner }
                              : item,
                          ),
                        )
                      }
                    >
                      {OWNERS.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="field"
                      type="date"
                      aria-label="Due date"
                      value={row.dueDate ?? ""}
                      disabled={busy || row.skipped}
                      onChange={(event) =>
                        setTodos((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, dueDate: event.target.value || null }
                              : item,
                          ),
                        )
                      }
                    />
                    <span className="ingest-datum ingest-src">{row.sourceLocator}</span>
                  </div>
                ))
              ) : (
                <p className="section-sub">No to-dos found in this asset.</p>
              )}
            </div>
          ) : null}

          {jobs.cal ? (
            <div className="ingest-group">
              <div className="ingest-group-head">
                <h2>Calendar</h2>
                <span className="ingest-datum">
                  {keptEvents.length} of {events.length} kept
                </span>
              </div>
              {events.length ? (
                events.map((row) => (
                  <div
                    key={row.id}
                    className={`ingest-row ingest-row-cal${row.skipped ? " is-skip" : ""}`}
                  >
                    <div className="ingest-seg" role="group" aria-label="Keep or skip">
                      <button
                        type="button"
                        aria-pressed={!row.skipped}
                        disabled={busy}
                        onClick={() =>
                          setEvents((current) =>
                            current.map((item) =>
                              item.id === row.id ? { ...item, skipped: false } : item,
                            ),
                          )
                        }
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        aria-pressed={row.skipped}
                        disabled={busy}
                        onClick={() =>
                          setEvents((current) =>
                            current.map((item) =>
                              item.id === row.id ? { ...item, skipped: true } : item,
                            ),
                          )
                        }
                      >
                        Skip
                      </button>
                    </div>
                    <div className="ingest-row-main">
                      <span className="ingest-row-title">{row.title}</span>
                      {row.location ? <span className="ingest-where">{row.location}</span> : null}
                    </div>
                    <input
                      className="field"
                      type="date"
                      aria-label="Date"
                      value={row.date ?? ""}
                      disabled={busy || row.skipped}
                      onChange={(event) =>
                        setEvents((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, date: event.target.value || null }
                              : item,
                          ),
                        )
                      }
                    />
                    <input
                      className="field"
                      type="time"
                      aria-label="Time"
                      value={row.time}
                      disabled={busy || row.skipped}
                      onChange={(event) =>
                        setEvents((current) =>
                          current.map((item) =>
                            item.id === row.id ? { ...item, time: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <span className="ingest-datum ingest-src">{row.sourceLocator}</span>
                  </div>
                ))
              ) : (
                <p className="section-sub">No calendar events found in this asset.</p>
              )}
            </div>
          ) : null}

          {error ? (
            <p className="ingest-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="ingest-actions">
            <button
              type="button"
              className="btn btn-primary ingest-primary"
              disabled={busy || saveSummary() === "Nothing to save"}
              onClick={() => void saveAll()}
            >
              {busy ? "Saving…" : saveSummary()}
            </button>
            <button
              type="button"
              className="ingest-ghost"
              disabled={busy}
              onClick={() => setStep(2)}
            >
              Back to jobs
            </button>
            {status ? (
              <span className="ingest-status" aria-live="polite">
                {status}
              </span>
            ) : null}
          </div>
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
