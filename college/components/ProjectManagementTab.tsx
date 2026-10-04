"use client";

import { useState } from "react";
import { CalendarPanel } from "./CalendarPanel";
import { TimelinePanel } from "./TimelinePanel";
import { TodosPanel } from "./TodosPanel";
import type { CalendarEvent } from "@/lib/calendar-events";
import type { PersistedProjectStep } from "@/lib/ingest";
import type { TodoProject } from "@/lib/todo-projects";
import { ensureNamedTodoProject } from "@/lib/todo-projects";
import {
  PROJECT_SECTIONS,
  projectSectionById,
  type ProjectSectionId,
} from "@/lib/project-management";
import { processCalendarEntries } from "@/lib/calendar-sources";
import { listProjectTodos, type TodoEdit, type TodoEditMap, type TodoKind, type TodoSubtaskMap } from "@/lib/project-todos";
import { TIMELINE_PROJECTS, allTimelineStages } from "@/lib/timeline-stages";
import type { MemberProfile } from "@/lib/member-avatars";
import type { Owner, Phase, School } from "@/lib/types";
import type { StageAssignPayload } from "./TimelineStageModal";

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
  onAssignStage,
  dateline,
  schools = [],
  onOpenSchool,
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
  onAddTodo: (label: string, kind?: TodoKind) => void;
  onChangeCalendarEvents: (next: CalendarEvent[]) => void;
  onAssignStage?: (stage: StageAssignPayload, owner: Owner | null) => void;
  dateline: string;
  schools?: School[];
  onOpenSchool?: (schoolId: string) => void;
}) {
  const active = projectSectionById(section);
  const [addingTodo, setAddingTodo] = useState(false);
  const [newTodoLabel, setNewTodoLabel] = useState("");
  const [newTodoKind, setNewTodoKind] = useState<TodoKind>("normal");
  const [focusTodoProjectId, setFocusTodoProjectId] = useState<string | null>(null);
  const [focusStageProjectId, setFocusStageProjectId] = useState<string | null>(null);
  const projectTodos = listProjectTodos(checklist, phases, projectSteps, todoEdits);
  const processEntries = processCalendarEntries({
    stages: allTimelineStages(),
    todos: projectTodos,
    schools,
  });

  function startAdd(kind: TodoKind) {
    setNewTodoKind(kind);
    setAddingTodo(true);
    setNewTodoLabel("");
  }

  function commitNewTodo() {
    const label = newTodoLabel.trim();
    if (!label) {
      setAddingTodo(false);
      setNewTodoLabel("");
      return;
    }
    onAddTodo(label, newTodoKind);
    setNewTodoLabel("");
    setAddingTodo(false);
    setNewTodoKind("normal");
  }

  function changeSection(next: ProjectSectionId) {
    onSectionChange(next);
    setAddingTodo(false);
    setNewTodoLabel("");
    setNewTodoKind("normal");
    if (next !== "todos") setFocusTodoProjectId(null);
    if (next !== "timeline") setFocusStageProjectId(null);
  }

  function openTodosForProject(projectId: string) {
    const track = TIMELINE_PROJECTS.find((row) => row.id === projectId);
    if (track) {
      const ensured = ensureNamedTodoProject(todoProjects, track.id, track.name);
      if (ensured.created) onChangeTodoProjects(ensured.projects);
    }
    setFocusTodoProjectId(projectId);
    onSectionChange("todos");
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
                <div className="todos-rocker todo-add-kind" role="group" aria-label="To-do type">
                  <button
                    type="button"
                    className="todos-rocker-opt"
                    aria-pressed={newTodoKind === "normal"}
                    onClick={() => setNewTodoKind("normal")}
                  >
                    To-do
                  </button>
                  <button
                    type="button"
                    className="todos-rocker-opt"
                    aria-pressed={newTodoKind === "family_meeting"}
                    onClick={() => setNewTodoKind("family_meeting")}
                  >
                    Family meeting
                  </button>
                </div>
                <input
                  className="field"
                  autoFocus
                  value={newTodoLabel}
                  aria-label={newTodoKind === "family_meeting" ? "Family meeting topic" : "New to-do"}
                  placeholder={
                    newTodoKind === "family_meeting"
                      ? "What should the family discuss?"
                      : "What needs doing?"
                  }
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
                      setNewTodoKind("normal");
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
                    setNewTodoKind("normal");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="todo-add-buttons">
                <button type="button" className="btn btn-secondary" onClick={() => startAdd("normal")}>
                  Add a to-do
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => startAdd("family_meeting")}
                >
                  Family meeting
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {active.blurb ? <p className="pm-blurb">{active.blurb}</p> : null}

      {active.status === "ready" && active.id === "timeline" ? (
        <TimelinePanel
          phases={phases}
          checklist={checklist}
          onToggle={onToggle}
          projectSteps={projectSteps}
          todoEdits={todoEdits}
          memberId={memberId}
          memberProfiles={memberProfiles}
          onOpenTodos={openTodosForProject}
          onAssignStage={onAssignStage}
          focusProjectId={focusStageProjectId}
        />
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
          focusProjectId={focusTodoProjectId}
        />
      ) : null}

      {active.status === "ready" && active.id === "calendar" ? (
        <CalendarPanel
          events={calendarEvents}
          processEntries={processEntries}
          familyTodos={projectTodos.filter((todo) => todo.kind === "family_meeting")}
          dateline={dateline}
          focusDate={calendarFocusDate}
          onChangeEvents={onChangeCalendarEvents}
          onOpenProcessEntry={(entry) => {
            if (entry.source === "todo") {
              setFocusTodoProjectId(entry.projectId ?? null);
              onSectionChange("todos");
              return;
            }
            if (entry.source === "stage" && entry.projectId) {
              setFocusStageProjectId(entry.projectId);
              onSectionChange("timeline");
              return;
            }
            if ((entry.source === "deadline" || entry.source === "visit") && entry.schoolId) {
              onOpenSchool?.(entry.schoolId);
            }
          }}
        />
      ) : null}
    </section>
  );
}
