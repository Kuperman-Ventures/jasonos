"use client";

import { useEffect, useRef, useState } from "react";
import {
  PARTNER_STATUS_LABEL,
  PARTNER_STATUSES,
  createActivity,
  defaultProjectMilestones,
  emptySelfStartedProject,
  isSelfStartedProject,
  newId,
  upsertActivity,
  type ActivitiesJournal as Journal,
  type PartnerStatus,
  type ProjectMilestone,
  type ProjectPartner,
  type SelfStartedProject,
} from "@/lib/activities-journal";

const PROJECT_QUESTIONS = [
  {
    label: "Name",
    question: "What's a working title?",
    helper: "A working title is fine. You can change it later.",
  },
  {
    label: "Need",
    question: "What problem or need are you addressing?",
    helper:
      "Something you noticed that isn't working, is missing, or could be better - at school, in your town, or for a group you belong to.",
  },
  {
    label: "Who benefits",
    question: "Who or what benefits?",
    helper: "A group of people, a place, an organization, or the environment.",
  },
  {
    label: "Builds on",
    question: "Which of your activities does it build on?",
    helper:
      "Projects that use skills from your long-term activities are easier to explain in your application.",
  },
  {
    label: "Partners",
    question: "Who has to say yes?",
    helper: "A town office, a school department, a local nonprofit, a business.",
  },
  {
    label: "Deliverable",
    question: "What will you make or deliver?",
    helper: "The finished thing someone can see, use or visit.",
  },
  {
    label: "Milestones",
    question: "What are the steps, and when?",
    helper: "Steps that need someone else's approval usually take longer than you expect.",
  },
  {
    label: "Evidence",
    question: "How will you show it worked?",
    helper:
      "Photos, measurements or data, a letter from a partner, a news story, people who used it.",
  },
  {
    label: "After you graduate",
    question: "What happens after you graduate?",
    helper: "Who keeps it going, maintains it, or takes it over.",
  },
] as const;

type PlannerState = {
  activityId: string | null;
  name: string;
  project: SelfStartedProject;
};

function blankState(): PlannerState {
  return {
    activityId: null,
    name: "",
    project: emptySelfStartedProject(),
  };
}

function stateFromActivity(
  activityId: string,
  name: string,
  project: SelfStartedProject | undefined,
): PlannerState {
  return {
    activityId,
    name,
    project: project ? { ...project, partners: [...project.partners], milestones: [...project.milestones] } : emptySelfStartedProject(),
  };
}

