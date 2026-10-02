"use client";

// Resume Customizer — working UI.
//   • Core Resume library (secondary, occasional): upload / pick the active core.
//   • Customize (primary): paste or upload a JD → tailored .docx named by the
//     company, plus a Before/After report. Nothing is invented; formatting is
//     preserved by editing only the text of the original document.

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Wand2,
  Upload,
  FileText,
  CheckCircle2,
  Download,
  Trash2,
  Loader2,
  ChevronDown,
  Star,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  RotateCcw,
  Plus,
  Pencil,
  Check,
  X,
} from "lucide-react";

// Shared reset signal so "Reset" clears both the resume customizer and the
// cover letter section (separate sibling components).
const RESET_EVENT = "jasonos:custom-comms-reset";
import { Button } from "@/components/ui/button";
import {
  listResumes,
  uploadCoreResume,
  setActiveCoreResume,
  deleteResume,
  customizeResume,
  regenerateCustomization,
  applyEditAnyway,
  listCustomizations,
  getCustomizationDownload,
  getCustomizationJdDownload,
  deleteCustomization,
  renameCustomization,
  type ResumeRow,
  type CustomizationRow,
  type CustomizeResult,
} from "@/lib/server-actions/resume-customizer";

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function downloadBase64Docx(base64: string, filename: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: DOCX_TYPE }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadTextFile(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Let the Cover Letter Customizer (a sibling component) auto-select a resume
// the moment it's customized here, without a full page reload.
function announceCustomization(res: CustomizeResult) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("jasonos:resume-customized", {
      detail: {
        id: res.customizationId,
        company: res.analysis.company,
        filename: res.filename,
        match_score: res.analysis.matchScore,
        created_at: new Date().toISOString(),
        has_job_description: true,
        job_description: null,
      },
    })
  );
}

const PRIORITY_META: Record<
  string,
  { label: string; className: string }
> = {
  critical: {
    label: "Critical · ATS / AI screening",
    className: "border-rung-1 bg-rung-1 ",
  },
  important: {
    label: "Important · Recruiter-focused",
    className: "border-[var(--jos-line)] bg-rung-2 ",
  },
  optional: {
    label: "Optional enhancement",
    className: "border-rung-3 bg-rung-3 ",
  },
};

