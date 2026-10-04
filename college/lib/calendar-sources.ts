/** Read-only calendar rows derived from stages, to-dos, deadlines, and visits. */

import type { CalendarEvent } from "@/lib/calendar-events";
import { isFamilyMeetingKind } from "@/lib/family-meeting";
import { todoPrimaryDate, type ProjectTodo } from "@/lib/project-todos";
import type { TimelineStage } from "@/lib/timeline-stages";
import { ownerLabel, type AdmissionTrack } from "@/lib/types";

export type ProcessCalendarSource = "stage" | "todo" | "deadline" | "visit";

export type ProcessCalendarEntry = CalendarEvent & {
  source: ProcessCalendarSource;
  projectId?: string | null;
};

export const TRACK_DEADLINE_TITLES: Record<Exclude<AdmissionTrack, "">, readonly string[]> = {
  ed1: ["Early Decision"],
  ed2: ["Early Decision II"],
  ea: ["Early Action", "Early Action II"],
  rea: ["Restrictive Early Action"],
  rd: ["Regular Decision", "Regular Decision (Rolling)"],
  rolling: ["Regular Decision (Rolling)"],
};

export const PROCESS_SOURCE_LABEL: Record<ProcessCalendarSource, string> = {
  stage: "Milestone",
  todo: "To-do",
  deadline: "Deadline",
  visit: "Visit",
};

type CalendarSchool = {
  id: string;
  name: string;
  archived?: boolean;
  admissionTrack?: AdmissionTrack | "";
  visitDate?: string | null;
  deadlines?: Array<{ id: string; title: string; dueDate: string | null }>;
};

export type ProcessCalendarInput = {
  stages?: TimelineStage[];
  todos?: ProjectTodo[];
  schools?: CalendarSchool[];
};

function stamp(date: string): string {
  return `${date}T12:00:00.000Z`;
}

function baseEvent(
  id: string,
  title: string,
  date: string,
  extra: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id,
    title,
    date,
    startTime: null,
    endTime: null,
    notes: "",
    createdAt: stamp(date),
    createdBy: "jason",
    sourceId: null,
    assetUrl: null,
    assetPath: null,
    schoolId: null,
    sourceNoteId: null,
    ...extra,
  };
}

function todoTitle(todo: ProjectTodo): string {
  if (!todo.owner) return todo.label;
  return `${todo.label} (${ownerLabel(todo.owner)})`;
}

function deadlineTitlesForTrack(track: AdmissionTrack | "" | undefined): Set<string> {
  if (!track) return new Set();
  const titles = TRACK_DEADLINE_TITLES[track as Exclude<AdmissionTrack, "">];
  return new Set(titles ?? []);
}

export function processCalendarEntries(input: ProcessCalendarInput): ProcessCalendarEntry[] {
  const out: ProcessCalendarEntry[] = [];

  for (const stage of input.stages ?? []) {
    if (!stage.isMilestone) continue;
    out.push({
      ...baseEvent(`stage-${stage.id}`, stage.name, stage.start, { sourceId: stage.id }),
      source: "stage",
      projectId: stage.projectId,
    });
  }

  const milestoneIds = new Set(
    (input.stages ?? []).filter((stage) => stage.isMilestone).map((stage) => stage.id),
  );

  for (const todo of input.todos ?? []) {
    if (todo.done) continue;
    if (isFamilyMeetingKind(todo.kind)) continue;
    if (milestoneIds.has(todo.id)) continue;
    const date = todoPrimaryDate(todo);
    if (!date) continue;
    out.push({
      ...baseEvent(`todo-${todo.id}`, todoTitle(todo), date, {
        sourceId: todo.id,
        schoolId: todo.schoolId,
      }),
      source: "todo",
      projectId: todo.projectId,
    });
  }

  for (const school of input.schools ?? []) {
    if (school.archived) continue;
    const allowed = deadlineTitlesForTrack(school.admissionTrack);
    if (allowed.size) {
      for (const deadline of school.deadlines ?? []) {
        if (!deadline.dueDate) continue;
        if (!allowed.has(deadline.title)) continue;
        out.push({
          ...baseEvent(
            `deadline-${deadline.id}`,
            `${school.name} - ${deadline.title}`,
            deadline.dueDate,
            { sourceId: deadline.id, schoolId: school.id },
          ),
          source: "deadline",
        });
      }
    }
    if (school.visitDate) {
      out.push({
        ...baseEvent(`visit-${school.id}`, `Visit: ${school.name}`, school.visitDate, {
          sourceId: school.id,
          schoolId: school.id,
        }),
        source: "visit",
      });
    }
  }

  return out.sort(
    (a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.title.localeCompare(b.title),
  );
}
