import type { Metadata } from "next";
import {
  FileText,
  Upload,
  Briefcase,
  Wand2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

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

      <div className="rounded-lg border border-border bg-card/40 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">What&rsquo;s next</p>
        <p className="mt-1">
          Share how you want this to work — how the core resume is stored and
          versioned, what parts should adapt to the JD (summary, bullets,
          skills ordering, keywords), the tone/length rules, and the output
          format (edited .docx, PDF, or side-by-side diff). I&rsquo;ll wire the
          steps above accordingly.
        </p>
      </div>
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
