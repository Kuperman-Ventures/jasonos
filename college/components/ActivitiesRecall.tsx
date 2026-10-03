"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GradeStrip } from "./GradeStrip";
import { RecallAnswerCard, type RecallAnswerState } from "./RecallAnswerCard";
import {
  activityFromRecall,
  applyRecallSpan,
  currentGrade,
  currentSchoolYearEnd,
  recallSpanText,
  removeActivity,
  upsertActivity,
  type ActivitiesJournal as Journal,
  type ActivityCategoryId,
} from "@/lib/activities-journal";

type RecallQuestion = {
  question: string;
  helper: string;
  defaultCategory: ActivityCategoryId | "";
};

export const RECALL_QUESTIONS: RecallQuestion[] = [
  {
    question: "What do you do most weeks after school or on weekends?",
    helper: "Practices, rehearsals, club meetings, lessons, games.",
    defaultCategory: "",
  },
  {
    question: "What have you been doing the longest - since middle school or earlier?",
    helper: "An instrument, a sport, a club, a skill you started young.",
    defaultCategory: "",
  },
  {
    question: "What shows up on your calendar every year?",
    helper: "Concerts, competitions, tournaments, meets, shows, tests for a new rank or level.",
    defaultCategory: "",
  },
  {
    question: "What do you build, make, play or practice on your own, without anyone asking you to?",
    helper: "Things you do in your free time because you want to.",
    defaultCategory: "hobby-personal-pursuit",
  },
  {
    question: "What did you do last summer? The summer before that?",
    helper: "Camps, jobs, programs, trips with a purpose, projects.",
    defaultCategory: "",
  },
  {
    question: "Have you had a job, paid or unpaid, or regular responsibilities at home?",
    helper: "Part-time work, babysitting, helping run a family business, caring for a sibling.",
    defaultCategory: "paid-work",
  },
  {
    question: "Have you helped out in your community?",
    helper: "Volunteering, a faith group, a neighborhood or school event.",
    defaultCategory: "volunteering-community-service",
  },
  {
    question: "What classes, programs or courses have you taken outside your regular school day?",
    helper: "Online courses, summer programs, weekend classes, certifications.",
    defaultCategory: "academic-enrichment",
  },
  {
    question: "What do friends, family or teachers ask you to help with?",
    helper: "It's fine if this repeats something you already listed.",
    defaultCategory: "",
  },
];

type SessionRow = RecallAnswerState & {
  id: string;
  question: number;
};

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function yearButtons(now = new Date()): number[] {
  const start = currentSchoolYearEnd(now);
  return [start, start + 1, start + 2, start + 3];
}

function standingLabel(grade: number | null): string {
  if (grade === 9) return "freshman";
  if (grade === 10) return "sophomore";
  if (grade === 11) return "junior";
  if (grade === 12) return "senior";
  if (grade != null) return `${grade}th grader`;
  return "";
}

function spanComplete(row: RecallAnswerState): boolean {
  if (row.since == null) return false;
  if (row.stillDoing) return true;
  return row.until != null;
}

