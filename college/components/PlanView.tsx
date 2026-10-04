"use client";

import { useEffect, useRef, useState } from "react";
import { GradeStrip } from "./GradeStrip";
import { SelfStartedProjectPlanner } from "./SelfStartedProjectPlanner";
import {
  PARTNER_STATUS_LABEL,
  THREAD_PLAN_QUESTIONS,
  addPeriod,
  answeredPlanCount,
  currentGrade,
  gradeCells,
  isSelfStartedProject,
  overdueMilestones,
  plannedStepsForThread,
  recordSchoolYears,
  removePeriod,
  resolveClassOf,
  schoolYearForGrade,
  setThreadPlan,
  sortRecordActivities,
  upsertActivity,
  type ActivitiesJournal as Journal,
  type Activity,
  type ActivityThread,
  type GradeLevel,
  type PeriodKind,
  type ThreadPlan,
  type ThreadPlanKey,
} from "@/lib/activities-journal";

type StepDraft = {
  questionKey: ThreadPlanKey;
  activityId: string;
  grade: number;
  periodKind: PeriodKind;
  text: string;
};

function gradeHeader(gradeNow: number | null) {
  return (
    <div className="rec-cols plan-colhead" aria-hidden="true">
      <span />
      <div className="rec-gradehead">
        <span className="rec-grade-grp rec-ms">Middle school</span>
        <span className="rec-grade-grp rec-hs">High school</span>
        {[6, 7, 8, 9, 10, 11, 12].map((g, i) => (
          <span
            key={g}
            className={g === gradeNow ? "rec-g is-now" : "rec-g"}
            style={{ gridColumn: i < 3 ? i + 1 : i + 2 }}
          >
            {g === gradeNow ? `${g} now` : g}
          </span>
        ))}
      </div>
      <span />
    </div>
  );
}

