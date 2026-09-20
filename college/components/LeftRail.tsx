"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import {
  PROJECT_SECTIONS,
  type ProjectSectionId,
} from "@/lib/project-management";
import type { PhaseStatus } from "@/lib/phases";
import type { Phase, TabId } from "@/lib/types";

const PRIMARY: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "colleges", label: "Colleges" },
  { id: "projects", label: "Project Management" },
  { id: "questions", label: "App Questions" },
  { id: "consultants", label: "Consultants" },
  { id: "notes", label: "Notes" },
];

const REFERENCE: { id: TabId; label: string }[] = [
  { id: "faq", label: "FAQ" },
  { id: "testing", label: "Testing" },
];

function roleLabel(role: string): string {
  if (role === "super_admin") return "Admin";
  if (role === "parent") return "Parent";
  if (role === "student") return "Student";
  return role;
}

export function LeftRail({
  tab,
  onChange,
  projectSection,
  onProjectSectionChange,
  member,
  schoolCount,
  projectCount,
  questionCount,
  consultantCount,
  faqCount,
  testingCount,
  phases,
  statuses,
  phaseIndex,
  open,
  onOpenChange,
}: {
  tab: TabId;
  onChange: (tab: TabId) => void;
  projectSection: ProjectSectionId;
  onProjectSectionChange: (section: ProjectSectionId) => void;
  member: { displayName: string; role: string };
  schoolCount: number;
  projectCount: number;
  questionCount: number;
  consultantCount: number;
  faqCount: number;
  testingCount: number;
  phases: Phase[];
  statuses: PhaseStatus[];
  phaseIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const railRef = useRef<HTMLElement>(null);
  const current = phases[phaseIndex];
  const next = phases[phaseIndex + 1];
  const counts: Partial<Record<TabId, number>> = {
    colleges: schoolCount,
    projects: projectCount,
    questions: questionCount,
    consultants: consultantCount,
    faq: faqCount,
    testing: testingCount,
  };
  const projectsOpen = tab === "projects";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && open) onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    railRef.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [open]);

  function select(nextTab: TabId) {
    onChange(nextTab);
    onOpenChange(false);
  }

  return (
    <>
      <div
        className="rail-scrim"
        data-open={open ? "true" : "false"}
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <aside className="rail" id="app-rail" ref={railRef} data-open={open ? "true" : "false"}>
        <div className="rail-ident">
          <Image src="/logo.png" alt="" width={40} height={26} priority />
          <h1>Kyle&apos;s College Search</h1>
          <span className="who">
            <b>Junior year</b>
            Columbia High School
            <br />
            Maplewood, NJ
          </span>
        </div>

        <nav className="rail-nav" aria-label="Sections">
          {PRIMARY.map((item) => (
            <div key={item.id} className="rail-item">
              <a
                className="rail-link"
                href={item.id === "projects" ? "/?tab=projects&pm=timeline" : `/?tab=${item.id}`}
                aria-current={tab === item.id ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  select(item.id);
                }}
              >
                <span>{item.label}</span>
                {counts[item.id] !== undefined ? <span className="count">{counts[item.id]}</span> : null}
              </a>
              {item.id === "projects" && projectsOpen ? (
                <nav className="rail-subnav" aria-label="Project Management sections">
                  {PROJECT_SECTIONS.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className={
                        projectSection === section.id ? "rail-sublink active" : "rail-sublink"
                      }
                      aria-current={projectSection === section.id ? "page" : undefined}
                      disabled={section.status === "soon"}
                      onClick={() => {
                        if (section.status !== "ready") return;
                        onProjectSectionChange(section.id);
                        onOpenChange(false);
                      }}
                    >
                      <span>{section.label}</span>
                      {section.status === "soon" ? <span className="soon">Soon</span> : null}
                    </button>
                  ))}
                </nav>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="rail-group">
          <span className="label">Reference</span>
        </div>
        <nav className="rail-nav" aria-label="Reference">
          {REFERENCE.map((item) => (
            <a
              key={item.id}
              className="rail-link"
              href={`/?tab=${item.id}`}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                select(item.id);
              }}
            >
              <span>{item.label}</span>
              {counts[item.id] !== undefined ? <span className="count">{counts[item.id]}</span> : null}
            </a>
          ))}
        </nav>

        <div className="rail-foot">
          <span className="label">
            Phase {phaseIndex + 1} of {phases.length}
            {current ? ` · ${current.phase}` : ""}
          </span>
          <div
            className="phases"
            role="progressbar"
            aria-label="Application phase"
            aria-valuenow={phaseIndex + 1}
            aria-valuemin={1}
            aria-valuemax={phases.length}
            aria-valuetext={`Phase ${phaseIndex + 1} of ${phases.length}${current ? `, ${current.phase}` : ""}`}
          >
            {phases.map((phase, index) => {
              const status = statuses[index]?.status ?? "upcoming";
              const state = status === "done" ? "done" : status === "current" ? "now" : undefined;
              const title =
                status === "current"
                  ? `${index + 1} · ${phase.phase} — in progress`
                  : `${index + 1} · ${phase.phase}`;
              return <i key={phase.phase} data-state={state} title={title} />;
            })}
          </div>
          {current ? (
            <div className="phase-now">
              <span className="n">{String(phaseIndex + 1).padStart(2, "0")}</span>
              <span className="name">{current.phase}</span>
            </div>
          ) : null}
          {next ? (
            <span className="phase-next">
              Next · {next.phase}
              {next.window ? `, ${next.window}` : ""}
            </span>
          ) : null}
          <div className="rail-account">
            <strong>
              {member.displayName} · {roleLabel(member.role)}
            </strong>
            <form action="/auth/signout" method="post">
              <button type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
