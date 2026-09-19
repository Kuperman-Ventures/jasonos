"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { AppQuestionsTab } from "./AppQuestionsTab";
import { CollegesTab } from "./CollegesTab";
import { ConsultantsTab } from "./ConsultantsTab";
import { FaqTab } from "./FaqTab";
import { NotesTab } from "./NotesTab";
import { TabNav } from "./TabNav";
import { ThemeToggle } from "./ThemeToggle";
import { TimelineTab } from "./TimelineTab";
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
import type { ContactPatch, DeadlinePatch, Owner, School, Scores, TabId } from "@/lib/types";
import {
  fromSeed,
  isAdmissionTrack,
  isApplicationStatus,
  isChoice,
  isInterestLevel,
  isPlan,
  isSelectivityTier,
  TABS,
} from "@/lib/types";

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

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

function readStart(): { tab: TabId; schoolId: string | null } {
  if (typeof window === "undefined") return { tab: "colleges", schoolId: null };
  const params = new URLSearchParams(window.location.search);
  const school = params.get("school");
  if (school) return { tab: "colleges", schoolId: school };
  const requested = params.get("tab");
  const tab = requested && TABS.some((item) => item.id === requested) ? (requested as TabId) : "colleges";
  return { tab, schoolId: null };
}

export function Portal() {
  const start = readStart();
  const [tab, setTab] = useState<TabId>(start.tab);
  const schoolId = useSyncExternalStore(subscribeSchool, schoolFromLocation, () => null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [scores, setScores] = useState<Scores>(seedScores);
  const [notes, setNotes] = useState("");
  const pipeline = useSchoolPipeline();
  const schools = pipeline.schools;
  const setSchools = pipeline.setSchools;
  const [persisted, setPersisted] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [loaded, setLoaded] = useState(false);
  const notesTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const stateRes = await fetch("/api/state");
        const state = (await stateRes.json()) as {
          checklist?: Record<string, boolean>;
          scores?: Scores;
          notes?: string;
          persisted?: boolean;
        };
        if (cancelled) return;
        if (state.checklist) setChecklist(state.checklist);
        if (state.scores) setScores({ ...seedScores, ...state.scores });
        if (typeof state.notes === "string") setNotes(state.notes);
        setPersisted(Boolean(state.persisted));
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
  }, []);

  const replaceUrl = useCallback((nextTab: TabId, nextSchool: string | null) => {
    const params = new URLSearchParams();
    if (nextTab !== "colleges") params.set("tab", nextTab);
    if (nextSchool) params.set("school", nextSchool);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
    emitSchool();
  }, []);

  const statuses = useMemo(() => phaseStatuses(phases, checklist), [checklist]);
  const phaseIndex = currentPhaseIndex(statuses);
  const pill = `${phases[phaseIndex]?.phase ?? "Timeline"} · Phase ${phaseIndex + 1} of ${phases.length}`;

  async function patchState(body: { checklist?: Record<string, boolean>; scores?: Scores; notes?: string }) {
    if (!persisted) {
      setSaveState("Not saved");
      return;
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
  }

  function toggleItem(id: string, checked: boolean) {
    const next = { ...checklist, [id]: checked };
    setChecklist(next);
    void patchState({ checklist: next });
  }

  function changeScore(firmId: string, criterionId: string, value: number) {
    const next = { ...scores, [firmId]: { ...scores[firmId], [criterionId]: value } };
    setScores(next);
    void patchState({ scores: next });
  }

  function changeNotes(value: string) {
    setNotes(value);
    setSaveState("Saving...");
    window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(() => {
      void patchState({ notes: value });
    }, 700);
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
    <div className={tab === "colleges" ? "wrap wide" : "wrap"}>
      <header className="mast">
        <div className="mast-brand">
          <div className="lockup">
            <Image src="/logo.png" alt="" width={62} height={46} className="site-logo" priority />
            <p className="lockup-name">The Track</p>
          </div>
          <p className="dateline">Junior year · Columbia High School, Maplewood, NJ</p>
          <h1>Kyle&apos;s College Search</h1>
        </div>
        <div className="mast-actions">
          <ThemeToggle />
          <p className="phase-datum">{pill}</p>
        </div>
      </header>
      <TabNav
        tab={tab}
        onChange={(next) => {
          setTab(next);
          replaceUrl(next, next === "colleges" ? schoolId : null);
        }}
      />
      {tab === "colleges" ? (
        <CollegesTab
          schools={schools}
          selectedId={schoolId}
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
      {tab === "timeline" ? <TimelineTab phases={phases} checklist={checklist} onToggle={toggleItem} /> : null}
      {tab === "faq" ? <FaqTab categories={faqCategories} /> : null}
      {tab === "questions" ? (
        <AppQuestionsTab
          core={appCore}
          prompts={essayPromptList}
          writing={writingBlocks}
          demographics={demographicBlocks}
          supplements={supplementCards}
        />
      ) : null}
      {tab === "consultants" ? (
        <ConsultantsTab
          firms={consultantFirms}
          criteria={consultantCriteria}
          questions={consultantQuestions}
          scores={scores}
          onScore={changeScore}
        />
      ) : null}
      {tab === "notes" ? <NotesTab notes={notes} saveState={saveState} onChange={changeNotes} /> : null}
      <div className="save-state">{loaded && pipeline.loaded ? saveState : "Loading..."}</div>
      <footer>
        Built for Kyle&apos;s college search · last opened <span className="mono">{todayLabel()}</span>
      </footer>
    </div>
  );
}
