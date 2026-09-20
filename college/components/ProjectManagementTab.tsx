"use client";

import { IngestPanel, type IngestConfirmPayload } from "./IngestPanel";
import { TimelinePanel } from "./TimelinePanel";
import { TodosPanel } from "./TodosPanel";
import type { PersistedIngestSource, PersistedProjectStep } from "@/lib/ingest";
import {
  PROJECT_SECTIONS,
  projectSectionById,
  type ProjectSectionId,
} from "@/lib/project-management";
import type { Phase } from "@/lib/types";

export function ProjectManagementTab({
  section,
  onSectionChange,
  memberId,
  phases,
  checklist,
  projectSteps,
  ingestSources,
  notes,
  onToggle,
  onConfirmIngest,
  dateline,
}: {
  section: ProjectSectionId;
  onSectionChange: (section: ProjectSectionId) => void;
  memberId: string;
  phases: Phase[];
  checklist: Record<string, boolean>;
  projectSteps: PersistedProjectStep[];
  ingestSources: PersistedIngestSource[];
  notes: string;
  onToggle: (id: string, checked: boolean) => void;
  onConfirmIngest: (payload: IngestConfirmPayload) => Promise<void>;
  dateline: string;
}) {
  const active = projectSectionById(section);

  return (
    <section className="pm">
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Project Management</h2>
        </div>
      </header>

      <nav className="pm-subnav" aria-label="Project Management sections">
        {PROJECT_SECTIONS.map((item) => {
          const selected = item.id === section;
          return (
            <button
              key={item.id}
              type="button"
              className={selected ? "active" : ""}
              aria-current={selected ? "page" : undefined}
              disabled={item.status === "soon"}
              title={item.status === "soon" ? "Coming later" : item.blurb}
              onClick={() => {
                if (item.status === "ready") onSectionChange(item.id);
              }}
            >
              <span className="pm-subnav-label">{item.label}</span>
              {item.status === "soon" ? <span className="pm-subnav-soon">Soon</span> : null}
            </button>
          );
        })}
      </nav>

      <p className="pm-blurb">{active.blurb}</p>

      {active.status === "ready" && active.id === "timeline" ? (
        <TimelinePanel phases={phases} checklist={checklist} onToggle={onToggle} />
      ) : null}

      {active.status === "ready" && active.id === "todos" ? (
        <TodosPanel
          memberId={memberId}
          phases={phases}
          checklist={checklist}
          projectSteps={projectSteps}
          onToggle={onToggle}
        />
      ) : null}

      {active.status === "ready" && active.id === "ingest" ? (
        <IngestPanel
          phases={phases}
          projectSteps={projectSteps}
          ingestSources={ingestSources}
          notes={notes}
          onConfirm={onConfirmIngest}
        />
      ) : null}

      {active.status === "soon" ? (
        <div className="pm-soon">
          <h3 className="dash-title">{active.label}</h3>
          <p className="section-sub">
            This submenu is reserved for the next project-management build. Timeline, To-dos, and
            Ingest stay available above in the meantime.
          </p>
        </div>
      ) : null}
    </section>
  );
}
