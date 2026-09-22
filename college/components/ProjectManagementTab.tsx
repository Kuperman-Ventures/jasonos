"use client";

import { CalendarPanel } from "./CalendarPanel";
import { TimelinePanel } from "./TimelinePanel";
import { TodosPanel } from "./TodosPanel";
import type { CalendarEvent } from "@/lib/calendar-events";
import type { PersistedProjectStep } from "@/lib/ingest";
import {
  PROJECT_SECTIONS,
  projectSectionById,
  type ProjectSectionId,
} from "@/lib/project-management";
import { type TodoEdit, type TodoEditMap, type TodoSubtaskMap } from "@/lib/project-todos";
import type { MemberProfile } from "@/lib/member-avatars";
import type { Phase } from "@/lib/types";

export function ProjectManagementTab({
  section,
  onSectionChange,
  memberId,
  memberProfiles,
  phases,
  checklist,
  projectSteps,
  calendarEvents,
  calendarFocusDate,
  subtasks,
  todoEdits,
  onToggle,
  onChangeSubtasks,
  onEditTodo,
  onDeleteTodo,
  onChangeCalendarEvents,
  dateline,
}: {
  section: ProjectSectionId;
  onSectionChange: (section: ProjectSectionId) => void;
  memberId: string;
  memberProfiles: MemberProfile[];
  phases: Phase[];
  checklist: Record<string, boolean>;
  projectSteps: PersistedProjectStep[];
  calendarEvents: CalendarEvent[];
  calendarFocusDate?: string | null;
  subtasks: TodoSubtaskMap;
  todoEdits: TodoEditMap;
  onToggle: (id: string, checked: boolean) => void;
  onChangeSubtasks: (next: TodoSubtaskMap) => void;
  onEditTodo: (id: string, patch: TodoEdit) => void;
  onDeleteTodo: (id: string) => void;
  onChangeCalendarEvents: (next: CalendarEvent[]) => void;
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
          memberProfiles={memberProfiles}
          phases={phases}
          checklist={checklist}
          projectSteps={projectSteps}
          subtasks={subtasks}
          todoEdits={todoEdits}
          onToggle={onToggle}
          onChangeSubtasks={onChangeSubtasks}
          onEditTodo={onEditTodo}
          onDeleteTodo={onDeleteTodo}
        />
      ) : null}

      {active.status === "ready" && active.id === "calendar" ? (
        <CalendarPanel
          events={calendarEvents}
          dateline={dateline}
          focusDate={calendarFocusDate}
          onChangeEvents={onChangeCalendarEvents}
        />
      ) : null}
    </section>
  );
}
