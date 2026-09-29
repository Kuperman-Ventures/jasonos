"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { MemberBadge } from "@/components/MemberBadge";
import type { MemberProfile } from "@/lib/member-avatars";
import { memberOwnerId } from "@/lib/project-todos";
import {
  TIMELINE_PROJECTS,
  buildStageTicks,
  formatProjectRangeKicker,
  formatStageRange,
  nowLinePosition,
  overdueStages,
  pct,
  resolveProjectStages,
  stageBarGeometry,
  stageMark,
  stageStatus,
  stageStatusLabel,
  summarizeStages,
  type TimelineProject,
  type TimelineStage,
} from "@/lib/timeline-stages";
import { OWNERS, ownerLabel, type Owner } from "@/lib/types";

type LiveStageRow = {
  id: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  projectId: string | null;
  phase: string | null;
  isMilestone: boolean;
  completedAt: string | null;
  done: boolean;
};

export type StageAssignPayload = {
  id: string;
  name: string;
  start: string;
  end: string;
  projectId: string;
};

export function TimelineStageModal({
  projectId,
  liveStages = [],
  stageCompletions = {},
  memberId,
  memberProfiles = [],
  stageOwners = {},
  onClose,
  onSelectProject,
  onOpenTodos,
  onMarkStageDone,
  onAssignStage,
}: {
  projectId: string;
  liveStages?: LiveStageRow[];
  /** Checklist-style completions for seed stages (stage id → done). */
  stageCompletions?: Record<string, boolean>;
  memberId?: string;
  memberProfiles?: MemberProfile[];
  /** Current assignee per stage/todo id. */
  stageOwners?: Record<string, Owner>;
  onClose: () => void;
  onSelectProject: (id: string) => void;
  onOpenTodos: (projectId: string) => void;
  onMarkStageDone?: (stageId: string) => void;
  onAssignStage?: (stage: StageAssignPayload, owner: Owner | null) => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const index = TIMELINE_PROJECTS.findIndex((project) => project.id === projectId);
  const project = TIMELINE_PROJECTS[index] ?? null;
  const viewer = memberId ? memberOwnerId(memberId) : null;
  const profiles = useMemo(
    () => new Map(memberProfiles.map((row) => [row.id, row])),
    [memberProfiles],
  );

  const stages = useMemo(
    () => (project ? resolveProjectStages(project.id, liveStages, stageCompletions) : []),
    [project, liveStages, stageCompletions],
  );
  const today = useMemo(() => new Date(), []);
  const summary = useMemo(() => summarizeStages(stages, today), [stages, today]);
  const overdue = useMemo(() => overdueStages(stages, today), [stages, today]);
  const ticks = useMemo(
    () => (project ? buildStageTicks(project, today) : []),
    [project, today],
  );
  const nowLeft = project ? nowLinePosition(project, today) : null;

  const stageRows = useMemo(() => {
    let lastPhase: string | null = null;
    return stages.map((stage) => {
      const phaseHeading =
        stage.phase && stage.phase !== lastPhase ? stage.phase : null;
      if (stage.phase) lastPhase = stage.phase;
      return { stage, phaseHeading };
    });
  }, [stages]);

  useEffect(() => {
    closeRef.current?.focus();
  }, [projectId]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!project) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => !node.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);

    function step(delta: number) {
      const next =
        TIMELINE_PROJECTS[
          (index + delta + TIMELINE_PROJECTS.length) % TIMELINE_PROJECTS.length
        ];
      if (next) onSelectProject(next.id);
    }
  }, [index, onClose, onSelectProject, project]);

  if (!project) return null;

  return (
    <div
      className="tl-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="tl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="tl-dlg-head">
          <div>
            <div className="tl-kicker mono">
              {formatProjectRangeKicker(project, index, TIMELINE_PROJECTS.length)}
            </div>
            <h2 id={titleId}>{project.name}</h2>
            <div className="tl-dlg-sum mono">{summary.label}</div>
          </div>
          <div className="tl-dlg-actions">
            <button
              type="button"
              className="btn btn-secondary tl-icon-btn"
              aria-label="Previous project"
              title="Previous project"
              onClick={() => {
                const prev =
                  TIMELINE_PROJECTS[
                    (index - 1 + TIMELINE_PROJECTS.length) % TIMELINE_PROJECTS.length
                  ];
                if (prev) onSelectProject(prev.id);
              }}
            >
              ←
            </button>
            <button
              type="button"
              className="btn btn-secondary tl-icon-btn"
              aria-label="Next project"
              title="Next project"
              onClick={() => {
                const next =
                  TIMELINE_PROJECTS[(index + 1) % TIMELINE_PROJECTS.length];
                if (next) onSelectProject(next.id);
              }}
            >
              →
            </button>
            <button
              ref={closeRef}
              type="button"
              className="btn btn-secondary tl-icon-btn"
              aria-label="Close"
              title="Close (Esc)"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        {overdue.length ? (
          <div className="tl-overdue-alert" role="alert">
            <div className="tl-overdue-alert-head">
              <strong>
                {overdue.length} overdue stage{overdue.length === 1 ? "" : "s"}
              </strong>
              <span>
                The scheduled window passed. Confirm each one when the work is actually done.
              </span>
            </div>
            <ul className="tl-overdue-list">
              {overdue.map((stage) => (
                <li key={stage.id}>
                  <div>
                    <b>{stage.name}</b>
                    <span className="mono">{formatStageRange(stage.start, stage.end)}</span>
                  </div>
                  {onMarkStageDone ? (
                    <button
                      type="button"
                      className="btn btn-primary tl-overdue-resolve"
                      onClick={() => onMarkStageDone(stage.id)}
                    >
                      Mark done
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="tl-sg-scroll">
          <div className={`tl-sg${onAssignStage ? " tl-sg-assignable" : ""}`}>
            <div className="tl-sg-grid tl-sg-head">
              <div className="tl-sg-col mono">Stage</div>
              <div className="tl-sg-col mono">Dates</div>
              {onAssignStage ? (
                <div className="tl-sg-col tl-sg-col-assign mono">Assign</div>
              ) : null}
              <div className="tl-sg-track">
                {ticks.map((tick, i) => (
                  <div
                    key={`${tick.label}-${i}`}
                    className="tl-sg-tick"
                    data-cur={tick.current ? "true" : undefined}
                    style={{ left: pct(tick.left), width: pct(tick.width) }}
                  >
                    <div className="tl-sg-yr mono">{tick.year}</div>
                    <div className="tl-sg-mo mono">{tick.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {stageRows.map((row) => (
              <StageRow
                key={row.stage.id}
                stage={row.stage}
                project={project}
                today={today}
                phaseHeading={row.phaseHeading}
                owner={stageOwners[row.stage.id] ?? null}
                profiles={profiles}
                viewer={viewer}
                onMarkDone={
                  onMarkStageDone && stageStatus(row.stage, today) === "overdue"
                    ? () => onMarkStageDone(row.stage.id)
                    : undefined
                }
                onAssign={
                  onAssignStage
                    ? (owner) =>
                        onAssignStage(
                          {
                            id: row.stage.id,
                            name: row.stage.name,
                            start: row.stage.start,
                            end: row.stage.end,
                            projectId: row.stage.projectId,
                          },
                          owner,
                        )
                    : undefined
                }
              />
            ))}

            <div className="tl-sg-overlay" aria-hidden="true">
              {ticks.slice(1).map((tick, i) => (
                <div
                  key={`line-${i}`}
                  className="tl-sg-line"
                  style={{ left: pct(tick.left) }}
                />
              ))}
              {nowLeft != null ? (
                <>
                  <div className="tl-sg-now" style={{ left: pct(nowLeft) }} />
                  <div className="tl-sg-now-cap mono" style={{ left: pct(nowLeft) }}>
                    NOW
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="tl-legend tl-dlg-foot">
          <span>
            <i className="tl-swatch" style={{ background: "var(--color-done)" }} />
            Done
          </span>
          <span>
            <i className="tl-swatch" style={{ background: "var(--color-accent)" }} />
            Overdue
          </span>
          <span>
            <i className="tl-swatch" style={{ background: "var(--bar)" }} />
            In progress
          </span>
          <span>
            <i className="tl-swatch" style={{ background: "var(--bar-future)" }} />
            Not started
          </span>
          <span>
            <i className="tl-swatch tl-dia" />
            Deadline
          </span>
          <button
            type="button"
            className="tl-todos-link"
            onClick={() => onOpenTodos(project.id)}
          >
            Open in To-dos →
          </button>
        </div>
      </div>
    </div>
  );
}

function StageRow({
  stage,
  project,
  today,
  phaseHeading,
  owner,
  profiles,
  viewer,
  onMarkDone,
  onAssign,
}: {
  stage: TimelineStage;
  project: TimelineProject;
  today: Date;
  phaseHeading: string | null;
  owner: Owner | null;
  profiles: Map<string, MemberProfile>;
  viewer: Owner | null;
  onMarkDone?: () => void;
  onAssign?: (owner: Owner | null) => void;
}) {
  const status = stageStatus(stage, today);
  const statusLabel = stageStatusLabel(stage, status);
  const ownerProfile = owner ? profiles.get(owner) : null;
  const ownerName = owner
    ? (ownerProfile?.displayName ?? ownerLabel(owner))
    : null;
  const title = [
    stage.name,
    formatStageRange(stage.start, stage.end),
    statusLabel,
    ownerName ? `Assigned to ${ownerName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const geo = stageBarGeometry(stage, project);
  const mark = stageMark(stage, status);

  return (
    <>
      {phaseHeading ? (
        <div className="tl-sg-group mono">{phaseHeading}</div>
      ) : null}
      <div
        className="tl-sg-grid tl-sg-row"
        data-s={status}
        data-ms={stage.isMilestone ? "true" : undefined}
        data-assigned={owner ? "true" : undefined}
        title={title}
      >
        <div className="tl-sg-name">
          <span className="tl-sg-mk mono" aria-hidden="true">
            {mark}
          </span>
          <span className="tl-sg-t">{stage.name}</span>
          {ownerName ? (
            <span className="tl-sg-owner">
              <MemberBadge
                name={ownerName}
                avatarUrl={ownerProfile?.avatarUrl}
                size="sm"
                showName={false}
                title={`Assigned to ${ownerName}`}
              />
            </span>
          ) : null}
          {status === "overdue" && onMarkDone ? (
            <button
              type="button"
              className="tl-sg-mark-done"
              onClick={onMarkDone}
            >
              Mark done
            </button>
          ) : null}
        </div>
        <div className="tl-sg-span mono">
          {formatStageRange(stage.start, stage.end)}
        </div>
        {onAssign ? (
          <StageAssignSelect
            stageId={stage.id}
            stageName={stage.name}
            owner={owner}
            profiles={profiles}
            viewer={viewer}
            onAssign={onAssign}
          />
        ) : null}
        <div className="tl-sg-track">
          {stage.isMilestone ? (
            <div
              className="tl-sg-pin"
              role="img"
              aria-label={title}
              style={{ left: pct(geo.left) }}
            />
          ) : (
            <div
              className="tl-sg-bar"
              role="img"
              aria-label={title}
              data-s={status}
              style={{ left: pct(geo.left), width: pct(geo.width) }}
            />
          )}
        </div>
      </div>
    </>
  );
}

function StageAssignSelect({
  stageId,
  stageName,
  owner,
  profiles,
  viewer,
  onAssign,
}: {
  stageId: string;
  stageName: string;
  owner: Owner | null;
  profiles: Map<string, MemberProfile>;
  viewer: Owner | null;
  onAssign: (owner: Owner | null) => void;
}) {
  const labelId = `tl-assign-${stageId}`;
  return (
    <div className="tl-sg-assign">
      <label className="tl-assign-label" htmlFor={labelId}>
        <span className="sr-only">Assign {stageName} to</span>
        <select
          id={labelId}
          className="tl-assign-select"
          value={owner ?? ""}
          aria-label={`Assign ${stageName}`}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) onAssign(null);
            else onAssign(value as Owner);
          }}
        >
          <option value="">Unassigned</option>
          {OWNERS.map((row) => {
            const profile = profiles.get(row.id);
            const name = profile?.displayName ?? row.label;
            return (
              <option key={row.id} value={row.id}>
                {name}
              </option>
            );
          })}
        </select>
      </label>
      {viewer && owner !== viewer ? (
        <button
          type="button"
          className="tl-assign-claim"
          onClick={() => onAssign(viewer)}
        >
          Me
        </button>
      ) : null}
    </div>
  );
}
