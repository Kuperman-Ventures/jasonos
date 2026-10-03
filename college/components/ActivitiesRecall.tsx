"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACTIVITY_CATEGORIES,
  activityFromRecall,
  newId,
  upsertActivity,
  type ActivitiesJournal as Journal,
  type ActivityCategoryId,
} from "@/lib/activities-journal";

const SINCE_GRADES = [
  { id: "6", label: "6th" },
  { id: "7", label: "7th" },
  { id: "8", label: "8th" },
  { id: "9", label: "9th" },
  { id: "10", label: "10th" },
  { id: "11", label: "11th" },
  { id: "12", label: "12th" },
] as const;

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
  sinceGrade: string;
  stillDoing: boolean;
  untilGrade: string;
  category: ActivityCategoryId | "";
  question: number;
};

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function graduationYearOptions(now = new Date()): number[] {
  const start = now.getFullYear();
  return Array.from({ length: 7 }, (_, i) => start + i);
}

function Grade6to12Select({
  value,
  onChange,
  allowBlank,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  allowBlank?: boolean;
  label: string;
}) {
  return (
    <label className="stack-field">
      <span className="label">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowBlank ? <option value="">—</option> : null}
        <optgroup label="Middle school">
          {SINCE_GRADES.filter((g) => g.id === "6" || g.id === "7" || g.id === "8").map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="High school">
          {SINCE_GRADES.filter((g) => Number(g.id) >= 9).map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}

export function ActivitiesRecall({
  journal,
  onChange,
  onDone,
}: {
  journal: Journal;
  onChange: (next: Journal) => void;
  onDone: () => void;
}) {
  const [showedYear] = useState(!journal.profile?.classOf);
  const [step, setStep] = useState(showedYear ? 0 : 1);
  const [classOf, setClassOf] = useState(
    journal.profile?.classOf ? String(journal.profile.classOf) : "",
  );
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [draft, setDraft] = useState("");
  const [dupNote, setDupNote] = useState(false);

  useEffect(() => {
    if (!dupNote) return;
    const t = window.setTimeout(() => setDupNote(false), 3000);
    return () => window.clearTimeout(t);
  }, [dupNote]);

  const questionIndex = step >= 1 && step <= 9 ? step - 1 : -1;
  const question = questionIndex >= 0 ? RECALL_QUESTIONS[questionIndex] : null;
  const yearOptions = useMemo(() => graduationYearOptions(), []);

  const existingNames = journal.activities
    .filter((a) => !a.archived)
    .map((a) => a.name);

  function addDraft() {
    const name = draft.trim();
    if (!name || !question) return;
    if (captures.some((row) => namesMatch(row.name, name))) {
      setDupNote(true);
      setDraft("");
      return;
    }
    setCaptures((rows) => [
      ...rows,
      {
        key: newId("recall"),
        name,
        sinceGrade: "",
        stillDoing: true,
        untilGrade: "",
        category: question.defaultCategory,
        question: step,
      },
    ]);
    setDraft("");
    setDupNote(false);
  }

  function patchCapture(key: string, patch: Partial<Capture>) {
    setCaptures((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeCapture(key: string) {
    setCaptures((rows) => rows.filter((row) => row.key !== key));
  }

  function goNext() {
    setDraft("");
    setDupNote(false);
    setStep((n) => Math.min(10, n + 1));
  }

  function goBack() {
    setDraft("");
    setDupNote(false);
    setStep((n) => {
      if (n <= 1) return showedYear ? 0 : 1;
      return n - 1;
    });
  }

  function saveClassOf() {
    const year = Number(classOf);
    if (!Number.isFinite(year)) return;
    onChange({ ...journal, profile: { ...journal.profile, classOf: year } });
    setStep(1);
  }

  function createActivities() {
    const year = journal.profile?.classOf ?? Number(classOf);
    if (!Number.isFinite(year)) return;
    const toCreate = captures.filter(
      (row) => !existingNames.some((name) => namesMatch(name, row.name)),
    );
    let next: Journal = { ...journal, profile: { ...journal.profile, classOf: year } };
    for (const row of toCreate) {
      const activity = activityFromRecall(
        {
          name: row.name,
          category: row.category || "other",
          sinceGrade: row.sinceGrade ? Number(row.sinceGrade) : undefined,
          untilGrade: row.untilGrade ? Number(row.untilGrade) : undefined,
          stillDoing: row.stillDoing,
        },
        year,
      );
      next = upsertActivity(next, activity);
    }
    onChange(next);
    onDone();
  }

  const createCount = captures.filter(
    (row) => !existingNames.some((name) => namesMatch(name, row.name)),
  ).length;

  const rowsThisQuestion = captures.filter((row) => row.question === step);

  if (step === 0) {
    return (
      <section className="aj-recall">
        <h3 className="aj-title">Build Your Activities List</h3>
        <p className="aj-support">
          This takes about 10 minutes. You&apos;ll answer a few short questions, and each answer
          becomes an activity you can fill in later.
        </p>
        <label className="stack-field">
          <span className="label">What year do you graduate from high school?</span>
          <select className="field" value={classOf} onChange={(e) => setClassOf(e.target.value)}>
            <option value="">Choose a year</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <div className="aj-recall-foot">
          <button type="button" className="btn btn-primary" disabled={!classOf} onClick={saveClassOf}>
            Start
          </button>
        </div>
      </section>
    );
  }

  if (step === 10) {
    return (
      <section className="aj-recall">
        <h3 className="aj-title">Review Your List</h3>
        <p className="aj-support">Choose a type for each one. You can add details later.</p>
        {captures.length ? (
          <div className="aj-recall-table-wrap">
            <table className="aj-recall-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Since</th>
                  <th scope="col">Still doing this</th>
                  <th scope="col">Until</th>
                </tr>
              </thead>
              <tbody>
                {captures.map((row) => {
                  const already = existingNames.some((name) => namesMatch(name, row.name));
                  return (
                    <tr key={row.key} className={already ? "is-existing" : undefined}>
                      <td>
                        {row.name}
                        {already ? (
                          <span className="aj-recall-existing">Already in your activities</span>
                        ) : null}
                      </td>
                      <td>
                        <select
                          className="field"
                          value={row.category}
                          disabled={already}
                          onChange={(e) =>
                            patchCapture(row.key, {
                              category: e.target.value as ActivityCategoryId | "",
                            })
                          }
                        >
                          <option value="">Choose a type</option>
                          {ACTIVITY_CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="field"
                          value={row.sinceGrade}
                          disabled={already}
                          onChange={(e) => patchCapture(row.key, { sinceGrade: e.target.value })}
                          aria-label={`Since grade for ${row.name}`}
                        >
                          <option value="">—</option>
                          {SINCE_GRADES.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.stillDoing}
                          disabled={already}
                          onChange={(e) =>
                            patchCapture(row.key, { stillDoing: e.target.checked })
                          }
                          aria-label={`Still doing ${row.name}`}
                        />
                      </td>
                      <td>
                        {row.stillDoing ? (
                          "—"
                        ) : (
                          <select
                            className="field"
                            value={row.untilGrade}
                            disabled={already}
                            onChange={(e) => patchCapture(row.key, { untilGrade: e.target.value })}
                            aria-label={`Until grade for ${row.name}`}
                          >
                            <option value="">—</option>
                            {SINCE_GRADES.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="aj-muted">No new activities from these questions.</p>
        )}
        <div className="aj-recall-foot">
          <button type="button" className="btn btn-secondary" onClick={goBack}>
            Back
          </button>
          <button type="button" className="btn btn-primary" onClick={createActivities}>
            Add {createCount} {createCount === 1 ? "activity" : "activities"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="aj-recall">
      <p className="aj-recall-step">Question {step} of 9</p>
      <h3 className="aj-title">{question?.question}</h3>
      <p className="aj-recall-helper">{question?.helper}</p>
      <label className="stack-field">
        <span className="label">Type one thing and press Enter</span>
        <input
          className="field"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
        />
      </label>
      {dupNote ? <p className="aj-recall-dup">Already on your list</p> : null}
      {rowsThisQuestion.length ? (
        <ul className="aj-recall-rows">
          {rowsThisQuestion.map((row) => (
            <li key={row.key} className="aj-recall-row">
              <input
                className="field"
                value={row.name}
                aria-label="Name"
                onChange={(e) => patchCapture(row.key, { name: e.target.value })}
              />
              <Grade6to12Select
                label="Since"
                allowBlank
                value={row.sinceGrade}
                onChange={(value) => patchCapture(row.key, { sinceGrade: value })}
              />
              <label className="aj-check">
                <input
                  type="checkbox"
                  checked={row.stillDoing}
                  onChange={(e) => patchCapture(row.key, { stillDoing: e.target.checked })}
                />
                <span>Still doing this</span>
              </label>
              {!row.stillDoing ? (
                <Grade6to12Select
                  label="Until"
                  allowBlank
                  value={row.untilGrade}
                  onChange={(value) => patchCapture(row.key, { untilGrade: value })}
                />
              ) : null}
              <button
                type="button"
                className="aj-recall-remove"
                onClick={() => removeCapture(row.key)}
                aria-label={`Remove ${row.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="aj-recall-foot">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={goBack}
          disabled={step === 1 && !showedYear}
        >
          Back
        </button>
        <button type="button" className="btn btn-secondary" onClick={goNext}>
          Skip
        </button>
        <button type="button" className="btn btn-primary" onClick={goNext}>
          Next
        </button>
      </div>
    </section>
  );
}
