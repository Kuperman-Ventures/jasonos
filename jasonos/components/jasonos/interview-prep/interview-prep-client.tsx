"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Download,
  Loader2,
  MessageSquareQuote,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  deleteSavedInterviewPrep,
  generateInterviewPrep,
  getSavedInterviewPrep,
  saveInterviewPrep,
  type InterviewTarget,
} from "@/lib/server-actions/interview-prep";
import type { InterviewPrep } from "@/lib/interview-prep/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function targetLabel(t: InterviewTarget): string {
  const company = t.company?.trim() || "Unknown company";
  const role = t.roleTitle?.trim();
  return role ? `${company} · ${role}` : company;
}

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function prepTitle(prep: InterviewPrep): string {
  return [prep.company, prep.roleTitle].filter(Boolean).join(" · ");
}

function itemsHtml(
  items: { title: string; why: string; actionLabel: string; action: string }[]
): string {
  return items
    .map(
      (item) => `<li class="item">
      <p class="q">${esc(item.title)}</p>
      <p class="why">${esc(item.why)}</p>
      <p class="angle"><span class="label">${esc(item.actionLabel)}:</span> ${esc(item.action)}</p>
    </li>`
    )
    .join("");
}

/** Opens a print-ready brief so Jason can Save as PDF from the browser dialog. */
function downloadInterviewPrepPdf(prep: InterviewPrep) {
  const title = prepTitle(prep) || "Interview Prep";
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const background = itemsHtml(
    prep.backgroundQuestions.map((q) => ({
      title: q.question,
      why: q.why,
      actionLabel: "Lean on",
      action: q.angle,
    }))
  );
  const gaps = itemsHtml(
    prep.gapQuestions.map((q) => ({
      title: q.question,
      why: q.why,
      actionLabel: "Handle it",
      action: q.angle,
    }))
  );
  const highlights = itemsHtml(
    prep.highlights.map((h) => ({
      title: h.point,
      why: h.why,
      actionLabel: "On resume",
      action: h.whereOnResume,
    }))
  );

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>${esc(title)} — Interview Prep</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Georgia,'Times New Roman',serif;color:#111;background:#fff;margin:0;padding:36px;max-width:800px;font-size:12px;line-height:1.45}
      .head{border-bottom:1.5px solid #111;padding-bottom:10px;margin-bottom:14px}
      .eyebrow{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#555;margin:0 0 4px}
      h1{font-size:20px;line-height:1.25;margin:0 0 4px;font-weight:700}
      .meta{font-size:10.5px;color:#555;margin:0}
      .framing{margin:0 0 18px;font-size:12.5px}
      h2{font-size:13px;margin:18px 0 4px;padding-top:8px;border-top:1px solid #ddd}
      .sub{font-size:10.5px;color:#555;margin:0 0 8px}
      ol{margin:0;padding-left:18px}
      .item{margin:0 0 10px;page-break-inside:avoid}
      .q{margin:0 0 3px;font-weight:700}
      .why,.angle{margin:0 0 2px;color:#333}
      .label{color:#555}
      @media print{
        body{padding:12mm}
        h2{page-break-after:avoid}
      }
    </style></head><body>
    <div class="head">
      <p class="eyebrow">Interview Prep</p>
      <h1>${esc(title)}</h1>
      <p class="meta">Jason Kuperman · ${esc(today)}</p>
    </div>
    ${prep.framing ? `<p class="framing">${esc(prep.framing)}</p>` : ""}
    <h2>Questions about your background</h2>
    <p class="sub">Likely digs into experience that maps to this role.</p>
    <ol>${background}</ol>
    <h2>Gaps they may probe</h2>
    <p class="sub">Where the JD asks for something that looks thin or missing on the resume.</p>
    <ol>${gaps}</ol>
    <h2>Bring these up</h2>
    <p class="sub">Resume points worth highlighting for this company and seat.</p>
    <ol>${highlights}</ol>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Pop-up blocked — allow pop-ups to download the PDF.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

export function InterviewPrepClient({
  targets: initialTargets,
  initialSaved = null,
}: {
  targets: InterviewTarget[];
  initialSaved?: {
    customizationId: string;
    updatedAt: string;
    prep: InterviewPrep;
  } | null;
}) {
  const [targets, setTargets] = useState(initialTargets);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialTargets[0]?.id ?? null
  );
  const [prep, setPrep] = useState<InterviewPrep | null>(
    initialSaved?.prep ?? null
  );
  const [prepForId, setPrepForId] = useState<string | null>(
    initialSaved?.customizationId ?? null
  );
  const [savedAt, setSavedAt] = useState<string | null>(
    initialSaved?.updatedAt ?? null
  );
  const [dirty, setDirty] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const selected = useMemo(
    () => targets.find((t) => t.id === selectedId) ?? null,
    [targets, selectedId]
  );

  function clearPrepState() {
    setPrep(null);
    setPrepForId(null);
    setSavedAt(null);
    setDirty(false);
  }

  function loadSavedFor(id: string) {
    setLoadingSaved(true);
    clearPrepState();
    startTransition(async () => {
      const result = await getSavedInterviewPrep({ customizationId: id });
      setLoadingSaved(false);
      if (!result.ok) return;
      setPrep(result.saved.prep);
      setPrepForId(id);
      setSavedAt(result.saved.updatedAt);
      setDirty(false);
    });
  }

  function selectTarget(id: string) {
    setSelectedId(id);
    loadSavedFor(id);
  }

  function runPrep() {
    if (!selectedId) {
      toast.error("Pick a role first.");
      return;
    }
    startTransition(async () => {
      const result = await generateInterviewPrep({ customizationId: selectedId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPrep(result.prep);
      setPrepForId(selectedId);
      setDirty(true);
      toast.success(
        selected?.hasSavedPrep
          ? "New prep ready — save to replace the stored one."
          : "Interview prep ready — save it to keep it."
      );
    });
  }

  function handleSave() {
    if (!selectedId || !prep || prepForId !== selectedId) {
      toast.error("Generate a prep first.");
      return;
    }
    startSave(async () => {
      const result = await saveInterviewPrep({
        customizationId: selectedId,
        prep,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSavedAt(result.saved.updatedAt);
      setDirty(false);
      setTargets((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? {
                ...t,
                hasSavedPrep: true,
                savedPrepUpdatedAt: result.saved.updatedAt,
              }
            : t
        )
      );
      toast.success("Prep saved.");
    });
  }

  function handleDeleteSaved() {
    if (!selectedId) return;
    startDelete(async () => {
      const result = await deleteSavedInterviewPrep({
        customizationId: selectedId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSavedAt(null);
      setDirty(Boolean(prep && prepForId === selectedId));
      setTargets((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? { ...t, hasSavedPrep: false, savedPrepUpdatedAt: null }
            : t
        )
      );
      toast.success("Saved prep deleted.");
    });
  }

  const showingPrep = prep && prepForId === selectedId ? prep : null;
  const isSavedClean = Boolean(showingPrep && savedAt && !dirty);
  const canSave = Boolean(showingPrep && dirty);
  const busy = isPending || isSaving || isDeleting || loadingSaved;

  return (
    <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <aside className="space-y-3">
        <header>
          <h1 className="text-lg font-semibold tracking-tight">Interview Prep</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick a job you already ran through Resume Customizer. We read that JD
            and the tailored resume, then surface likely questions, gaps, and
            points to highlight. Save a prep to reopen it later.
          </p>
        </header>

        {targets.length === 0 ? (
          <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No customized roles with job descriptions yet. Customize a resume for
            a JD first, then come back here.
          </div>
        ) : (
          <ul className="max-h-[min(70vh,640px)] space-y-1 overflow-y-auto rounded-xl border bg-card/40 p-1.5">
            {targets.map((t) => {
              const active = t.id === selectedId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => selectTarget(t.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium leading-snug text-foreground">
                        {targetLabel(t)}
                      </div>
                      {t.hasSavedPrep ? (
                        <BookmarkCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{formatDate(t.createdAt)}</span>
                      {t.version != null ? <span>v{t.version}</span> : null}
                      {t.matchScore != null ? (
                        <span className="tabular-nums">{t.matchScore}% match</span>
                      ) : null}
                      {t.hasSavedPrep ? <span>Saved</span> : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <Button
            onClick={runPrep}
            disabled={!selected || busy}
            className="w-full gap-1.5"
          >
            {isPending && !loadingSaved ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning JD + resume…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {selected?.hasSavedPrep ? "Regenerate prep" : "Generate prep"}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={!canSave || busy}
            className="w-full gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : isSavedClean ? (
              <>
                <BookmarkCheck className="h-4 w-4" />
                Saved
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                Save prep
              </>
            )}
          </Button>
          {selected?.hasSavedPrep ? (
            <Button
              variant="ghost"
              onClick={handleDeleteSaved}
              disabled={busy}
              className="w-full gap-1.5 text-muted-foreground"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete saved prep
            </Button>
          ) : null}
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        {!selected ? (
          <EmptyState message="Select a customized role to get started." />
        ) : loadingSaved ? (
          <EmptyState message="Loading saved prep…" />
        ) : isPending && !showingPrep ? (
          <EmptyState message="Reading the job description and tailored resume…" />
        ) : !showingPrep ? (
          <EmptyState
            message={`Ready for ${targetLabel(selected)}. Hit Generate prep when you want the brief.`}
          />
        ) : (
          <PrepResults
            prep={showingPrep}
            status={
              dirty
                ? "Unsaved draft — hit Save prep to keep this version."
                : savedAt
                  ? `Saved ${formatDate(savedAt)}`
                  : null
            }
          />
        )}
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed bg-card/30 px-6 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function PrepResults({
  prep,
  status,
}: {
  prep: InterviewPrep;
  status: string | null;
}) {
  const title = prepTitle(prep);

  return (
    <div className="space-y-5">
      <header className="space-y-2 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {status ? (
              <p className="text-[11px] text-muted-foreground">{status}</p>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => downloadInterviewPrepPdf(prep)}
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{prep.framing}</p>
      </header>

      <PrepSection
        icon={MessageSquareQuote}
        title="Questions about your background"
        subtitle="Likely digs into experience that maps to this role."
        tone="sky"
      >
        {prep.backgroundQuestions.map((q, i) => (
          <PrepItem
            key={`bg-${i}`}
            title={q.question}
            why={q.why}
            actionLabel="Lean on"
            action={q.angle}
          />
        ))}
      </PrepSection>

      <PrepSection
        icon={AlertTriangle}
        title="Gaps they may probe"
        subtitle="Where the JD asks for something that looks thin or missing on the resume."
        tone="amber"
      >
        {prep.gapQuestions.map((q, i) => (
          <PrepItem
            key={`gap-${i}`}
            title={q.question}
            why={q.why}
            actionLabel="Handle it"
            action={q.angle}
          />
        ))}
      </PrepSection>

      <PrepSection
        icon={Target}
        title="Bring these up"
        subtitle="Resume points worth highlighting for this company and seat."
        tone="emerald"
      >
        {prep.highlights.map((h, i) => (
          <PrepItem
            key={`hi-${i}`}
            title={h.point}
            why={h.why}
            actionLabel="On resume"
            action={h.whereOnResume}
          />
        ))}
      </PrepSection>
    </div>
  );
}

function PrepSection({
  icon: Icon,
  title,
  subtitle,
  tone,
  children,
}: {
  icon: typeof Target;
  title: string;
  subtitle: string;
  tone: "sky" | "amber" | "emerald";
  children: ReactNode;
}) {
  const toneClass =
    tone === "sky"
      ? "text-sky-300"
      : tone === "amber"
        ? "text-amber-300"
        : "text-emerald-300";

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", toneClass)} />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function PrepItem({
  title,
  why,
  actionLabel,
  action,
}: {
  title: string;
  why: string;
  actionLabel: string;
  action: string;
}) {
  return (
    <li className="rounded-xl border bg-card/50 px-3.5 py-3">
      <p className="text-sm font-medium leading-snug">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{why}</p>
      <p className="mt-2 text-xs leading-relaxed">
        <span className="text-muted-foreground">{actionLabel}: </span>
        <span className="text-foreground/90">{action}</span>
      </p>
    </li>
  );
}
