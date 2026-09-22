"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppQuestionsTab } from "./AppQuestionsTab";
import { CollegesTab } from "./CollegesTab";
import { ConsultantsTab } from "./ConsultantsTab";
import { DashboardTab } from "./DashboardTab";
import { FaqTab } from "./FaqTab";
import { LeftRail } from "./LeftRail";
import { NotesTab } from "./NotesTab";
import { IngestPanel } from "./IngestPanel";
import { ProjectManagementTab } from "./ProjectManagementTab";
import { TestingTab, testingItems } from "./TestingTab";
import {
  appCore,
  consultantCriteria,
  consultantFirms,
  consultantQuestions,
  demographicBlocks,
  essayPromptList,
  faqCategories,
  phases,
  seedScores,
  supplementCards,
  writingBlocks,
} from "@/lib/content";
import { currentPhaseIndex, phaseStatuses } from "@/lib/phases";
import { useSchoolPipeline } from "@/lib/use-school-pipeline";
import { defaultListPrefs, mergeListPrefs, canAdvanceListPhase, isForwardListPhaseMove, type MemberListPrefs } from "@/lib/list-phases";
import type { PersistedIngestSource, PersistedProjectStep } from "@/lib/ingest";
import { INBOX_PARENT_ID } from "@/lib/ingest";
import {
  migrateLegacyNotesText,
  normalizePinNotes,
  type PinNote,
} from "@/lib/note-board";
import { normalizeCalendarEvents, type CalendarEvent } from "@/lib/calendar-events";
import { parseEventDateFromText } from "@/lib/event-date";
import {
  DEFAULT_PROJECT_SECTION,
  resolveProjectSection,
  type ProjectSectionId,
} from "@/lib/project-management";
import {
  canMarkTodoDone,
  memberOwnerId,
  normalizeTodoEdits,
  todoOwnerIndex,
  type TodoEdit,
  type TodoEditMap,
  type TodoSubtaskMap,
} from "@/lib/project-todos";
import type { MemberProfile } from "@/lib/member-avatars";
import type { ContactPatch, DeadlinePatch, Owner, School, Scores, TabId } from "@/lib/types";
import {
  fromSeed,
  isAdmissionTrack,
  isApplicationStatus,
  isChoice,
  isInterestLevel,
  isListPhaseId,
  isPlan,
  isSelectivityTier,
  normalizeTabId,
} from "@/lib/types";

const schoolListeners = new Set<() => void>();

function emitSchool() {
  schoolListeners.forEach((listener) => listener());
}