export function ResumeCustomizerClient({
  initialResumes,
  initialCustomizations,
}: {
  initialResumes: ResumeRow[];
  initialCustomizations: CustomizationRow[];
}) {
  const [resumes, setResumes] = useState<ResumeRow[]>(initialResumes);
  const [customizations, setCustomizations] = useState<CustomizationRow[]>(
    initialCustomizations
  );
  const [jdText, setJdText] = useState("");
  const [jdFileName, setJdFileName] = useState<string | null>(null);
  const [result, setResult] = useState<CustomizeResult | null>(null);

  const [customizing, startCustomize] = useTransition();
  const [busy, startBusy] = useTransition();
  const [regenerating, startRegenerate] = useTransition();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const jdFileRef = useRef<HTMLInputElement>(null);
  const coreFileRef = useRef<HTMLInputElement>(null);

  const activeCore = resumes.find((r) => r.is_core) ?? null;

  // Reset the whole flow (this component + the cover-letter section) so you can
  // start the next application without leaving the page.
  useEffect(() => {
    const onReset = () => {
      setJdText("");
      setJdFileName(null);
      if (jdFileRef.current) jdFileRef.current.value = "";
      setResult(null);
    };
    window.addEventListener(RESET_EVENT, onReset);
    return () => window.removeEventListener(RESET_EVENT, onReset);
  }, []);

  function handleReset() {
    window.dispatchEvent(new CustomEvent(RESET_EVENT));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refresh() {
    const [r, c] = await Promise.all([listResumes(), listCustomizations()]);
    setResumes(r);
    setCustomizations(c);
  }

  function handleCoreUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    startBusy(async () => {
      const res = await uploadCoreResume(fd);
      if (res.ok) {
        toast.success("Core resume added.");
        await refresh();
      } else {
        toast.error(res.error);
      }
      if (coreFileRef.current) coreFileRef.current.value = "";
    });
  }

  function handleSetActive(id: string) {
    startBusy(async () => {
      const res = await setActiveCoreResume(id);
      if (res.ok) {
        toast.success("Core resume updated.");
        await refresh();
      } else toast.error(res.error);
    });
  }

  function handleDeleteResume(id: string) {
    startBusy(async () => {
      const res = await deleteResume(id);
      if (res.ok) {
        toast.success("Resume removed.");
        await refresh();
      } else toast.error(res.error);
    });
  }

  function handleCustomize() {
    if (!activeCore) {
      toast.error("Add and select a core resume first.");
      return;
    }
    const file = jdFileRef.current?.files?.[0];
    if (!jdText.trim() && !file) {
      toast.error("Paste or upload a job description.");
      return;
    }
    const fd = new FormData();
    fd.append("jdText", jdText);
    if (file) fd.append("jdFile", file);

    startCustomize(async () => {
      const res = await customizeResume(fd);
      if (res.ok) {
        setResult(res);
        downloadBase64Docx(res.docxBase64, res.filename);
        announceCustomization(res);
        toast.success(`Tailored resume ready — ${res.filename}`);
        await refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleRegenerate() {
    if (!result) return;
    startRegenerate(async () => {
      const res = await regenerateCustomization(result.customizationId);
      if (res.ok) {
        setResult(res);
        downloadBase64Docx(res.docxBase64, res.filename);
        announceCustomization(res);
        toast.success(`Regenerated — ${res.filename}`);
        await refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDownloadPast(id: string) {
    startBusy(async () => {
      const res = await getCustomizationDownload(id);
      if (res.ok) downloadBase64Docx(res.docxBase64, res.filename);
      else toast.error(res.error);
    });
  }

  function handleDownloadJd(id: string) {
    startBusy(async () => {
      const res = await getCustomizationJdDownload(id);
      if (res.ok) {
        downloadTextFile(res.text, res.filename);
        toast.success(`Downloaded ${res.filename}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDeletePast(id: string) {
    startBusy(async () => {
      const res = await deleteCustomization(id);
      if (res.ok) await refresh();
      else toast.error(res.error);
    });
  }

  function startRename(c: CustomizationRow) {
    setRenamingId(c.id);
    setRenameDraft(c.filename.replace(/\.docx$/i, ""));
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameDraft("");
  }

  function commitRename(id: string) {
    const next = renameDraft.trim();
    if (!next) {
      toast.error("Enter a resume name.");
      return;
    }
    startBusy(async () => {
      const res = await renameCustomization({ id, filename: next });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCustomizations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, filename: res.filename } : c))
      );
      setRenamingId(null);
      setRenameDraft("");
      toast.success(`Renamed to ${res.filename}`);
    });
  }

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------- */}
      {/* Customize (primary)                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="rounded-xl border bg-card/40 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-foreground text-[11px] font-bold text-background">
              1
            </span>
            <h2 className="text-sm font-semibold tracking-tight">
              Customize for a job
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {(result || jdText.trim() || jdFileName) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                title="Clear everything and start the next application"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
            <CoreStatus core={activeCore} />
          </div>
        </div>

        {!activeCore && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--jos-line)] bg-rung-2 p-3 text-xs ">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              No core resume selected yet. Add one in the{" "}
              <strong>Core resume library</strong> below — you only do this once
              (update it every couple of weeks).
            </span>
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Paste the job description, or upload it as a PDF or Word file. The tool
          tailors your core resume to the role and hands back a Word (.docx)
          named for the company.
        </p>

        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the target job description here…"
          className="mt-3 min-h-[160px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={jdFileRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={(e) =>
              setJdFileName(e.target.files?.[0]?.name ?? null)
            }
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => jdFileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {jdFileName ? "Change file" : "Upload PDF / Word"}
          </Button>
          {jdFileName && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {jdFileName}
              <button
                type="button"
                className="text-muted-foreground/70 hover:text-foreground"
                onClick={() => {
                  setJdFileName(null);
                  if (jdFileRef.current) jdFileRef.current.value = "";
                }}
              >
                ✕
              </button>
            </span>
          )}

          <div className="ml-auto">
            <Button
              onClick={handleCustomize}
              disabled={customizing || !activeCore}
            >
              {customizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Customizing…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Customize &amp; download
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {result && (
          <ResultPanel
            key={result.customizationId}
            result={result}
            regenerating={regenerating}
            onRegenerate={handleRegenerate}
          />
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Recent customizations — resume + matching JD side by side        */}
      {/* ---------------------------------------------------------------- */}
      {customizations.length > 0 && (
        <details className="group rounded-xl border bg-card/40 p-5" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">
              Recent tailored resumes{" "}
              <span className="text-muted-foreground">({customizations.length})</span>
            </h2>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Each tailored resume sits next to the job description that was pasted
            or uploaded for that run.
          </p>
          <ul className="mt-3 space-y-3">
            {customizations.map((c) => {
              const editing = renamingId === c.id;
              return (
              <li
                key={c.id}
                className="rounded-lg border border-border/70 bg-background/40 p-3"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {/* Resume column */}
                  <div className="min-w-0">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Tailored resume
                    </p>
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        {editing ? (
                          <input
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitRename(c.id);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelRename();
                              }
                            }}
                            autoFocus
                            disabled={busy}
                            className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                            aria-label="Resume name"
                          />
                        ) : (
                          <p className="truncate text-sm font-medium">{c.filename}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {c.company ?? "—"}
                          {typeof c.match_score === "number" &&
                            ` · Match ${c.match_score}/100`}{" "}
                          · {new Date(c.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {editing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={busy}
                            onClick={() => commitRename(c.id)}
                            aria-label="Save name"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={busy}
                            onClick={cancelRename}
                            aria-label="Cancel rename"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={busy}
                            onClick={() => startRename(c)}
                            aria-label="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={busy}
                            onClick={() => handleDownloadPast(c.id)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Resume
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={busy}
                            onClick={() => handleDeletePast(c.id)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Job description column */}
                  <div className="min-w-0 border-t border-border/60 pt-3 md:border-l md:border-t-0 md:pl-3 md:pt-0">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Job description
                      </p>
                      {c.has_job_description && (
                        <Button
                          variant="ghost"
                          size="xs"
                          disabled={busy}
                          onClick={() => handleDownloadJd(c.id)}
                          title="Download the saved job description"
                        >
                          <Download className="h-3.5 w-3.5" />
                          JD
                        </Button>
                      )}
                    </div>
                    {c.job_description ? (
                      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 font-sans text-[11px] leading-relaxed text-foreground/85">
                        {c.job_description}
                      </pre>
                    ) : (
                      <p className="rounded-md border border-dashed border-border/60 px-2.5 py-3 text-[11px] text-muted-foreground">
                        No job description was saved for this one (older runs
                        before JD storage).
                      </p>
                    )}
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        </details>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Core resume library (secondary / occasional)                     */}
      {/* ---------------------------------------------------------------- */}
      <details className="group rounded-xl border bg-card/40 p-5" open={!activeCore}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-tight">
              Core resume library
            </h2>
            <span className="text-xs text-muted-foreground">
              {activeCore ? `Active: ${activeCore.label}` : "None selected"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <p className="mt-3 text-xs text-muted-foreground">
          Your master resume(s). Upload once; update every couple of weeks. Pick
          the one marked active — that&rsquo;s the resume every customization
          tailors from.
        </p>

        <input
          ref={coreFileRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCoreUpload(f);
          }}
        />

        {resumes.length === 0 ? (
          <div
            className="mt-3 grid cursor-pointer place-items-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center"
            onClick={() => coreFileRef.current?.click()}
          >
            <Upload className="mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Upload your core resume (.docx)
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {resumes.map((r) => (
              <li
                key={r.id}
                className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${
                  r.is_core
                    ? "border-[var(--jos-line)] bg-rung-ok"
                    : "border-border"
                }`}
              >
                <button
                  type="button"
                  disabled={busy || r.is_core}
                  onClick={() => handleSetActive(r.id)}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border disabled:cursor-default"
                  aria-label="Set as core"
                >
                  {r.is_core && (
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-on-action)]" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.label}
                    {r.is_core && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-[var(--jos-line)] bg-rung-ok px-1.5 py-0.5 text-[10px] font-medium ">
                        <Star className="h-2.5 w-2.5" />
                        Core
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.original_filename ?? "resume.docx"} ·{" "}
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                {!r.is_core && (
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={busy}
                    onClick={() => handleSetActive(r.id)}
                  >
                    Set as core
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={busy}
                  onClick={() => handleDeleteResume(r.id)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {resumes.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={busy}
            onClick={() => coreFileRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload another
          </Button>
        )}
      </details>
    </div>
  );
}

function CoreStatus({ core }: { core: ResumeRow | null }) {
  if (!core) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--jos-line)] bg-rung-ok px-2.5 py-1 text-[11px] font-medium ">
      <CheckCircle2 className="h-3 w-3" />
      Core: {core.label}
    </span>
  );
}

function ResultPanel({
  result,
  regenerating,
  onRegenerate,
}: {
  result: CustomizeResult;
  regenerating: boolean;
  onRegenerate: () => void;
}) {
  const { analysis } = result;
  const present = analysis.topKeywords.filter((k) => k.present);
  const missing = analysis.topKeywords.filter((k) => !k.present);

  // Live document state — Apply-anyway rewrites the file and re-downloads.
  const [docx, setDocx] = useState(result.docxBase64);
  const [appliedCount, setAppliedCount] = useState(result.applied);
  const [skipped, setSkipped] = useState<Set<number>>(
    () => new Set(result.skippedIndices)
  );
  const [forced, setForced] = useState<Set<number>>(() => new Set());
  const [workingIdx, setWorkingIdx] = useState<number | null>(null);

  function download() {
    downloadBase64Docx(docx, result.filename);
  }

  async function applyAnyway(idx: number, before: string, after: string) {
    setWorkingIdx(idx);
    const res = await applyEditAnyway({
      customizationId: result.customizationId,
      before,
      after,
    });
    setWorkingIdx(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDocx(res.docxBase64);
    setAppliedCount((n) => n + 1);
    setSkipped((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
    setForced((prev) => new Set(prev).add(idx));
    downloadBase64Docx(res.docxBase64, res.filename);
    toast.success("Applied — updated file downloaded.");
  }

  const indexed = analysis.changes.map((c, idx) => ({ c, idx }));
  const grouped = {
    critical: indexed.filter((x) => x.c.priority === "critical"),
    important: indexed.filter((x) => x.c.priority === "important"),
    optional: indexed.filter((x) => x.c.priority === "optional"),
  };

  // Per-change status so it's obvious what actually made it into the .docx.
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const isTextEditChange = (c: (typeof analysis.changes)[number]) =>
    c.changeType !== "reorder" &&
    c.before.trim().length > 0 &&
    c.after.trim().length > 0 &&
    norm(c.before) !== norm(c.after);
  const unmatchedSet = new Set(result.unmatched.map(norm));
  type ChangeStatus = "applied" | "forced" | "skipped" | "unmatched" | "reorder";
  const statusOf = (c: (typeof analysis.changes)[number], idx: number): ChangeStatus => {
    if (c.changeType === "reorder") return "reorder";
    if (forced.has(idx)) return "forced";
    if (skipped.has(idx)) return "skipped";
    if (isTextEditChange(c) && unmatchedSet.has(norm(c.before))) return "unmatched";
    return "applied";
  };
  const textEdits = analysis.changes.filter(isTextEditChange);
  const totalTextEdits = textEdits.length;
  const unmatchedCount = textEdits.filter((c) =>
    unmatchedSet.has(norm(c.before))
  ).length;
  const reorderCount = analysis.changes.filter(
    (c) => c.changeType === "reorder"
  ).length;

  const STATUS_META: Record<
    ChangeStatus,
    { label: string; badge: string; accent: string }
  > = {
    applied: {
      label: "Applied",
      badge: "border-[var(--jos-line)] bg-rung-ok ",
      accent: "border-l-[var(--color-success)]",
    },
    forced: {
      label: "Applied (added length)",
      badge: "border-[var(--jos-line)] bg-rung-ok ",
      accent: "border-l-[var(--color-success)]",
    },
    skipped: {
      label: "Not applied — would add length",
      badge: "border-[var(--jos-line)] bg-rung-2 ",
      accent: "border-l-amber-400/60",
    },
    unmatched: {
      label: "Not applied — couldn't locate in the doc",
      badge: "border-rung-1 bg-rung-1 ",
      accent: "border-l-red-400/60",
    },
    reorder: {
      label: "Reorder — apply manually",
      badge: "border-border bg-muted text-muted-foreground",
      accent: "border-l-border",
    },
  };

  return (
    <div className="mt-5 space-y-4 rounded-lg border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {analysis.company}
            {analysis.roleTitle ? ` · ${analysis.roleTitle}` : ""}
            {result.version > 1 ? ` · v${result.version}` : ""}
          </p>
          <p className="mt-0.5 text-lg font-semibold">
            Match score {analysis.matchScore}/100
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {analysis.assessment === "strong_customization"
                ? "Strong foundation — customization only"
                : "Would benefit from significant rewriting"}
            </span>
          </p>
        </div>
        <Button onClick={download}>
          <Download className="h-4 w-4" />
          Download {result.filename}
        </Button>
      </div>

      <div className="rounded-md border border-[var(--jos-line)] bg-rung-ok p-3 text-xs">
        <p className="font-semibold">
          {appliedCount} of {totalTextEdits} suggested rewrites are in your
          downloaded resume.
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 opacity-90">
          {skipped.size > 0 && (
            <span>
              {skipped.size} held back to keep the page count — use &ldquo;Apply
              anyway&rdquo;
            </span>
          )}
          {unmatchedCount > 0 && (
            <span>
              {unmatchedCount} couldn&rsquo;t be located in the document
            </span>
          )}
          {reorderCount > 0 && (
            <span>{reorderCount} reorder(s) to apply manually</span>
          )}
          {result.unpreserved.length > 0 && (
            <span>
              {result.unpreserved.length} line(s) had mixed styling collapsed
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[11px] opacity-90">
          Every rewrite below is tagged with whether it made it into the file.
        </p>
      </div>

      {analysis.summary && (
        <p className="rounded-md bg-muted/30 p-3 text-sm leading-relaxed">
          {analysis.summary}
        </p>
      )}

      {/* Keyword coverage */}
      <div>
        <p className="text-xs font-semibold">Top JD keywords</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {present.map((k) => (
            <span
              key={`p-${k.keyword}`}
              className="rounded-full border border-[var(--jos-line)] bg-rung-ok px-2 py-0.5 text-[11px] "
            >
              {k.keyword}
            </span>
          ))}
          {missing.map((k) => (
            <span
              key={`m-${k.keyword}`}
              className="rounded-full border border-rung-1 bg-rung-1 px-2 py-0.5 text-[11px] "
            >
              {k.keyword}
            </span>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {present.length} present · {missing.length} missing
        </p>
      </div>

      {/* Before / After changes */}
      <div className="space-y-3">
        {(["critical", "important", "optional"] as const).map((tier) =>
          grouped[tier].length === 0 ? null : (
            <div key={tier}>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${PRIORITY_META[tier].className}`}
              >
                {PRIORITY_META[tier].label} ({grouped[tier].length})
              </span>
              <div className="mt-2 space-y-2">
                {grouped[tier].map(({ c, idx }) => {
                  const status = statusOf(c, idx);
                  const meta = STATUS_META[status];
                  return (
                    <div
                      key={idx}
                      className={`rounded-md border border-l-2 border-border ${meta.accent} p-3`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium">{c.section}</p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.badge}`}
                          >
                            {(status === "applied" || status === "forced") && (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {meta.label}
                          </span>
                          {status === "skipped" && (
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={workingIdx !== null}
                              onClick={() => applyAnyway(idx, c.before, c.after)}
                            >
                              {workingIdx === idx ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              Apply anyway
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground/80">Why:</span>{" "}
                        {c.reason}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground/80">
                          JD requirement:
                        </span>{" "}
                        {c.jobRequirement}
                      </p>
                      {c.before && (
                        <p className="mt-2 rounded bg-rung-1 px-2 py-1 text-[11px]  line-through decoration-[var(--jos-line)]">
                          {c.before}
                        </p>
                      )}
                      {c.after && (
                        <p className="mt-1 rounded bg-rung-ok px-2 py-1 text-[11px] ">
                          {c.after}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>

      {/* Regenerate — new variation saved as the next version (v2, v3, …). */}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-[11px] text-muted-foreground">
          Not quite right? Regenerate a fresh take on the same job description —
          saved as the next version.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={regenerating}
        >
          {regenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Regenerate (v{result.version + 1})
        </Button>
      </div>
    </div>
  );
}
