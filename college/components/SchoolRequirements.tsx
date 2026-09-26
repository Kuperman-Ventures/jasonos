"use client";

import { useMemo, useState } from "react";
import type { PersistedProjectStep } from "@/lib/ingest";
import {
  cycleRequirementStatus,
  getRequirementProgress,
  requirementHasTodo,
  type RequirementProgressMap,
  type RequirementStatus,
} from "@/lib/requirement-progress";
import type { TodoEditMap } from "@/lib/project-todos";
import {
  REQUIREMENT_STATE_LABEL,
  REQUIREMENT_STATUS_LABEL,
  SAT_SCALE,
  buildSchoolRequirements,
  firstName,
  recommendationCount,
  satPosition,
  toSubmitItems,
  type RequirementKey,
  type RequirementProfileItem,
  type RequirementState,
} from "@/lib/school-requirements";
import type { Owner, School } from "@/lib/types";
import { SchoolMark } from "./SchoolMark";

const STATE_ORDER: RequirementState[] = ["req", "mod", "no", "unk"];

function BlurInput({
  value,
  onCommit,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onCommit: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  return (
    <input
      className="field"
      aria-label={ariaLabel}
      placeholder={placeholder}
      defaultValue={value}
      key={value}
      onBlur={(event) => {
        if (event.target.value !== value) onCommit(event.target.value);
      }}
    />
  );
}

export function SchoolRequirements({
  school,
  memberId,
  memberName,
  studentSat = null,
  requirementProgress,
  projectSteps,
  todoEdits = {},
  onPatch,
  onCycleStatus,
  onAddRequirementTodo,
}: {
  school: School;
  memberId: string;
  memberName: string;
  /** Composite SAT when the student profile has one; null hides the marker. */
  studentSat?: number | null;
  requirementProgress: RequirementProgressMap;
  projectSteps: PersistedProjectStep[];
  todoEdits?: TodoEditMap;
  onPatch: (patch: Partial<School>) => void;
  onCycleStatus: (key: RequirementKey, status: RequirementStatus) => void;
  onAddRequirementTodo: (key: RequirementKey, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const userId = (["kyle", "jason", "kat"].includes(memberId) ? memberId : "jason") as Owner;
  const view = useMemo(() => buildSchoolRequirements(school), [school]);
  const toSubmit = useMemo(() => toSubmitItems(view.profile), [view.profile]);
  const quiet = useMemo(
    () => view.profile.filter((item) => item.state === "no"),
    [view.profile],
  );
  const groups = useMemo(() => {
    return STATE_ORDER.map((state) => ({
      state,
      items: view.profile.filter((item) => item.state === state),
    })).filter((group) => group.items.length > 0);
  }, [view.profile]);
  const hasModified = view.profile.some((item) => item.state === "mod");
  const testsItem = view.profile.find((item) => item.key === "tests");
  const recs = recommendationCount(view.profile);
  const doneCount = toSubmit.filter((item) => {
    const progress = getRequirementProgress(requirementProgress, userId, school.id, item.key);
    return progress.status === 2;
  }).length;
  const progressPct = toSubmit.length ? (doneCount / toSubmit.length) * 100 : 0;
  const who = firstName(memberName);

  const stats: {
    label: string;
    value: string | number;
    sub: string;
    hot?: boolean;
  }[] = [
    { label: "To submit", value: toSubmit.length, sub: "items required" },
    { label: "Platform", value: view.platform, sub: "one application" },
    {
      label: "Testing",
      value: testsItem ? REQUIREMENT_STATE_LABEL[testsItem.state] : "—",
      sub: "SAT or ACT",
      hot: testsItem?.state === "req",
    },
    { label: "Recommendations", value: recs, sub: "teacher or counselor" },
  ];

  if (editing) {
    return (
      <section className="school-modal-section school-reqs-edit">
        <div className="school-overview-head">
          <h3>Edit requirements</h3>
          <p className="section-sub">
            These fields feed the read-first Requirements view. Close when you&apos;re done.
          </p>
        </div>
        <div className="school-edit-grid">
          <label className="stack-field">
            <span className="label">Test policy</span>
            <BlurInput
              value={school.testPolicy}
              ariaLabel="Test policy"
              placeholder="Not entered"
              onCommit={(value) => onPatch({ testPolicy: value })}
            />
          </label>
          <label className="stack-field">
            <span className="label">Middle 50%</span>
            <BlurInput
              value={school.middle50}
              ariaLabel="Middle 50 percent"
              placeholder="Not entered"
              onCommit={(value) => onPatch({ middle50: value })}
            />
          </label>
          <label className="stack-field">
            <span className="label">Application platform</span>
            <BlurInput
              value={school.applicationPlatform}
              ariaLabel="Application platform"
              placeholder="Not entered"
              onCommit={(value) => onPatch({ applicationPlatform: value })}
            />
          </label>
          <label className="stack-field">
            <span className="label">Teacher recommendations</span>
            <BlurInput
              value={school.teacherRecs}
              ariaLabel="Teacher recommendation count"
              placeholder="Not entered"
              onCommit={(value) => onPatch({ teacherRecs: value })}
            />
          </label>
        </div>
        <label className="stack-field school-edit-full">
          <span className="label">SAT context</span>
          <textarea
            className="field"
            defaultValue={school.satContext}
            key={school.satContext}
            placeholder="Not entered"
            onBlur={(event) => {
              if (event.target.value !== school.satContext) onPatch({ satContext: event.target.value });
            }}
          />
        </label>
        <label className="stack-field school-edit-full">
          <span className="label">Required essays</span>
          <textarea
            className="field"
            defaultValue={school.requiredEssays}
            key={school.requiredEssays}
            placeholder="Not entered"
            onBlur={(event) => {
              if (event.target.value !== school.requiredEssays) {
                onPatch({ requiredEssays: event.target.value });
              }
            }}
          />
        </label>
        <label className="stack-field school-edit-full">
          <span className="label">Admissions context</span>
          <textarea
            className="field"
            defaultValue={school.admissionsContext}
            key={school.admissionsContext}
            placeholder="Not entered"
            onBlur={(event) => {
              if (event.target.value !== school.admissionsContext) {
                onPatch({ admissionsContext: event.target.value });
              }
            }}
          />
        </label>
        <div className="school-reqs-edit-foot">
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
            Done editing
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="school-modal-section school-reqs">
      <header className="school-reqs-header">
        <div className="school-reqs-kicker">
          <span className="school-reqs-mark" title={school.name}>
            <SchoolMark name={school.name} website={school.website} />
          </span>
          <b>{school.name}</b>
          <span className="school-reqs-label">Requirements</span>
        </div>
        <div className="school-reqs-stats">
          {stats.map((stat) => (
            <div className="school-reqs-stat" key={stat.label}>
              <span className="school-reqs-label school-reqs-label-sm">{stat.label}</span>
              <span
                className={`school-reqs-stat-value${stat.hot ? " hot" : ""}`}
                title={String(stat.value)}
              >
                {stat.value}
              </span>
              <span className="school-reqs-stat-sub">{stat.sub}</span>
            </div>
          ))}
        </div>
        <div className="school-reqs-progress">
          <div className="school-reqs-progress-bar" aria-hidden="true">
            <i style={{ width: `${progressPct}%` }} />
          </div>
          <span>
            {doneCount} of {toSubmit.length} done
          </span>
        </div>
      </header>

      <div className="school-reqs-profile">
        <span className="school-reqs-label">Requirement profile</span>
        <div
          className="school-reqs-groups"
          style={{
            gridTemplateColumns: groups.map((group) => `${group.items.length}fr`).join(" "),
          }}
        >
          {groups.map((group) => (
            <div className={`school-reqs-group g-${group.state}`} key={group.state}>
              <h3>
                {REQUIREMENT_STATE_LABEL[group.state]}
                <span>{group.items.length}</span>
              </h3>
              <div className="school-reqs-tiles">
                {group.items.map((item) => (
                  <div className="school-reqs-tile" key={item.key}>
                    <b>{item.label}</b>
                    <small>{item.note}</small>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {!hasModified ? <span className="school-reqs-nomod">No modified requirements</span> : null}
      </div>

      <div className="school-reqs-kit">
        <div className="school-reqs-kit-row school-reqs-kit-head school-reqs-label school-reqs-label-sm">
          <span>Status</span>
          <span>To submit</span>
          <span>{school.name} says</span>
          <span />
        </div>
        {toSubmit.map((item) => (
          <KitRow
            key={item.key}
            item={item}
            title={view.kit[item.key].title}
            detail={view.kit[item.key].detail}
            status={getRequirementProgress(requirementProgress, userId, school.id, item.key).status}
            inTodo={requirementHasTodo(item.key, school.id, projectSteps, todoEdits)}
            onCycle={() => {
              const current = getRequirementProgress(
                requirementProgress,
                userId,
                school.id,
                item.key,
              ).status;
              onCycleStatus(item.key, cycleRequirementStatus(current));
            }}
            onAddTodo={() => onAddRequirementTodo(item.key, view.kit[item.key].title)}
          />
        ))}
        {quiet.map((item) => (
          <div className="school-reqs-kit-row school-reqs-kit-quiet" key={item.key}>
            <span>—</span>
            <span>{view.kit[item.key].title}</span>
            <span className="school-reqs-says">Not required</span>
            <span />
          </div>
        ))}
      </div>

      <div className="school-reqs-context">
        <div>
          <span className="school-reqs-label">Where {who}&apos;s SAT lands</span>
          {view.satRange ? (
            <SatRangeBand range={view.satRange} studentSat={studentSat} studentName={who} />
          ) : (
            <p className="school-reqs-mid50">No middle-50 SAT band in our data yet.</p>
          )}
          <p className="school-reqs-mid50">Middle 50%: {view.middle50}.</p>
        </div>
        <div>
          <span className="school-reqs-label">Admissions context</span>
          <p className="school-reqs-adm">{view.admissionsContext}</p>
        </div>
      </div>

      <div className="school-reqs-foot">
        <span>
          Test policy: {view.testPolicy} · Platform: {view.platform}
        </span>
        <button type="button" className="school-reqs-edit-link" onClick={() => setEditing(true)}>
          Edit requirements
        </button>
      </div>
    </section>
  );
}

function KitRow({
  item,
  title,
  detail,
  status,
  inTodo,
  onCycle,
  onAddTodo,
}: {
  item: RequirementProfileItem;
  title: string;
  detail: string;
  status: RequirementStatus;
  inTodo: boolean;
  onCycle: () => void;
  onAddTodo: () => void;
}) {
  const statusLabel = REQUIREMENT_STATUS_LABEL[status];
  return (
    <div className="school-reqs-kit-row school-reqs-kit-item">
      <button
        type="button"
        className="school-reqs-status"
        data-s={status}
        aria-label={`${title}: ${statusLabel}, click to change`}
        onClick={onCycle}
      >
        <i aria-hidden="true" />
        {statusLabel}
      </button>
      <div className="school-reqs-what">
        <b>{title}</b>
        {detail ? <span>{detail}</span> : null}
      </div>
      <span className="school-reqs-says">
        {item.state === "mod" ? "Modified" : "Required"}
      </span>
      <button
        type="button"
        className="school-reqs-todo"
        disabled={inTodo}
        onClick={onAddTodo}
      >
        {inTodo ? "In To-Do ✓" : "Add to To-Do"}
      </button>
    </div>
  );
}

function SatRangeBand({
  range,
  studentSat,
  studentName,
}: {
  range: [number, number];
  studentSat: number | null | undefined;
  studentName: string;
}) {
  const [lo, hi] = range;
  const left = satPosition(lo);
  const right = satPosition(hi);
  const width = Math.max(0, right - left);
  const me = studentSat != null ? satPosition(studentSat) : null;
  return (
    <div className="school-reqs-range">
      <div className="track" />
      <div className="band" style={{ left: `${left}%`, width: `${width}%` }} />
      {me != null ? (
        <>
          <div className="me" style={{ left: `${me}%` }} />
          <span className="me-l" style={{ left: `${me}%` }}>
            {studentName} {studentSat}
          </span>
        </>
      ) : null}
      <span className="tick" style={{ left: `${left}%` }}>
        {lo}
      </span>
      <span className="tick" style={{ left: `${right}%` }}>
        {hi}
      </span>
      <span className="sr-only">
        Middle 50 percent SAT {lo} to {hi}
        {studentSat != null ? `. ${studentName} scored ${studentSat}.` : ""} on a scale of{" "}
        {SAT_SCALE[0]} to {SAT_SCALE[1]}.
      </span>
    </div>
  );
}