function formatMonthChip(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return "Target month";
  const [y, m] = value.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function PlanView({
  journal,
  canEdit,
  loaded = true,
  onChange,
  onOpenActivity,
  onGoToMyRecord,
}: {
  journal: Journal;
  canEdit: boolean;
  loaded?: boolean;
  onChange: (next: Journal) => void;
  onOpenActivity: (id: string, tab?: "updates") => void;
  onGoToMyRecord: () => void;
}) {
  const journalRef = useRef(journal);
  useEffect(() => {
    journalRef.current = journal;
  }, [journal]);

  const threads = journal.threads ?? [];
  const [openThreadId, setOpenThreadId] = useState<string | null>(threads[0]?.id ?? null);
  const [openQuestion, setOpenQuestion] = useState<ThreadPlanKey>("deeper");
  const [stepDraft, setStepDraft] = useState<StepDraft | null>(null);
  const [planning, setPlanning] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!openThreadId && threads[0]) setOpenThreadId(threads[0].id);
    if (openThreadId && !threads.some((t) => t.id === openThreadId)) {
      setOpenThreadId(threads[0]?.id ?? null);
    }
  }, [threads, openThreadId]);

  const classOf = resolveClassOf(journal.profile?.classOf);
  const gradeNow = currentGrade(classOf);
  const projects = journal.activities.filter((a) => !a.archived && isSelfStartedProject(a));
  const overdueIds = new Set(
    projects.flatMap((p) => (p.project ? overdueMilestones(p.project).map((m) => m.id) : [])),
  );

  function commit(next: Journal) {
    journalRef.current = next;
    onChange(next);
  }

  function savePlanAnswer(thread: ActivityThread, key: ThreadPlanKey, value: string) {
    if (!canEdit || !loaded) return;
    const plan: ThreadPlan = { ...(thread.plan ?? {}), [key]: value };
    commit(setThreadPlan(journalRef.current, thread.id, plan));
  }

  function openAddStep(thread: ActivityThread, key: ThreadPlanKey) {
    const activities = sortRecordActivities(
      journal.activities.filter((a) => !a.archived && a.threadId === thread.id),
    );
    const first = activities[0];
    if (!first) return;
    const nextGrade = gradeNow != null ? Math.min(12, gradeNow + 1) : 12;
    const answer = (thread.plan?.[key] ?? "").trim();
    setStepDraft({
      questionKey: key,
      activityId: first.id,
      grade: nextGrade,
      periodKind: "school_year",
      text: answer,
    });
  }

  function addPlannedStep() {
    if (!canEdit || !loaded || !stepDraft) return;
    const grade = String(stepDraft.grade) as GradeLevel;
    commit(
      addPeriod(journalRef.current, stepDraft.activityId, {
        schoolYear: schoolYearForGrade(classOf, stepDraft.grade),
        grade,
        periodKind: stepDraft.periodKind,
        status: "planned",
        responsibilities: stepDraft.text.trim(),
      }),
    );
    setStepDraft(null);
  }

  function renderActivityRow(activity: Activity) {
    const cells = gradeCells(activity);
    const years = recordSchoolYears(activity);
    return (
      <div key={activity.id} className="rec-row rec-cols plan-row">
        <div className="rec-name">
          <span className="plan-act-name">{activity.name}</span>
        </div>
        <GradeStrip
          size="row"
          currentGrade={gradeNow}
          cells={cells}
          label={activity.name}
        />
        <span className="rec-years">
          {years ? `${years} ${years === 1 ? "yr" : "yrs"}` : ""}
        </span>
      </div>
    );
  }

  function renderThreadBlock(thread: ActivityThread) {
    const open = thread.id === openThreadId;
    const activities = sortRecordActivities(
      journal.activities.filter((a) => !a.archived && a.threadId === thread.id),
    );
    const answered = answeredPlanCount(thread.plan);
    const steps = plannedStepsForThread(journal, thread.id);

    if (!open) {
      return (
        <div key={thread.id} className="plan-thread">
          <div className="plan-thread-h">
            <h4>{thread.name}</h4>
            <span className="plan-meta">{answered} of 5 answered</span>
          </div>
          <p className="plan-intro">
            <button
              type="button"
              className="aj-text-btn strong"
              onClick={() => {
                setOpenThreadId(thread.id);
                setOpenQuestion("deeper");
                setStepDraft(null);
              }}
            >
              Open this thread&apos;s questions
            </button>
          </p>
        </div>
      );
    }

    const futureGrades =
      gradeNow != null
        ? Array.from({ length: Math.max(0, 12 - gradeNow) }, (_, i) => gradeNow + 1 + i)
        : [10, 11, 12];

    return (
      <div key={thread.id} className="plan-thread is-open">
        <div className="plan-thread-h">
          <h4>{thread.name}</h4>
          <span className="plan-meta">{answered} of 5 answered</span>
        </div>
        {activities.length ? (
          <>
            {gradeHeader(gradeNow)}
            {activities.map(renderActivityRow)}
          </>
        ) : (
          <p className="plan-intro">No activities in this thread yet.</p>
        )}

        <ul className="plan-qs">
          {THREAD_PLAN_QUESTIONS.map((q) => {
            const value = thread.plan?.[q.key] ?? "";
            const hasAnswer = value.trim().length > 0;
            const isOpen = openQuestion === q.key;
            if (!isOpen) {
              return (
                <li key={q.key} className="plan-q is-closed">
                  <button
                    type="button"
                    className="plan-q-row"
                    onClick={() => {
                      setOpenQuestion(q.key);
                      setStepDraft(null);
                    }}
                  >
                    <span>
                      <span className="plan-q-k">{q.label}</span>{" "}
                      <span className="plan-q-t">{q.question}</span>
                    </span>
                    <span className="aj-text-btn">{hasAnswer ? "Answered" : "Answer"}</span>
                  </button>
                </li>
              );
            }
            return (
              <li key={q.key} className="plan-q is-open">
                <div className="plan-q-top">
                  <span className="plan-q-k">{q.label}</span>
                  {canEdit ? <span className="plan-save-hint">Saves as you type</span> : null}
                </div>
                <p className="plan-q-t">{q.question}</p>
                <p className="plan-q-help">For example: {q.helper}</p>
                <textarea
                  rows={2}
                  placeholder="Your answer"
                  value={value}
                  disabled={!canEdit || !loaded}
                  onChange={(e) => savePlanAnswer(thread, q.key, e.target.value)}
                  onBlur={(e) => savePlanAnswer(thread, q.key, e.target.value)}
                />
                {canEdit && hasAnswer && activities.length ? (
                  stepDraft?.questionKey === q.key ? (
                    <div className="plan-step-form">
                      <div className="plan-pills" role="group" aria-label="Activity">
                        {activities.map((activity) => (
                          <button
                            key={activity.id}
                            type="button"
                            aria-pressed={stepDraft.activityId === activity.id}
                            onClick={() =>
                              setStepDraft({ ...stepDraft, activityId: activity.id })
                            }
                          >
                            {activity.name}
                          </button>
                        ))}
                      </div>
                      <div className="plan-pills" role="group" aria-label="Grade">
                        {futureGrades.map((g) => (
                          <button
                            key={g}
                            type="button"
                            aria-pressed={stepDraft.grade === g}
                            onClick={() => setStepDraft({ ...stepDraft, grade: g })}
                          >
                            {g}th
                          </button>
                        ))}
                      </div>
                      <div className="plan-pills" role="group" aria-label="When">
                        {(
                          [
                            ["school_year", "School year"],
                            ["summer", "Summer"],
                            ["all_year", "All year"],
                          ] as const
                        ).map(([kind, label]) => (
                          <button
                            key={kind}
                            type="button"
                            aria-pressed={stepDraft.periodKind === kind}
                            onClick={() =>
                              setStepDraft({ ...stepDraft, periodKind: kind })
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={2}
                        value={stepDraft.text}
                        onChange={(e) =>
                          setStepDraft({ ...stepDraft, text: e.target.value })
                        }
                      />
                      <div className="plan-step-actions">
                        <button
                          type="button"
                          className="aj-recall-add"
                          disabled={!stepDraft.text.trim()}
                          onClick={addPlannedStep}
                        >
                          Add step
                        </button>
                        <button
                          type="button"
                          className="aj-text-btn"
                          onClick={() => setStepDraft(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="plan-stepnote">
                      <button
                        type="button"
                        className="aj-text-btn strong"
                        onClick={() => openAddStep(thread, q.key)}
                      >
                        Add as a planned step
                      </button>
                    </div>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>

        {steps.length ? (
          <ul className="plan-planned">
            {steps.map((step) => {
              const gradeNum =
                step.grade === "post" || step.grade === "other" ? null : Number(step.grade);
              return (
                <li key={`${step.activityId}-${step.periodId}`}>
                  <span className="plan-hatch" aria-hidden="true" />
                  <span>
                    <strong>{step.activityName}</strong>
                    {gradeNum != null ? ` · ${gradeNum}th grade` : ""}
                    {step.text ? ` · ${step.text}` : ""}
                  </span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="aj-text-btn"
                      onClick={() =>
                        commit(
                          removePeriod(
                            journalRef.current,
                            step.activityId,
                            step.periodId,
                          ),
                        )
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }

  function renderSavedProject(activity: Activity) {
    const project = activity.project ?? { partners: [], milestones: [] };
    const buildsOn = (project.buildsOnActivityIds ?? [])
      .map((id) => journal.activities.find((a) => a.id === id)?.name)
      .filter(Boolean) as string[];
    const nowKey = currentMonthKey();

    return (
      <section key={activity.id} className="plan-saved">
        <div className="plan-sec-h">
          <h3>{activity.name}</h3>
          <span className="plan-meta">
            {canEdit ? (
              <>
                <button
                  type="button"
                  className="aj-text-btn"
                  onClick={() => {
                    setEditProjectId(activity.id);
                    setPlanning(true);
                  }}
                >
                  Edit answers
                </button>
                {" · "}
              </>
            ) : null}
            <button
              type="button"
              className="aj-text-btn"
              onClick={() => onOpenActivity(activity.id)}
            >
              Open in My Record
            </button>
          </span>
        </div>
        <p className="plan-intro">
          {buildsOn.length ? `Builds on ${buildsOn.join(", ")}. ` : null}
          {project.partners.map((partner, i) => (
            <span key={partner.id}>
              {i === 0 ? "Partner: " : " Partner: "}
              {partner.organization}, {PARTNER_STATUS_LABEL[partner.status].toLowerCase()}.
            </span>
          ))}
          {!buildsOn.length && !project.partners.length
            ? "Add partners and what this builds on when you edit answers."
            : null}
        </p>
        {project.milestones.length ? (
          <ul className="plan-ms" aria-label="Milestones">
            {project.milestones.map((milestone) => {
              const late =
                !milestone.done &&
                milestone.targetMonth != null &&
                milestone.targetMonth < nowKey;
              return (
                <li key={milestone.id}>
                  <button
                    type="button"
                    className={milestone.done ? "plan-chk is-on" : "plan-chk"}
                    aria-pressed={milestone.done}
                    disabled={!canEdit || !loaded}
                    onClick={() => {
                      if (!canEdit || !loaded) return;
                      const nextMilestones = project.milestones.map((m) =>
                        m.id === milestone.id
                          ? {
                              ...m,
                              done: !m.done,
                              doneDate: !m.done
                                ? new Date().toISOString().slice(0, 10)
                                : undefined,
                            }
                          : m,
                      );
                      commit(
                        upsertActivity(journalRef.current, {
                          ...activity,
                          project: { ...project, milestones: nextMilestones },
                        }),
                      );
                    }}
                    aria-label={milestone.done ? "Mark not done" : "Mark done"}
                  />
                  <span>
                    {milestone.label}
                    {late ? (
                      <span className="plan-late"> Past target month</span>
                    ) : null}
                    {milestone.done && canEdit ? (
                      <button
                        type="button"
                        className="aj-text-btn strong plan-log-moment"
                        onClick={() => onOpenActivity(activity.id, "updates")}
                      >
                        Log a moment
                      </button>
                    ) : null}
                  </span>
                  <label className={late || overdueIds.has(milestone.id) ? "plan-chip is-late" : "plan-chip"}>
                    <span>{formatMonthChip(milestone.targetMonth)}</span>
                    {canEdit ? (
                      <input
                        type="month"
                        value={milestone.targetMonth ?? ""}
                        onChange={(e) => {
                          const nextMilestones = project.milestones.map((m) =>
                            m.id === milestone.id
                              ? { ...m, targetMonth: e.target.value || undefined }
                              : m,
                          );
                          commit(
                            upsertActivity(journalRef.current, {
                              ...activity,
                              project: { ...project, milestones: nextMilestones },
                            }),
                          );
                        }}
                      />
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
        <p className="plan-intro plan-ms-note">
          Tap a month to change it. Checking a step off lets you log a moment about it.
        </p>
      </section>
    );
  }

  if (planning) {
    return (
      <div className="aj-view plan">
        <header className="plan-head">
          <h3 className="plan-title">Plan</h3>
        </header>
        <SelfStartedProjectPlanner
          journal={journal}
          canEdit={canEdit && loaded}
          activityId={editProjectId}
          onChange={onChange}
          onBack={() => {
            setPlanning(false);
            setEditProjectId(null);
          }}
          onSaved={() => {
            setPlanning(false);
            setEditProjectId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="aj-view plan">
      <header className="plan-head">
        <div>
          <h3 className="plan-title">Plan</h3>
          <p className="plan-sum">
            What you plan to do between now and graduation. Your threads come first, because
            sticking with things is what colleges notice most.
          </p>
        </div>
      </header>

      <div className="plan-sec-h">
        <h3>Your Threads</h3>
        <span className="plan-meta">
          {threads.length} {threads.length === 1 ? "thread" : "threads"}
        </span>
      </div>
      {threads.length === 0 ? (
        <p className="plan-intro">
          Group your activities into threads first.{" "}
          <button type="button" className="aj-text-btn strong" onClick={onGoToMyRecord}>
            Go to My Record
          </button>
        </p>
      ) : (
        threads.map(renderThreadBlock)
      )}

      <div className="plan-sec-h">
        <h3>Self-Started Project</h3>
      </div>
      <p className="plan-intro">
        Something you organize and create yourself, from an idea to a finished result. It usually
        needs help or permission from someone outside your school. It sits alongside your
        long-term activities and does not replace them.
      </p>

      {projects.map(renderSavedProject)}

      {canEdit && loaded ? (
        <p className="plan-project-cta">
          <button
            type="button"
            className="aj-recall-add"
            onClick={() => {
              setEditProjectId(null);
              setPlanning(true);
            }}
          >
            {projects.length ? "Plan another project" : "Plan a project"}
          </button>
        </p>
      ) : null}
    </div>
  );
}
