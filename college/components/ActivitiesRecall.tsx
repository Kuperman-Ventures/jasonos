"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GradeStrip } from "./GradeStrip";
import {
  activityFromRecall,
  currentGrade,
  currentSchoolYearEnd,
  newId,
  recallSpanText,
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

type Capture = {
  key: string;
  name: string;
  since: number | null;
  until: number | null;
  stillDoing: boolean;
  category: ActivityCategoryId | "";
  question: number;
  editing: boolean;
  pickMode: "start" | "end";
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

function schoolYearsCount(
  since: number,
  until: number | null,
  stillDoing: boolean,
  current: number | null,
): number {
  const end = stillDoing ? (current ?? since) : (until ?? since);
  return Math.max(1, end - since + 1);
}

export function ActivitiesRecall({
  journal,
  onChange,
  onDone,
  onExit,
}: {
  journal: Journal;
  onChange: (next: Journal) => void;
  onDone: () => void;
  onExit: () => void;
}) {
  const showedYear = useMemo(() => !journal.profile?.classOf, []);
  const [step, setStep] = useState(showedYear ? 0 : 1);
  const [classOf, setClassOf] = useState<number | null>(journal.profile?.classOf ?? null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [draft, setDraft] = useState("");
  const [dupName, setDupName] = useState("");
  const [leavePrompt, setLeavePrompt] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const questionIndex = step >= 1 && step <= 9 ? step - 1 : -1;
  const question = questionIndex >= 0 ? RECALL_QUESTIONS[questionIndex] : null;
  const years = useMemo(() => yearButtons(), []);
  const gradeNow = currentGrade(classOf ?? undefined);
  const existingNames = journal.activities.filter((a) => !a.archived).map((a) => a.name);

  useEffect(() => {
    if (step >= 1 && step <= 9) inputRef.current?.focus();
  }, [step]);

  function requestExit() {
    if (captures.length) setLeavePrompt(true);
    else onExit();
  }

  function addDraft(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const name = draft.trim();
    if (!name || !question) return;
    if (captures.some((row) => namesMatch(row.name, name))) {
      setDupName(name);
      setDraft("");
      return;
    }
    setCaptures((rows) => [
      ...rows.map((row) => ({ ...row, editing: false })),
      {
        key: newId("recall"),
        name,
        since: null,
        until: null,
        stillDoing: true,
        category: question.defaultCategory,
        question: step,
        editing: true,
        pickMode: "start",
      },
    ]);
    setDraft("");
    setDupName("");
  }

  function patchCapture(key: string, patch: Partial<Capture>) {
    setCaptures((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeCapture(key: string) {
    setCaptures((rows) => rows.filter((row) => row.key !== key));
  }

  function reopenCapture(key: string) {
    setCaptures((rows) =>
      rows.map((row) =>
        row.key === key
          ? { ...row, editing: true, pickMode: row.stillDoing ? "start" : "end" }
          : { ...row, editing: false },
      ),
    );
  }

  function pickGrade(row: Capture, g: number) {
    if (!row.stillDoing && row.pickMode === "end" && row.since != null) {
      if (g >= row.since) patchCapture(row.key, { until: g, editing: false });
      else patchCapture(row.key, { since: g });
      return;
    }
    if (row.stillDoing) patchCapture(row.key, { since: g, until: null, editing: false });
    else patchCapture(row.key, { since: g, pickMode: "end" });
  }

  function goNext() {
    setDraft("");
    setDupName("");
    setCaptures((rows) => rows.map((row) => ({ ...row, editing: false })));
    setStep((n) => Math.min(10, n + 1));
  }

  function goBack() {
    setDraft("");
    setDupName("");
    if (step <= 1) {
      if (showedYear) setStep(0);
      else requestExit();
      return;
    }
    setStep((n) => n - 1);
  }

  function startQuestions() {
    if (classOf == null) return;
    onChange({ ...journal, profile: { ...journal.profile, classOf } });
    setStep(1);
  }

  function createActivities() {
    const year = journal.profile?.classOf ?? classOf;
    if (year == null) return;
    const toCreate = captures.filter(
      (row) => !existingNames.some((name) => namesMatch(name, row.name)),
    );
    let next: Journal = { ...journal, profile: { ...journal.profile, classOf: year } };
    for (const row of toCreate) {
      next = upsertActivity(
        next,
        activityFromRecall(
          {
            name: row.name,
            category: row.category || "other",
            sinceGrade: row.since ?? undefined,
            untilGrade: row.until ?? undefined,
            stillDoing: row.stillDoing,
          },
          year,
        ),
      );
    }
    onChange(next);
    onDone();
  }

  const createCount = captures.filter(
    (row) => !existingNames.some((name) => namesMatch(name, row.name)),
  ).length;
  const rowsThisQuestion = captures.filter((row) => row.question === step);
  const standing = standingLabel(gradeNow);

  if (leavePrompt) {
    return (
      <section className="aj-recall">
        <p className="aj-recall-q">You have {captures.length} answers that aren&apos;t saved yet.</p>
        <div className="aj-recall-foot">
          <button type="button" className="btn btn-primary" onClick={() => setLeavePrompt(false)}>
            Keep going
          </button>
          <button type="button" className="aj-text-btn" onClick={onExit}>
            Leave without saving
          </button>
        </div>
      </section>
    );
  }

  const backLink =
    step === 0 || step === 1 ? (
      <button type="button" className="aj-text-btn" onClick={step === 0 || !showedYear ? requestExit : goBack}>
        {step === 1 && showedYear ? "← Back" : "← Back to My Activities"}
      </button>
    ) : step === 10 ? (
      <button type="button" className="aj-text-btn" onClick={() => setStep(9)}>
        ← Back to the questions
      </button>
    ) : (
      <button type="button" className="aj-text-btn" onClick={goBack}>
        ← Previous question
      </button>
    );

  const counter =
    step === 10 ? (
      <span className="aj-recall-count">Review</span>
    ) : step >= 1 && step <= 9 ? (
      <span className="aj-recall-count">
        Question {step} of 9
      </span>
    ) : (
      <span />
    );

  function tray() {
    return (
      <aside className="aj-recall-tray" aria-label="Your list so far">
        <h2>
          <span>Your list so far</span>
          <span>{captures.length}</span>
        </h2>
        {captures.length ? (
          <ul>
            {captures.map((row) => (
              <li key={row.key}>
                <span className="aj-recall-tray-name">{row.name}</span>
                <GradeStrip
                  since={row.since}
                  until={row.until}
                  stillDoing={row.stillDoing}
                  currentGrade={gradeNow}
                  size="mini"
                  label={row.name}
                />
                <span className="aj-recall-tray-meta">
                  {row.since == null || gradeNow == null
                    ? "Start grade not set yet"
                    : recallSpanText(row.since, row.until, row.stillDoing, gradeNow)}
                </span>
              </li>
            ))}
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
              <li>At the end you&apos;ll see everything laid out grade by grade.</li>
            </ol>
            <p className="aj-recall-year-q" id="aj-recall-year-q">
              What year do you graduate from high school?
            </p>
            <div className="aj-recall-years" role="group" aria-labelledby="aj-recall-year-q">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  aria-pressed={classOf === year}
                  onClick={() => setClassOf(year)}
                >
                  {year}
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

  if (step === 10) {
    const ranked = [...captures].sort((a, b) => {
      const as = a.since ?? 99;
      const bs = b.since ?? 99;
      if (as !== bs) return as - bs;
      return a.name.localeCompare(b.name);
    });
    const longest = captures
      .filter((row) => row.since != null)
      .reduce<Capture | null>((best, row) => {
        if (!best || row.since == null) return best ?? row;
        const bn = schoolYearsCount(best.since!, best.until, best.stillDoing, gradeNow);
        const rn = schoolYearsCount(row.since, row.until, row.stillDoing, gradeNow);
        return rn > bn ? row : best;
      }, null);
    const grades = [6, 7, 8, 9, 10, 11, 12];
    const helper =
      longest && longest.since != null && gradeNow != null
        ? `You've done ${longest.name} for ${schoolYearsCount(longest.since, longest.until, longest.stillDoing, gradeNow)} school years. Check the grades, then add these to your list.`
        : "Check the grades, then add these to your list.";

    return (
      <section className="aj-recall">
        <div className="aj-recall-bar">
          {backLink}
          {counter}
        </div>
        <div className="aj-recall-grid is-single">
          <div className="aj-recall-main is-wide">
            <h3 className="aj-recall-q">Your Activities, Grade by Grade</h3>
            <p className="aj-recall-help">{helper}</p>
            <div className="aj-recall-review-wrap">
              <table className="aj-recall-review">
                <thead>
                  <tr className="aj-recall-review-groups">
                    <th scope="col" />
                    <th scope="colgroup" colSpan={3}>
                      Middle school
                    </th>
                    <th scope="col" className="aj-recall-review-gap" />
                    <th scope="colgroup" colSpan={4}>
                      High school
                    </th>
                    <th scope="col" />
                  </tr>
                  <tr>
                    <th scope="col" className="aj-recall-review-nameh" />
                    {grades.map((g) => (
                      <th
                        key={g}
                        scope="col"
                        className={g === gradeNow ? "is-now" : undefined}
                      >
                        {g === gradeNow ? `${g} · now` : g}
                      </th>
                    )).reduce<ReactNode[]>((acc, cell, i) => {
                      if (grades[i] === 9) {
                        acc.push(<th key="gap-h" className="aj-recall-review-gap" />);
                      }
                      acc.push(cell);
                      return acc;
                    }, [])}
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row) => {
                    const already = existingNames.some((name) => namesMatch(name, row.name));
                    const end =
                      row.since == null
                        ? null
                        : row.stillDoing
                          ? gradeNow
                          : (row.until ?? row.since);
                    return (
                      <tr key={row.key}>
                        <th scope="row" className={already ? "is-existing" : undefined}>
                          {row.name}
                          {already ? (
                            <span className="aj-recall-already">Already in My Activities</span>
                          ) : null}
                        </th>
                        {already || row.since == null ? (
                          <td colSpan={8}>
                            <span className="aj-recall-missing">
                              {already
                                ? ""
                                : "Start grade not set - you can add it later."}
                            </span>
                          </td>
                        ) : (
                          grades.flatMap((g) => {
                            const on = end != null && g >= row.since! && g <= end;
                            const cls = [
                              "aj-recall-seg",
                              on ? "is-on" : "",
                              on && g === gradeNow && row.stillDoing ? "is-now" : "",
                              on && g === row.since ? "is-start" : "",
                              on && g === end ? "is-end" : "",
                            ]
                              .filter(Boolean)
                              .join(" ");
                            const td = (
                              <td key={g}>
                                <div className={cls} />
                              </td>
                            );
                            if (g === 9) {
                              return [
                                <td key="gap" className="aj-recall-review-gap">
                                  <div className={on && g > row.since! ? "aj-recall-seg is-on" : "aj-recall-seg"} />
                                </td>,
                                td,
                              ];
                            }
                            return [td];
                          })
                        )}
                        <td className="aj-recall-span-note">
                          {already || row.since == null || gradeNow == null
                            ? ""
                            : `${schoolYearsCount(row.since, row.until, row.stillDoing, gradeNow)} ${schoolYearsCount(row.since, row.until, row.stillDoing, gradeNow) === 1 ? "yr" : "yrs"}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="aj-recall-foot">
              <button type="button" className="btn btn-primary" onClick={createActivities}>
                Add {createCount} {createCount === 1 ? "activity" : "activities"} to My Activities
              </button>
            </div>
            <p className="aj-recall-next-note">
              Next, each one gets an &quot;Add details&quot; button for your role, what you do, and
              hours. Nothing else is required now.
            </p>
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
            {dupName ? `${dupName} is already on your list.` : ""}
          </p>
          <ul className="aj-recall-items">
            {rowsThisQuestion.map((row) => {
              const open = row.editing || row.since == null;
              let ask = "Tap a different grade to change when you started.";
              if (row.since == null) ask = "What grade did you start?";
              else if (!row.stillDoing && row.pickMode === "end") ask = "What grade did you stop?";
              if (!open) {
                return (
                  <li key={row.key} className="aj-recall-item is-closed">
                    <div className="aj-recall-item-head">
                      <span className="aj-recall-item-name">{row.name}</span>
                      <button
                        type="button"
                        className="aj-text-btn"
                        onClick={() => removeCapture(row.key)}
                      >
                        Remove
                      </button>
                    </div>
                    <GradeStrip
                      since={row.since}
                      until={row.until}
                      stillDoing={row.stillDoing}
                      currentGrade={gradeNow}
                      size="mini"
                      label={row.name}
                    />
                    <p className="aj-recall-summary">
                      <span>
                        {row.since != null && gradeNow != null
                          ? recallSpanText(row.since, row.until, row.stillDoing, gradeNow)
                          : ""}
                      </span>
                      <button
                        type="button"
                        className="aj-text-btn"
                        onClick={() => reopenCapture(row.key)}
                      >
                        Change
                      </button>
                    </p>
                  </li>
                );
              }
              return (
                <li key={row.key} className="aj-recall-item">
                  <div className="aj-recall-item-head">
                    <span className="aj-recall-item-name">{row.name}</span>
                    <button
                      type="button"
                      className="aj-text-btn"
                      onClick={() => removeCapture(row.key)}
                    >
                      Remove
                    </button>
                  </div>
                  <p className="aj-recall-ask">{ask}</p>
                  <GradeStrip
                    since={row.since}
                    until={row.until}
                    stillDoing={row.stillDoing}
                    currentGrade={gradeNow}
                    size="pick"
                    label={row.name}
                    onPick={(g) => pickGrade(row, g)}
                  />
                  <div className="aj-recall-pills" role="group" aria-label="Still doing it?">
                    <button
                      type="button"
                      aria-pressed={row.stillDoing}
                      onClick={() =>
                        patchCapture(row.key, {
                          stillDoing: true,
                          until: null,
                          pickMode: "start",
                        })
                      }
                    >
                      Still doing it
                    </button>
                    <button
                      type="button"
                      aria-pressed={!row.stillDoing}
                      onClick={() =>
                        patchCapture(row.key, {
                          stillDoing: false,
                          pickMode: row.since == null ? "start" : "end",
                          editing: true,
                        })
                      }
                    >
                      I stopped
                    </button>
                    {row.since != null ? (
                      <button
                        type="button"
                        className="aj-text-btn"
                        onClick={() => patchCapture(row.key, { editing: false })}
                      >
                        Done
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="aj-recall-foot">
            <button type="button" className="btn btn-primary" onClick={goNext}>
              {step === 9 ? "See your list" : "Next question"}
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
