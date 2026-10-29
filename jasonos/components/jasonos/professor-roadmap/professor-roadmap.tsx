"use client";

import type { ProfessorRoadmap as ProfessorRoadmapData } from "@/lib/professor-roadmap/types";
import { DecisionsPanel } from "./decisions-panel";
import { NextStepsPanel } from "./next-steps-panel";
import { OpenQuestionsPanel } from "./open-questions-panel";
import { SchoolBriefPanel } from "./school-brief-panel";

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProfessorRoadmap({ data }: { data: ProfessorRoadmapData }) {
  const researched = data.questions.filter(
    (q) => q.status === "researched" || q.status === "confirmed"
  ).length;
  const openSteps = data.nextSteps.filter((s) => s.status === "open").length;
  const primary = data.schools.find((s) => s.isPrimary) ?? data.schools[0];
  const lastBrief = relativeTime(primary?.briefRefreshedAt ?? null);

  return (
    <div className="mx-auto max-w-[960px] space-y-6 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--jos-ink)]">
          Professor Roadmap
        </h1>
        <p className="mt-1 text-xs text-[var(--jos-muted)]">
          {researched} of {data.questions.length} questions researched ·{" "}
          {openSteps} next steps open · last brief refresh {lastBrief}
        </p>
      </header>

      <OpenQuestionsPanel
        questions={data.questions}
        schools={data.schools}
      />
      <SchoolBriefPanel schools={data.schools} />
      <NextStepsPanel
        nextSteps={data.nextSteps}
        questions={data.questions}
        decisions={data.decisions}
      />
      <DecisionsPanel
        decisions={data.decisions}
        questions={data.questions}
      />
    </div>
  );
}