function subscribeSchool(listener: () => void) {
  schoolListeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    schoolListeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

function schoolFromLocation() {
  return new URLSearchParams(window.location.search).get("school");
}

function readStart(): {
  tab: TabId;
  schoolId: string | null;
  projectSection: ProjectSectionId;
  noteId: string | null;
} {
  if (typeof window === "undefined") {
    return {
      tab: "dashboard",
      schoolId: null,
      projectSection: DEFAULT_PROJECT_SECTION,
      noteId: null,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const school = params.get("school");
  const pmRaw = params.get("pm");
  const projectSection = resolveProjectSection(pmRaw);
  const noteId = params.get("note");
  if (school) return { tab: "colleges", schoolId: school, projectSection, noteId: null };
  // Legacy Project Management → Ingest deep link
  if (params.get("tab") === "projects" && pmRaw === "ingest") {
    return { tab: "ingest", schoolId: null, projectSection: DEFAULT_PROJECT_SECTION, noteId: null };
  }
  const tab = normalizeTabId(params.get("tab")) ?? "dashboard";
  return {
    tab,
    schoolId: null,
    projectSection,
    noteId: tab === "notes" && noteId ? noteId : null,
  };
}

export function Portal({
  member: initialMember,
}: {
  member: { id: string; displayName: string; role: string; email: string; avatarUrl: string | null };
}) {
  // Always start on dashboard so SSR and the first client paint match. URL sync happens after mount.
  const [tab, setTab] = useState<TabId>("dashboard");
  const [projectSection, setProjectSection] = useState<ProjectSectionId>(DEFAULT_PROJECT_SECTION);
  const schoolId = useSyncExternalStore(subscribeSchool, schoolFromLocation, () => null);
  const [member, setMember] = useState(initialMember);
  const [memberProfiles, setMemberProfiles] = useState<MemberProfile[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [scores, setScores] = useState<Scores>(seedScores);
  const [notes, setNotes] = useState("");
  const [noteItems, setNoteItems] = useState<PinNote[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarFocusDate, setCalendarFocusDate] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [projectSteps, setProjectSteps] = useState<PersistedProjectStep[]>([]);
  const [ingestSources, setIngestSources] = useState<PersistedIngestSource[]>([]);
  const [todoSubtasks, setTodoSubtasks] = useState<TodoSubtaskMap>({});
  const [todoEdits, setTodoEdits] = useState<TodoEditMap>({});
  const pipeline = useSchoolPipeline();
  const schools = pipeline.schools;
  const setSchools = pipeline.setSchools;
  const [persisted, setPersisted] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [listPrefs, setListPrefs] = useState<MemberListPrefs>(() => defaultListPrefs());
  const prefsTimer = useRef<number | undefined>(undefined);
  const urlBootstrapped = useRef(false);
  const legacyNotesMigrated = useRef(false);

  useEffect(() => {
    if (urlBootstrapped.current) return;
    urlBootstrapped.current = true;
    const start = readStart();
    setTab(start.tab);
    setProjectSection(start.projectSection);
    setOpenNoteId(start.noteId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [stateRes, prefsRes, membersRes] = await Promise.all([
          fetch("/api/state"),
          fetch("/api/prefs"),
          fetch("/api/members"),
        ]);
        const state = (await stateRes.json()) as {
          checklist?: Record<string, boolean>;
          scores?: Scores;
          notes?: string;
          projectSteps?: PersistedProjectStep[];
          ingestSources?: PersistedIngestSource[];
          todoSubtasks?: TodoSubtaskMap;
          todoEdits?: TodoEditMap;
          noteItems?: PinNote[];
          calendarEvents?: CalendarEvent[];
          persisted?: boolean;
        };
        const prefsBody = (await prefsRes.json()) as {
          prefs?: MemberListPrefs;
          error?: string;
        };
        const membersBody = (await membersRes.json()) as {
          members?: MemberProfile[];
        };
        if (cancelled) return;
        if (state.checklist) setChecklist(state.checklist);
        if (state.scores) setScores({ ...seedScores, ...state.scores });
        if (typeof state.notes === "string") setNotes(state.notes);
        if (Array.isArray(state.projectSteps)) setProjectSteps(state.projectSteps);
        if (Array.isArray(state.ingestSources)) setIngestSources(state.ingestSources);
        if (state.todoSubtasks && typeof state.todoSubtasks === "object") {
          setTodoSubtasks(state.todoSubtasks);
        }
        if (state.todoEdits && typeof state.todoEdits === "object") {
          setTodoEdits(normalizeTodoEdits(state.todoEdits));
        }
        const loadedNotes = typeof state.notes === "string" ? state.notes : "";
        const loadedItems = Array.isArray(state.noteItems)
          ? normalizePinNotes(state.noteItems)
          : [];
        if (loadedItems.length) {
          setNoteItems(loadedItems);
        } else if (loadedNotes.trim() && !legacyNotesMigrated.current) {
          legacyNotesMigrated.current = true;
          const migrated = migrateLegacyNotesText(
            loadedNotes,
            memberOwnerId(initialMember.id),
          );
          setNoteItems(migrated);
          if (migrated.length && state.persisted) {
            void fetch("/api/state", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ noteItems: migrated }),
            });
          }
        } else {
          setNoteItems([]);
        }
        if (Array.isArray(state.calendarEvents)) {
          setCalendarEvents(normalizeCalendarEvents(state.calendarEvents));
        }
        if (Array.isArray(membersBody.members)) {
          setMemberProfiles(membersBody.members);
          const mine = membersBody.members.find((row) => row.id === initialMember.id);
          if (mine) {
            setMember((current) => ({
              ...current,
              displayName: mine.displayName,
              role: mine.role,
              avatarUrl: mine.avatarUrl,
            }));
          }
        }
        setPersisted(Boolean(state.persisted));
        if (prefsBody.prefs) setListPrefs(mergeListPrefs(prefsBody.prefs));
      } catch {
        if (!cancelled) setSaveState("Not saved");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [initialMember.id]);

  function saveListPrefs(next: MemberListPrefs) {
    const merged = mergeListPrefs(next);
    setListPrefs(merged);
    window.clearTimeout(prefsTimer.current);
    prefsTimer.current = window.setTimeout(() => {
      void fetch("/api/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("prefs");
          const body = (await response.json()) as { prefs?: MemberListPrefs };
          if (body.prefs) setListPrefs(mergeListPrefs(body.prefs));
          setSaveState("Saved");
        })
        .catch(() => setSaveState("Not saved"));
    }, 350);
  }

  const replaceUrl = useCallback(
    (
      nextTab: TabId,
      nextSchool: string | null,
      nextProjectSection: ProjectSectionId = projectSection,
      nextNoteId: string | null = null,
    ) => {
      const params = new URLSearchParams();
      if (nextTab !== "colleges") params.set("tab", nextTab);
      if (nextTab === "projects") {
        params.set("pm", nextProjectSection);
      }
      if (nextTab === "notes" && nextNoteId) params.set("note", nextNoteId);
      if (nextSchool) params.set("school", nextSchool);
      const query = params.toString();
      window.history.replaceState(null, "", query ? `/?${query}` : "/");
      emitSchool();
    },
    [projectSection],
  );

  function goTab(next: TabId) {
    setTab(next);
    if (next !== "notes") setOpenNoteId(null);
    replaceUrl(next, next === "colleges" ? schoolId : null, projectSection, null);
  }

  function openNote(id: string | null) {
    setOpenNoteId(id);
    setTab("notes");
    replaceUrl("notes", null, projectSection, id);
  }

  function changeNoteItems(next: PinNote[]) {
    setNoteItems(next);
    setSaveState("Saving...");
    void patchState({ noteItems: next }).then((ok) => {
      setSaveState(ok ? "Saved" : "Not saved");
    });
  }

  function goProjectSection(next: ProjectSectionId) {
    setProjectSection(next);
    setTab("projects");
    replaceUrl("projects", null, next);
  }

  const statuses = useMemo(() => phaseStatuses(phases, checklist), [checklist]);
  const phaseIndex = currentPhaseIndex(statuses);
  const current = phases[phaseIndex];
  const phaseLabel = current ? `Phase ${phaseIndex + 1} · ${current.phase}` : "";
  const faqCount = faqCategories.reduce((sum, category) => sum + category.items.length, 0);
  const testingCount = testingItems(phases).length;

  async function patchState(body: {
    checklist?: Record<string, boolean>;
    scores?: Scores;
    notes?: string;
    projectSteps?: PersistedProjectStep[];
    ingestSources?: PersistedIngestSource[];
    todoSubtasks?: TodoSubtaskMap;
    todoEdits?: TodoEditMap;
    noteItems?: PinNote[];
    calendarEvents?: CalendarEvent[];
  }) {
    if (!persisted) {
      setSaveState("Not saved");
      return false;
    }
    setSaveState("Saving...");
    const response = await fetch("/api/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaveState(response.ok ? "Saved" : "Not saved");
    if (response.ok && body.notes !== undefined) {
      window.setTimeout(() => setSaveState(""), 1500);
    }
    return response.ok;
  }

  function toggleItem(id: string, checked: boolean) {
    const owners = todoOwnerIndex(projectSteps, todoEdits);
    const owner = owners.get(id);
    const viewer = memberOwnerId(member.id);
    if (owner && !canMarkTodoDone(viewer, owner)) {
      setSaveState("Only the list owner can check that off");
      window.setTimeout(() => setSaveState(""), 2000);
      return;
    }
    const next = { ...checklist, [id]: checked };
    setChecklist(next);
    void patchState({ checklist: next });
  }

  function changeSubtasks(next: TodoSubtaskMap) {
    setTodoSubtasks(next);
    void patchState({ todoSubtasks: next });
  }

  function changeTodoEdit(id: string, patch: TodoEdit) {
    const next = normalizeTodoEdits({
      ...todoEdits,
      [id]: { ...todoEdits[id], ...patch },
    });
    setTodoEdits(next);
    void patchState({ todoEdits: next });
  }

  async function confirmIngest(payload: {
    steps: PersistedProjectStep[];
    source: PersistedIngestSource;
    notes: string;
    noteItems: PinNote[];
    calendarEvents: CalendarEvent[];
  }) {
    const nextSources = [...ingestSources.filter((row) => row.id !== payload.source.id), payload.source];
    setProjectSteps(payload.steps);
    setIngestSources(nextSources);
    setNotes(payload.notes);
    setNoteItems(payload.noteItems);
    setCalendarEvents(payload.calendarEvents);
    const ok = await patchState({
      projectSteps: payload.steps,
      ingestSources: nextSources,
      notes: payload.notes,
      noteItems: payload.noteItems,
      calendarEvents: payload.calendarEvents,
    });
    if (!ok) {
      throw new Error("Could not save ingest");
    }
  }

  function makeTodoFromNote(note: PinNote) {
    const createdAt = new Date().toISOString();
    const step: PersistedProjectStep = {
      id: `note-todo-${note.id.slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`,
      label: note.title,
      owner: memberOwnerId(member.id),
      assignedBy: memberOwnerId(member.id),
      parentId: INBOX_PARENT_ID,
      dueDate: null,
      startDate: null,
      endDate: null,
      sourceId: note.sourceId,
      createdAt,
      assetUrl: note.assetUrl,
    };
    const next = [...projectSteps, step];
    setProjectSteps(next);
    void patchState({ projectSteps: next });
    goProjectSection("todos");
  }

  function makeCalendarFromNote(note: PinNote) {
    const createdAt = new Date().toISOString();
    const notesParts = [
      note.previewSummary?.trim() || "",
      note.body?.trim() || "",
      note.url?.trim() || "",
    ].filter(Boolean);
    const date = parseEventDateFromText(
      note.title,
      note.previewSummary,
      note.body,
      note.url,
    );
    const event: CalendarEvent = {
      id: `note-cal-${note.id.slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`,
      title: note.title,
      date,
      startTime: null,
      endTime: null,
      notes: notesParts.join("\n\n"),
      createdAt,
      createdBy: memberOwnerId(member.id),
      sourceId: note.sourceId,
      assetUrl: note.assetUrl,
      assetPath: note.assetPath,
    };
    const next = [event, ...calendarEvents];
    setCalendarEvents(next);
    setCalendarFocusDate(date);
    void patchState({ calendarEvents: next });
    goProjectSection("calendar");
  }

  function changeScore(firmId: string, criterionId: string, value: number) {
    const next = { ...scores, [firmId]: { ...scores[firmId], [criterionId]: value } };
    setScores(next);
    void patchState({ scores: next });
  }

  function replaceSchool(school: School) {
    setSchools((current) => current.map((item) => (item.id === school.id ? school : item)));
  }

  async function patchSchool(id: string, patch: Partial<School>) {
    setSchools((current) => current.map((school) => (school.id === id ? { ...school, ...patch } : school)));
    if (!pipeline.persisted) {
      setSaveState("Not saved");
      return;
    }
    const response = await fetch(`/api/schools/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setSaveState("Not saved");
      return;
    }
    const body = (await response.json()) as { school: School };
    replaceSchool(body.school);
    setSaveState("Saved");
  }

  async function createSchool(name: string) {
    if (!pipeline.persisted) {
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "school";
      setSchools((current) => [
        ...current,
        fromSeed({
          id,
          name,
          location: "",
          campusSize: "",
          mechanicalEngineering: "",
          materials: "",
          materialsOffering: "",
          admissionsContext: "",
          satContext: "",
          selectivity: "",
          notes: "",
          listOrder: current.length + 1,
        }),
      ]);
      setSaveState("Not saved");
      return;
    }
    setSaveState("Looking up this school...");
    const response = await fetch("/api/schools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setSaveState("Not saved");
      return;
    }
    const body = (await response.json()) as { school: School; research?: { summary?: string } };
    setSchools((current) => [...current, body.school]);
    replaceUrl("colleges", body.school.id);
    setSaveState(body.research?.summary || "Saved");
  }

  async function deleteSchool(id: string) {
    setSchools((current) => current.filter((school) => school.id !== id));
    replaceUrl("colleges", null);
    if (!pipeline.persisted) {
      setSaveState("Not saved");
      return;
    }
    await fetch(`/api/schools/${id}`, { method: "DELETE" });
  }

  async function addStep(id: string, label: string, owner: Owner) {
    if (!pipeline.persisted) {
      setSchools((current) =>
        current.map((school) =>
          school.id === id
            ? {
                ...school,
                steps: [
                  ...school.steps,
                  { id: crypto.randomUUID(), label, owner, done: false, sortOrder: school.steps.length },
                ],
              }
            : school,
        ),
      );
      setSaveState("Not saved");
      return;
    }
    const response = await fetch(`/api/schools/${id}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, owner }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { school: School };
    replaceSchool(body.school);
  }

  async function patchStep(id: string, stepId: string, patch: { done?: boolean; owner?: Owner; label?: string }) {
    setSchools((current) =>
      current.map((school) =>
        school.id === id
          ? { ...school, steps: school.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)) }
          : school,
      ),
    );
    if (!pipeline.persisted) {
      setSaveState("Not saved");
      return;
    }
    const response = await fetch(`/api/schools/${id}/steps`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, ...patch }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { school: School };
    replaceSchool(body.school);
  }

  async function removeStep(id: string, stepId: string) {
    setSchools((current) =>
      current.map((school) =>
        school.id === id ? { ...school, steps: school.steps.filter((step) => step.id !== stepId) } : school,
      ),
    );
    if (!pipeline.persisted) return;
    const response = await fetch(`/api/schools/${id}/steps?stepId=${encodeURIComponent(stepId)}`, { method: "DELETE" });
    if (!response.ok) return;
    const body = (await response.json()) as { school: School };
    replaceSchool(body.school);
  }

  async function addDeadline(id: string, title: string, dueDate: string | null) {
    if (!pipeline.persisted) {
      setSchools((current) =>
        current.map((school) =>
          school.id === id
            ? {
                ...school,
                deadlines: [
                  ...school.deadlines,
                  { id: crypto.randomUUID(), title, dueDate, completed: false, sortOrder: school.deadlines.length },
                ],
              }
            : school,
        ),
      );
      setSaveState("Not saved");
      return;
    }
    const response = await fetch(`/api/schools/${id}/deadlines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dueDate }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { school: School };
    replaceSchool(body.school);
  }

  async function patchDeadline(id: string, deadlineId: string, patch: DeadlinePatch) {
    setSchools((current) =>
      current.map((school) =>
        school.id === id
          ? { ...school, deadlines: school.deadlines.map((item) => (item.id === deadlineId ? { ...item, ...patch } : item)) }
          : school,
      ),
    );
    if (!pipeline.persisted) {
      setSaveState("Not saved");
      return;
    }
    const response = await fetch(`/api/schools/${id}/deadlines`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadlineId, ...patch }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { school: School };
    replaceSchool(body.school);
  }

  async function removeDeadline(id: string, deadlineId: string) {
    setSchools((current) =>
      current.map((school) =>
        school.id === id ? { ...school, deadlines: school.deadlines.filter((item) => item.id !== deadlineId) } : school,
      ),
    );
    if (!pipeline.persisted) return;
    const response = await fetch(`/api/schools/${id}/deadlines?deadlineId=${encodeURIComponent(deadlineId)}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    const body = (await response.json()) as { school: School };
    replaceSchool(body.school);
  }

  async function addContact(id: string, contact: ContactPatch) {
    const name = contact.name?.trim() ?? "";
    if (!name) return;
    if (!pipeline.persisted) {
      setSchools((current) =>
        current.map((school) =>
          school.id === id
            ? {
                ...school,
                contacts: [
                  ...school.contacts,
                  {
                    id: crypto.randomUUID(),
                    name,
                    role: contact.role?.trim() ?? "",
                    email: contact.email?.trim() ?? "",
                    phone: contact.phone?.trim() ?? "",
                  },
                ],
              }
            : school,
        ),
      );
      setSaveState("Not saved");
      return;
    }
    const response = await fetch(`/api/schools/${id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contact),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { school: School };
    replaceSchool(body.school);
  }

  async function patchContact(id: string, contactId: string, patch: ContactPatch) {
    setSchools((current) =>
      current.map((school) =>
        school.id === id
          ? { ...school, contacts: school.contacts.map((item) => (item.id === contactId ? { ...item, ...patch } : item)) }
          : school,
      ),
    );
    if (!pipeline.persisted) return;
    const response = await fetch(`/api/schools/${id}/contacts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, ...patch }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { school: School };
    replaceSchool(body.school);
  }

  async function removeContact(id: string, contactId: string) {
    setSchools((current) =>
      current.map((school) =>
        school.id === id ? { ...school, contacts: school.contacts.filter((item) => item.id !== contactId) } : school,
      ),
    );
    if (!pipeline.persisted) return;
    const response = await fetch(`/api/schools/${id}/contacts?contactId=${encodeURIComponent(contactId)}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    const body = (await response.json()) as { school: School };
    replaceSchool(body.school);
  }

  return (
    <div className="shell">
      <LeftRail
        tab={tab}
        onChange={goTab}
        projectSection={projectSection}
        onProjectSectionChange={goProjectSection}
        member={member}
        onAvatarChange={(avatarUrl) => {
          setMember((current) => ({ ...current, avatarUrl }));
          setMemberProfiles((current) =>
            current.map((row) => (row.id === member.id ? { ...row, avatarUrl } : row)),
          );
        }}
        schoolCount={schools.length}
        projectCount={phases.length}
        questionCount={essayPromptList.length}
        consultantCount={consultantFirms.length}
        faqCount={faqCount}
        testingCount={testingCount}
        phases={phases}
        statuses={statuses}
        phaseIndex={phaseIndex}
        open={railOpen}
        onOpenChange={setRailOpen}
      />
      <main className="main">
        <button
          className="rail-toggle"
          type="button"
          aria-expanded={railOpen}
          aria-controls="app-rail"
          onClick={() => setRailOpen((value) => !value)}
        >
          Menu
        </button>
        {tab === "dashboard" ? (
          <DashboardTab
            schools={schools}
            checklist={checklist}
            dateline={phaseLabel}
          />
        ) : null}
        {tab === "colleges" ? (
          <CollegesTab
            schools={schools}
            selectedId={schoolId}
            dateline={phaseLabel}
            listPrefs={listPrefs}
            memberId={member.id}
            onListPrefsChange={saveListPrefs}
            onOpen={(id) => {
              replaceUrl("colleges", id);
            }}
            onClose={() => {
              replaceUrl("colleges", null);
            }}
            onPatch={(id, patch) => {
              if (patch.choice !== undefined && !isChoice(patch.choice)) return;
              if (patch.plan !== undefined && !isPlan(patch.plan)) return;
              if (patch.selectivityTier !== undefined && !isSelectivityTier(patch.selectivityTier)) return;
              if (patch.interestLevel !== undefined && !isInterestLevel(patch.interestLevel)) return;
              if (patch.applicationStatus !== undefined && !isApplicationStatus(patch.applicationStatus)) return;
              if (patch.admissionTrack !== undefined && !isAdmissionTrack(patch.admissionTrack)) return;
              if (patch.listPhase !== undefined && !isListPhaseId(patch.listPhase)) return;
              if (patch.listPhase !== undefined) {
                const current = schools.find((school) => school.id === id);
                if (
                  current &&
                  isForwardListPhaseMove(current.listPhase, patch.listPhase) &&
                  !canAdvanceListPhase(member.id)
                ) {
                  return;
                }
              }
              void patchSchool(id, patch);
            }}
            onCreate={(value) => createSchool(value)}
            onDelete={(id) => void deleteSchool(id)}
            onAddStep={(id, label, owner) => void addStep(id, label, owner)}
            onPatchStep={(id, stepId, patch) => void patchStep(id, stepId, patch)}
            onDeleteStep={(id, stepId) => void removeStep(id, stepId)}
            onAddDeadline={(id, title, dueDate) => void addDeadline(id, title, dueDate)}
            onPatchDeadline={(id, deadlineId, patch) => void patchDeadline(id, deadlineId, patch)}
            onDeleteDeadline={(id, deadlineId) => void removeDeadline(id, deadlineId)}
            onAddContact={(id, contact) => void addContact(id, contact)}
            onPatchContact={(id, contactId, patch) => void patchContact(id, contactId, patch)}
            onDeleteContact={(id, contactId) => void removeContact(id, contactId)}
          />
        ) : null}
        {tab === "projects" ? (
          <ProjectManagementTab
            section={projectSection}
            onSectionChange={goProjectSection}
            memberId={member.id}
            memberProfiles={memberProfiles}
            phases={phases}
            checklist={checklist}
            projectSteps={projectSteps}
            calendarEvents={calendarEvents}
            calendarFocusDate={calendarFocusDate}
            subtasks={todoSubtasks}
            todoEdits={todoEdits}
            onToggle={toggleItem}
            onChangeSubtasks={changeSubtasks}
            onEditTodo={changeTodoEdit}
            dateline={phaseLabel}
          />
        ) : null}
        {tab === "ingest" ? (
          <section className="pm">
            <header className="page-head">
              <div>
                <div className="dateline">{phaseLabel}</div>
                <h2>Ingest</h2>
              </div>
            </header>
            <p className="pm-blurb">
              Paste, URL, or upload PDF/PNG/JPG — read text for suggestions, or save the asset
              as-is to Note, To-do, and/or Calendar.
            </p>
            <IngestPanel
              phases={phases}
              projectSteps={projectSteps}
              ingestSources={ingestSources}
              notes={notes}
              noteItems={noteItems}
              calendarEvents={calendarEvents}
              assignedBy={memberOwnerId(member.id)}
              onConfirm={confirmIngest}
            />
          </section>
        ) : null}
        {tab === "faq" ? <FaqTab categories={faqCategories} dateline={phaseLabel} /> : null}
        {tab === "questions" ? (
          <AppQuestionsTab
            core={appCore}
            prompts={essayPromptList}
            writing={writingBlocks}
            demographics={demographicBlocks}
            supplements={supplementCards}
            dateline={phaseLabel}
          />
        ) : null}
        {tab === "consultants" ? (
          <ConsultantsTab
            firms={consultantFirms}
            criteria={consultantCriteria}
            questions={consultantQuestions}
            scores={scores}
            onScore={changeScore}
            dateline={phaseLabel}
          />
        ) : null}
        {tab === "notes" ? (
          <NotesTab
            memberId={member.id}
            memberProfiles={memberProfiles}
            noteItems={noteItems}
            openNoteId={openNoteId}
            dateline={phaseLabel}
            onOpenNote={openNote}
            onChangeNoteItems={changeNoteItems}
            onMakeTodo={makeTodoFromNote}
            onMakeCalendar={makeCalendarFromNote}
          />
        ) : null}
        {tab === "testing" ? (
          <TestingTab phases={phases} checklist={checklist} onToggle={toggleItem} dateline={phaseLabel} />
        ) : null}
        <div className="save-state">{loaded && pipeline.loaded ? saveState : "Loading..."}</div>
      </main>
    </div>
  );
}
