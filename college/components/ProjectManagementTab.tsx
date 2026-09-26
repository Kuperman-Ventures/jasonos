"use client";

import { useState } from "react";
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
import type { TodoProject } from "@/lib/todo-projects";
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
  todoProjects,
  onToggle,
  onChangeSubtasks,
  onEditTodo,
  onChangeTodoProjects,
  onDeleteTodoProject,
  onDeleteTodo,
  onAddTodo,
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
  todoProjects: TodoProject[];
  onToggle: (id: string, checked: boolean) => void;
  onChangeSubtasks: (next: TodoSubtaskMap) => void;
  onEditTodo: (id: string, patch: TodoEdit) => void;
  onChangeTodoProjects: (next: TodoProject[]) => void;
  onDeleteTodoProject: (projectId: string) => void;
  onDeleteTodo: (id: string) => void;
  onAddTodo: (label: string) => void;
  onChangeCalendarEvents: (next: CalendarEvent[]) => void;
  dateline: string;
}) {
  const active = projectSectionById(section);
  const [addingTodo, setAddingTodo] = useState(false);
  const [newTodoLabel, setNewTodoLabel] = useState("");

  function commitNewTodo() {
    const label = newTodoLabel.trim();
    if (!label) {
      setAddingTodo(false);
      setNewTodoLabel("");
      return;
    }
    onAddTodo(label);
    setNewTodoLabel("");
    setAddingTodo(false);
  }

  function changeSection(next: ProjectSectionId) {
    onSectionChange(next);
    setAddingTodo(false);
    setNewTodoLabel("");
  }

  return (
    <section className="pm">
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Project Management</h2>
        </div>
      </header>

      <div className="pm-toolbar">
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
                  if (item.status === "ready") changeSection(item.id);
                }}
              >
                <span className="pm-subnav-label">{item.label}</span>
                {item.status === "soon" ? <span className="pm-subnav-soon">Soon</span> : null}
              </button>
            );
          })}
        </nav>

        {section === "todos" ? (
          <div className="todo-add pm-toolbar-action">
            {addingTodo ? (
              <div className="todo-add-draft">
                <input
                  className="field"
                  autoFocus
                  value={newTodoLabel}
                  aria-label="New to-do"
                  placeholder="What needs doing?"
                  onChange={(event) => setNewTodoLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitNewTodo();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setAddingTodo(false);
                      setNewTodoLabel("");
                    }
                  }}
                />
                <button type="button" className="btn btn-primary compact" onClick={commitNewTodo}>
                  Add
                </button>
                <button
                  type="button"
                  className="btn btn-ghost compact"
                  onClick={() => {
                    setAddingTodo(false);
                    setNewTodoLabel("");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => setAddingTodo(true)}>
                Add a to-do
              </button>
            )}
          </div>
        ) : null}
      </div>

      {active.blurb ? <p className="pm-blurb">{active.blurb}</p> : null}

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
          todoProjects={todoProjects}
          onToggle={onToggle}
          onChangeSubtasks={onChangeSubtasks}
          onEditTodo={onEditTodo}
          onChangeTodoProjects={onChangeTodoProjects}
          onDeleteTodoProject={onDeleteTodoProject}
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
