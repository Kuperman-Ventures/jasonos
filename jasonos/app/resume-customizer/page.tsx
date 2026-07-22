import type { Metadata } from "next";
import { Wand2 } from "lucide-react";
import {
  RESUME_ANALYSIS_CATEGORIES,
  RESUME_CHANGE_FIELDS,
  RESUME_FINAL_OUTPUTS,
  RESUME_PRIORITY_TIERS,
} from "@/lib/resume-customizer/prompt";
import {
  listResumes,
  listCustomizations,
} from "@/lib/server-actions/resume-customizer";
import { listCoverLetters } from "@/lib/server-actions/cover-letter";
import { ResumeCustomizerClient } from "@/components/jasonos/resume-customizer/resume-customizer-client";
import { CoverLetterClient } from "@/components/jasonos/resume-customizer/cover-letter-client";

export const metadata: Metadata = { title: "Custom Communications · JasonOS" };
export const dynamic = "force-dynamic";

export default async function CustomCommunicationsPage() {
  const [resumes, customizations, coverLetters] = await Promise.all([
    listResumes(),
    listCustomizations(),
    listCoverLetters(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-300">
          <Wand2 className="h-4 w-4" />
          Custom Communications
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Tailor your resume and cover letter to any job
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Keep one master &ldquo;core&rdquo; resume, drop in a job description,
          and get back a customized Word document tuned to that role — with a
          Before/After summary of every change. Then draft a matching cover
          letter from the same job and tailored resume. Original design and
          formatting are preserved; nothing is invented.
        </p>
      </header>

      <ResumeCustomizerClient
        initialResumes={resumes}
        initialCustomizations={customizations}
      />

      <CoverLetterClient
        customizations={customizations}
        initialCoverLetters={coverLetters}
      />

      {/* Baked-in customization guidance (what the engine does under the hood). */}
      <section className="rounded-xl border bg-card/40 p-5">
        <h2 className="text-sm font-semibold tracking-tight">
          How it customizes your resume
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          These rules drive the analysis and the tailored .docx output. Original
          design, formatting, and branding are preserved; content is only
          reworded, repositioned, or reordered — never invented.
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