function monthLabel(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return "Target month";
  const [y, m] = value.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

export function SelfStartedProjectPlanner({
  journal,
  canEdit,
  activityId,
  startAtQuestion = 0,
  onChange,
  onBack,
  onSaved,
}: {
  journal: Journal;
  canEdit: boolean;
  activityId?: string | null;
  startAtQuestion?: number;
  onChange: (next: Journal) => void;
  onBack: () => void;
  onSaved: (activityId: string) => void;
}) {
  const journalRef = useRef(journal);
  useEffect(() => {
    journalRef.current = journal;
  }, [journal]);

  const existing = activityId
    ? journal.activities.find((a) => a.id === activityId && isSelfStartedProject(a))
    : null;

  const [step, setStep] = useState(Math.max(0, Math.min(PROJECT_QUESTIONS.length - 1, startAtQuestion)));
  const [state, setState] = useState<PlannerState>(() =>
    existing
      ? stateFromActivity(existing.id, existing.name, existing.project)
      : blankState(),
  );
  const [partnerDraft, setPartnerDraft] = useState("");
  const [contactEditId, setContactEditId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const seededMilestones = useRef(false);

  useEffect(() => {
    if (step !== 6 || seededMilestones.current) return;
    if (state.project.milestones.length > 0) {
      seededMilestones.current = true;
      return;
    }
    seededMilestones.current = true;
    setState((prev) => ({
      ...prev,
      project: { ...prev.project, milestones: defaultProjectMilestones() },
    }));
  }, [step, state.project.milestones.length]);

  const buildables = journal.activities.filter(
    (a) => !a.archived && !isSelfStartedProject(a) && a.id !== state.activityId,
  );

  function patchProject(patch: Partial<SelfStartedProject>) {
    setState((prev) => ({ ...prev, project: { ...prev.project, ...patch } }));
  }

  function persist(next: PlannerState, journalBase = journalRef.current): Journal {
    if (!canEdit) return journalBase;
    const name = next.name.trim();
    if (!name) return journalBase;
    let activity =
      next.activityId != null
        ? journalBase.activities.find((a) => a.id === next.activityId)
        : undefined;
    if (!activity) {
      activity = createActivity({
        name,
        category: "independent-project-business",
        ongoing: true,
        project: emptySelfStartedProject(),
      });
    }
    const updated = {
      ...activity,
      name,
      category: "independent-project-business" as const,
      ongoing: true,
      project: next.project,
    };
    const journalNext = upsertActivity(journalBase, updated);
    journalRef.current = journalNext;
    onChange(journalNext);
    if (!next.activityId) {
      setState((prev) => ({ ...prev, activityId: updated.id }));
    }
    return journalNext;
  }

  function goNext() {
    if (!canEdit) return;
    const nextState = { ...state };
    if (step === 0 && !nextState.name.trim()) return;
    const journalNext = persist(nextState);
    if (step >= PROJECT_QUESTIONS.length - 1) {
      const id =
        nextState.activityId ??
        journalNext.activities.find(
          (a) => isSelfStartedProject(a) && a.name === nextState.name.trim(),
        )?.id;
      if (id) onSaved(id);
      return;
    }
    setStep((s) => s + 1);
  }

  function goPrev() {
    setStep((s) => Math.max(0, s - 1));
  }

  function skip() {
    if (step >= PROJECT_QUESTIONS.length - 1) {
      goNext();
      return;
    }
    if (state.activityId || state.name.trim()) persist(state);
    setStep((s) => s + 1);
  }

  function addPartner() {
    const organization = partnerDraft.trim();
    if (!organization) return;
    const partner: ProjectPartner = {
      id: newId("partner"),
      organization,
      status: "not_contacted",
    };
    patchProject({ partners: [...state.project.partners, partner] });
    setPartnerDraft("");
  }

  function updatePartner(id: string, patch: Partial<ProjectPartner>) {
    patchProject({
      partners: state.project.partners.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  function removePartner(id: string) {
    patchProject({ partners: state.project.partners.filter((p) => p.id !== id) });
  }

  function updateMilestone(id: string, patch: Partial<ProjectMilestone>) {
    patchProject({
      milestones: state.project.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  }

  function moveMilestone(id: string, direction: -1 | 1) {
    const list = [...state.project.milestones];
    const idx = list.findIndex((m) => m.id === id);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    const tmp = list[idx]!;
    list[idx] = list[swap]!;
    list[swap] = tmp;
    patchProject({ milestones: list });
  }

  function removeMilestone(id: string) {
    patchProject({ milestones: state.project.milestones.filter((m) => m.id !== id) });
  }

  function addMilestone() {
    patchProject({
      milestones: [
        ...state.project.milestones,
        { id: newId("milestone"), label: "New step", done: false },
      ],
    });
  }

  const q = PROJECT_QUESTIONS[step]!;
  const isLast = step === PROJECT_QUESTIONS.length - 1;

  let body: React.ReactNode = null;
  if (step === 0) {
    body = (
      <input
        className="plan-p-in"
        value={state.name}
        placeholder="Your answer"
        disabled={!canEdit}
        onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
      />
    );
  } else if (step === 1) {
    body = (
      <textarea
        className="plan-p-in"
        rows={3}
        value={state.project.need ?? ""}
        placeholder="Your answer"
        disabled={!canEdit}
        onChange={(e) => patchProject({ need: e.target.value })}
      />
    );
  } else if (step === 2) {
    body = (
      <textarea
        className="plan-p-in"
        rows={3}
        value={state.project.beneficiaries ?? ""}
        placeholder="Your answer"
        disabled={!canEdit}
        onChange={(e) => patchProject({ beneficiaries: e.target.value })}
      />
    );
  } else if (step === 3) {
    const selected = new Set(state.project.buildsOnActivityIds ?? []);
    body = (
      <>
        <div className="plan-pills">
          {buildables.map((activity) => {
            const on = selected.has(activity.id);
            return (
              <button
                key={activity.id}
                type="button"
                aria-pressed={on}
                disabled={!canEdit}
                onClick={() => {
                  const next = new Set(selected);
                  if (on) next.delete(activity.id);
                  else next.add(activity.id);
                  patchProject({ buildsOnActivityIds: [...next] });
                }}
              >
                {activity.name}
              </button>
            );
          })}
        </div>
        {canEdit && selected.size === 0 && buildables.length > 0 ? (
          <p className="plan-hint">Is there an activity this connects to?</p>
        ) : null}
      </>
    );
  } else if (step === 4) {
    body = (
      <>
        {canEdit ? (
          <input
            className="plan-p-in"
            value={partnerDraft}
            placeholder="Organization, then press Enter"
            onChange={(e) => setPartnerDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addPartner();
              }
            }}
          />
        ) : null}
        <ul className="plan-partners">
          {state.project.partners.map((partner) => {
            const editing = contactEditId === partner.id;
            const contactBits = [partner.contactName, partner.contactRole].filter(Boolean);
            return (
              <li key={partner.id} className="plan-partner">
                <strong>{partner.organization}</strong>
                {editing ? (
                  <form
                    className="plan-contact-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      updatePartner(partner.id, {
                        contactName: contactName.trim() || undefined,
                        contactRole: contactRole.trim() || undefined,
                      });
                      setContactEditId(null);
                    }}
                  >
                    <input
                      value={contactName}
                      placeholder="Contact name"
                      onChange={(e) => setContactName(e.target.value)}
                    />
                    <input
                      value={contactRole}
                      placeholder="Role"
                      onChange={(e) => setContactRole(e.target.value)}
                    />
                    <button type="submit" className="aj-text-btn strong">
                      Save
                    </button>
                    <button
                      type="button"
                      className="aj-text-btn"
                      onClick={() => setContactEditId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <span className="plan-partner-contact">
                    Contact: {contactBits.length ? contactBits.join(", ") : "not added"}
                    {canEdit ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="aj-text-btn"
                          onClick={() => {
                            setContactEditId(partner.id);
                            setContactName(partner.contactName ?? "");
                            setContactRole(partner.contactRole ?? "");
                          }}
                        >
                          Add contact
                        </button>
                      </>
                    ) : null}
                  </span>
                )}
                <div className="plan-pills">
                  {PARTNER_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={partner.status === status}
                      disabled={!canEdit}
                      onClick={() => updatePartner(partner.id, { status })}
                    >
                      {PARTNER_STATUS_LABEL[status as PartnerStatus]}
                    </button>
                  ))}
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    className="aj-text-btn"
                    onClick={() => removePartner(partner.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </>
    );
  } else if (step === 5) {
    body = (
      <textarea
        className="plan-p-in"
        rows={3}
        value={state.project.deliverable ?? ""}
        placeholder="Your answer"
        disabled={!canEdit}
        onChange={(e) => patchProject({ deliverable: e.target.value })}
      />
    );
  } else if (step === 6) {
    body = (
      <ul className="plan-ms-edit">
        {state.project.milestones.map((milestone, index) => (
          <li key={milestone.id}>
            <input
              className="plan-ms-label"
              value={milestone.label}
              disabled={!canEdit}
              onChange={(e) => updateMilestone(milestone.id, { label: e.target.value })}
            />
            <label className="plan-ms-month">
              <span>{monthLabel(milestone.targetMonth)}</span>
              <input
                type="month"
                value={milestone.targetMonth ?? ""}
                disabled={!canEdit}
                onChange={(e) =>
                  updateMilestone(milestone.id, {
                    targetMonth: e.target.value || undefined,
                  })
                }
              />
            </label>
            {canEdit ? (
              <span className="plan-ms-tools">
                <button
                  type="button"
                  className="aj-text-btn"
                  disabled={index === 0}
                  onClick={() => moveMilestone(milestone.id, -1)}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="aj-text-btn"
                  disabled={index === state.project.milestones.length - 1}
                  onClick={() => moveMilestone(milestone.id, 1)}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="aj-text-btn"
                  onClick={() => removeMilestone(milestone.id)}
                >
                  Remove
                </button>
              </span>
            ) : null}
          </li>
        ))}
        {canEdit ? (
          <li>
            <button type="button" className="aj-text-btn strong" onClick={addMilestone}>
              + Add a step
            </button>
          </li>
        ) : null}
      </ul>
    );
  } else if (step === 7) {
    body = (
      <textarea
        className="plan-p-in"
        rows={3}
        value={state.project.evidencePlan ?? ""}
        placeholder="Your answer"
        disabled={!canEdit}
        onChange={(e) => patchProject({ evidencePlan: e.target.value })}
      />
    );
  } else {
    body = (
      <textarea
        className="plan-p-in"
        rows={3}
        value={state.project.afterGraduation ?? ""}
        placeholder="Your answer"
        disabled={!canEdit}
        onChange={(e) => patchProject({ afterGraduation: e.target.value })}
      />
    );
  }

  return (
    <div className="plan-planner">
      <p className="plan-back">
        <button type="button" className="aj-text-btn" onClick={onBack}>
          ← Back to Plan
        </button>
      </p>
      <div className="plan-proj">
        <div>
          <span className="plan-p-step">
            Question {step + 1} of {PROJECT_QUESTIONS.length}
          </span>
          <h3 className="plan-p-q">{q.question}</h3>
          <p className="plan-p-help">
            <em>For example:</em> {q.helper}
          </p>
          {body}
          <div className="plan-p-foot">
            {canEdit ? (
              <button
                type="button"
                className="aj-recall-add"
                disabled={step === 0 && !state.name.trim()}
                onClick={goNext}
              >
                {isLast ? "Save project" : "Next question"}
              </button>
            ) : null}
            {step > 0 ? (
              <button type="button" className="aj-text-btn" onClick={goPrev}>
                Previous question
              </button>
            ) : null}
            {canEdit && !isLast ? (
              <button type="button" className="aj-text-btn" onClick={skip}>
                Skip for now
              </button>
            ) : null}
          </div>
        </div>
        <aside className="plan-side">
          <h5>Your project so far</h5>
          <ol>
            {PROJECT_QUESTIONS.map((item, i) => {
              const answered =
                i === 0
                  ? state.name.trim().length > 0
                  : i < step;
              const current = i === step;
              return (
                <li
                  key={item.label}
                  className={current ? "is-cur" : answered ? "is-done" : undefined}
                >
                  {item.label}
                  {answered && !current ? " - answered" : ""}
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}
