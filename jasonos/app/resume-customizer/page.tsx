import type { Metadata } from "next";
import {
  FileText,
  Upload,
  Briefcase,
  Wand2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  RESUME_ANALYSIS_CATEGORIES,
  RESUME_CHANGE_FIELDS,
  RESUME_FINAL_OUTPUTS,
  RESUME_PRIORITY_TIERS,
} from "@/lib/resume-customizer/prompt";

export const metadata: Metadata = { title: "Resume Customizer · JasonOS" };

// Placeholder scaffold. The working tool will: (1) store a "core" resume
// (.docx), (2) ingest a target job description, (3) generate a tailored
// version of the core resume for that JD. Wiring comes in a follow-up.

export default function ResumeCustomizerPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-300">
          <Wand2 className="h-4 w-4" />
          Resume Customizer
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Tailor your resume to any job
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Keep one master &ldquo;core&rdquo; resume, drop in a job description,
          and generate a customized version tuned to that role. This section is
          scaffolded — the steps below are placeholders while we build the
          workflow.
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
          <Sparkles className="h-3 w-3" />
          Coming soon — placeholder UI
        </span>
      </header>

      {/* Step flow */}
      <div className="grid gap-4 md:grid-cols-3">
        <StepCard
          step={1}
          icon={<FileText className="h-4 w-4" />}
          title="Core resume"
          body="Your master resume (.docx) — the source of truth we tailor from."
        >
          <div className="grid place-items-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
            <Upload className="mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Upload .docx (coming soon)
            </p>
          </div>
        </StepCard>

        <StepCard
          step={2}
          icon={<Briefcase className="h-4 w-4" />}
          title="Job description"
          body="Paste or ingest the target role's description."
        >
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3">
            <div className="h-24 rounded-md bg-muted/30" />
            <p className="mt-2 text-xs text-muted-foreground">
              Paste a job description (coming soon)
            </p>
          </div>
        </StepCard>

        <StepCard
          step={3}
          icon={<Wand2 className="h-4 w-4" />}
          title="Customized resume"
          body="A new version of your core resume, tuned to the job."
        >
          <div className="grid place-items-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
            <Sparkles className="mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Tailored output will appear here
            </p>
          </div>
        </StepCard>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-md bg-foreground/40 px-4 py-2 text-sm font-medium text-background/80 opacity-60"
          title="Available once the workflow is wired up"
        >
          <Wand2 className="h-4 w-4" />
          Customize resume
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Baked-in customization guidance (drives the engine once wired). */}
      <section className="rounded-xl border bg-card/40 p-5">
        <h2 className="text-sm font-semibold tracking-tight">
          How it will customize your resume
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The rules below are locked in and will drive the analysis and the
          tailored .docx output. Original design, formatting, and branding are
          preserved; nothing is invented — content is only reworded,
          repositioned, or reordered.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <GuidanceList title="What it evaluates" items={RESUME_ANALYSIS_CATEGORIES} />
          <GuidanceList title="Priority tiers" items={RESUME_PRIORITY_TIERS} />
          <GuidanceList title="For each change" items={RESUME_CHANGE_FIELDS} />
          <GuidanceList title="Final summary" items={RESUME_FINAL_OUTPUTS} />
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Output: a downloadable Word (.docx) with original formatting, a
          Before/After summary of every change (with the reason and the related
          job requirement), and any formatting that couldn&rsquo;t be preserved.
          Executive resumes prioritize leadership, strategic impact, and
          measurable business outcomes over tactical duties.
        </p>
      </section>
    </div>
  );
}

function GuidanceList({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((it) => (
          <li key={it} className="flex gap-1.5 text-xs text-foreground/80">
            <span className="text-muted-foreground/50">•</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepCard({
  step,
  icon,
  title,
  body,
  children,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border bg-card/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
          {step}
        </span>
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{body}</p>
      <div className="mt-auto">{children}</div>
    </section>
  );
}