export function ActivitiesRecall({
  journal,
  onChange,
  onDone,
  onExit,
}: {
  journal: Journal;
  onChange: (next: Journal) => void;
  onDone: (ids: string[]) => void;
  onExit: (ids: string[]) => void;
}) {
  const showedYear = useMemo(() => !journal.profile?.classOf, []);
  const [step, setStep] = useState(showedYear ? 0 : 1);
  const [classOf, setClassOf] = useState<number | null>(journal.profile?.classOf ?? null);
  const [session, setSession] = useState<SessionRow[]>([]);
  const [draft, setDraft] = useState("");
  const [dupName, setDupName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const journalRef = useRef(journal);

  const questionIndex = step >= 1 && step <= 9 ? step - 1 : -1;
  const question = questionIndex >= 0 ? RECALL_QUESTIONS[questionIndex] : null;
  const years = useMemo(() => yearButtons(), []);
  const year = journal.profile?.classOf ?? classOf;
  const gradeNow = currentGrade(year ?? undefined);
  const sessionIds = session.map((row) => row.id);

  useEffect(() => {
    journalRef.current = journal;
  }, [journal]);

  useEffect(() => {
    if (step >= 1 && step <= 9) inputRef.current?.focus();
  }, [step]);

  function commit(next: Journal) {
    journalRef.current = next;
    onChange(next);
  }

  function patchRow(id: string, patch: Partial<SessionRow>) {
    setSession((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function saveSpan(row: SessionRow, next: RecallAnswerState) {
    if (year == null || !spanComplete(next)) return;
    commit(
      applyRecallSpan(journalRef.current, row.id, year, {
        sinceGrade: next.since ?? undefined,
        untilGrade: next.until ?? undefined,
        stillDoing: next.stillDoing,
      }),
    );
  }

  function addDraft(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const name = draft.trim();
    if (!name || !question || year == null) return;
    if (journalRef.current.activities.some((a) => !a.archived && namesMatch(a.name, name))) {
      setDupName(name);
      setDraft("");
      return;
    }
    const activity = activityFromRecall(
      {
        name,
        category: question.defaultCategory || "other",
        stillDoing: true,
      },
      year,
    );
    commit(upsertActivity(journalRef.current, activity));
    setSession((rows) => [
      ...rows.map((row) => ({ ...row, editing: false })),
      {
        id: activity.id,
        question: step,
        editing: true,
        pickMode: "start",
        since: null,
        until: null,
        stillDoing: true,
      },
    ]);
    setDraft("");
    setDupName("");
  }

  function removeRow(id: string) {
    commit(removeActivity(journalRef.current, id));
    setSession((rows) => rows.filter((row) => row.id !== id));
  }

  function pickGrade(row: SessionRow, g: number) {
    let next: RecallAnswerState = row;
    if (!row.stillDoing && row.pickMode === "end" && row.since != null) {
      next = g >= row.since ? { ...row, until: g, editing: false } : { ...row, since: g };
    } else if (row.stillDoing) {
      next = { ...row, since: g, until: null, editing: false };
    } else {
      next = { ...row, since: g, pickMode: "end" };
    }
    patchRow(row.id, next);
    saveSpan(row, next);
  }

  function goNext() {
    setDraft("");
    setDupName("");
    setSession((rows) => rows.map((row) => ({ ...row, editing: false })));
    if (step === 9) {
      onDone(sessionIds);
      return;
    }
    setStep((n) => n + 1);
  }

  function goBack() {
    setDraft("");
    setDupName("");
    if (step <= 1) {
      if (showedYear) setStep(0);
      else onExit(sessionIds);
      return;
    }
    setStep((n) => n - 1);
  }

  function startQuestions() {
    if (classOf == null) return;
    commit({ ...journalRef.current, profile: { ...journalRef.current.profile, classOf } });
    setStep(1);
  }

  const rowsThisQuestion = session.filter((row) => row.question === step);
  const standing = standingLabel(gradeNow);

  const backLink =
    step === 0 || step === 1 ? (
      <button
        type="button"
        className="aj-text-btn"
        onClick={step === 0 || !showedYear ? () => onExit(sessionIds) : goBack}
      >
        {step === 1 && showedYear ? "← Back" : "← Back to My Record"}
      </button>
    ) : (
      <button type="button" className="aj-text-btn" onClick={goBack}>
        ← Previous question
      </button>
    );

  const counter =
    step >= 1 && step <= 9 ? <span className="aj-recall-count">Question {step} of 9</span> : <span />;

  function tray() {
    return (
      <aside className="aj-recall-tray" aria-label="Your list so far">
        <h2>
          <span>Your list so far</span>
          <span>{session.length}</span>
        </h2>
        {session.length ? (
          <ul>
            {session.map((row) => {
              const activity = journal.activities.find((a) => a.id === row.id);
              const name = activity?.name ?? "Activity";
              return (
                <li key={row.id}>
                  <span className="aj-recall-tray-name">{name}</span>
                  <GradeStrip
                    since={row.since}
                    until={row.until}
                    stillDoing={row.stillDoing}
                    currentGrade={gradeNow}
                    size="mini"
                    label={name}
                  />
                  <span className="aj-recall-tray-meta">
                    {row.since == null || gradeNow == null
                      ? "Start grade not set yet"
                      : recallSpanText(row.since, row.until, row.stillDoing, gradeNow)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="aj-recall-tray-empty">Everything you add shows up here.</p>
        )}
      </aside>
    );
  }

  if (step === 0) {
    return (
      <section className="aj-recall">
        <div className="aj-recall-bar">
          {backLink}
          <span />
        </div>
        <div className="aj-recall-grid is-single">
          <div className="aj-recall-main">
            <h3 className="aj-recall-q">Start Your Activities List</h3>
            <p className="aj-recall-lede">
              You&apos;ll answer nine short questions about what you do. A few words per answer is
              enough. You can add details like your role and hours later.
            </p>
            <ol className="aj-recall-how">
              <li>Type anything that comes to mind. Small things count.</li>
              <li>Tap the grade you started. That&apos;s the only detail we ask for now.</li>
              <li>Each answer is saved as you go. At the end you&apos;ll land on My Record.</li>
            </ol>
            <p className="aj-recall-year-q" id="aj-recall-year-q">
              What year do you graduate from high school?
            </p>
            <div className="aj-recall-years" role="group" aria-labelledby="aj-recall-year-q">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  aria-pressed={classOf === y}
                  onClick={() => setClassOf(y)}
                >
                  {y}
                </button>
              ))}
            </div>
            {classOf && standing ? (
              <p className="aj-recall-year-note">That makes you a {standing} this year.</p>
            ) : (
              <p className="aj-recall-year-note" />
            )}
            <div className="aj-recall-foot">
              <button
                type="button"
                className="btn btn-primary"
                disabled={classOf == null}
                onClick={startQuestions}
              >
                Start with question 1
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="aj-recall">
      <div className="aj-recall-bar">
        {backLink}
        {counter}
      </div>
      <div className="aj-recall-grid">
        <div className="aj-recall-main">
          <h3 className="aj-recall-q">{question?.question}</h3>
          <p className="aj-recall-help">
            <em>For example:</em> {question?.helper}
          </p>
          <form className="aj-recall-capture" onSubmit={addDraft}>
            <label htmlFor="aj-recall-input" className="sr-only">
              Your answer
            </label>
            <input
              id="aj-recall-input"
              ref={inputRef}
              autoComplete="off"
              placeholder="Type one thing, then press Enter"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="aj-recall-add" disabled={!draft.trim()}>
              Add
            </button>
          </form>
          <p className="aj-recall-dup" aria-live="polite">
            {dupName ? `${dupName} is already in My Record.` : ""}
          </p>
          <ul className="aj-recall-items">
            {rowsThisQuestion.map((row) => {
              const activity = journal.activities.find((a) => a.id === row.id);
              const name = activity?.name ?? "Activity";
              return (
                <RecallAnswerCard
                  key={row.id}
                  name={name}
                  state={row}
                  currentGrade={gradeNow}
                  onRemove={() => removeRow(row.id)}
                  onPick={(g) => pickGrade(row, g)}
                  onStill={() => {
                    const next: RecallAnswerState = {
                      ...row,
                      stillDoing: true,
                      until: null,
                      pickMode: "start",
                    };
                    patchRow(row.id, next);
                    saveSpan(row, next);
                  }}
                  onStopped={() => {
                    const next: RecallAnswerState = {
                      ...row,
                      stillDoing: false,
                      pickMode: row.since == null ? "start" : "end",
                      editing: true,
                    };
                    patchRow(row.id, next);
                    saveSpan(row, next);
                  }}
                  onDone={() => patchRow(row.id, { editing: false })}
                  onChangeClick={() =>
                    patchRow(row.id, {
                      editing: true,
                      pickMode: row.stillDoing ? "start" : "end",
                    })
                  }
                />
              );
            })}
          </ul>
          <div className="aj-recall-foot">
            <button type="button" className="btn btn-primary" onClick={goNext}>
              {step === 9 ? "See my record" : "Next question"}
            </button>
            {rowsThisQuestion.length ? null : (
              <button type="button" className="aj-text-btn" onClick={goNext}>
                Nothing for this one
              </button>
            )}
          </div>
        </div>
        {tray()}
      </div>
    </section>
  );
}
