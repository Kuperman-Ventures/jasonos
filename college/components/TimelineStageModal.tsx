"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import {
  TIMELINE_PROJECTS,
  buildStageTicks,
  formatProjectRangeKicker,
  formatStageRange,
  nowLinePosition,
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

export function TimelineStageModal({
  projectId,
  liveStages = [],
  onClose,
  onSelectProject,
  onOpenTodos,
}: {
  projectId: string;
  liveStages?: LiveStageRow[];
  onClose: () => void;
  onSelectProject: (id: string) => void;
  onOpenTodos: (projectId: string) => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const index = TIMELINE_PROJECTS.findIndex((project) => project.id === projectId);
  const project = TIMELINE_PROJECTS[index] ?? null;

  const stages = useMemo(
    () => (project ? resolveProjectStages(project.id, liveStages) : []),
    [project, liveStages],
  );
  const today = useMemo(() => new Date(), []);
  const summary = useMemo(() => summarizeStages(stages, today), [stages, today]);
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
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
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

        <div className="tl-sg-scroll">
          <div className="tl-sg">
            <div className="tl-sg-grid tl-sg-head">
              <div className="tl-sg-col mono">Stage</div>
              <div className="tl-sg-col mono">Dates</div>
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
}: {
  stage: TimelineStage;
  project: TimelineProject;
  today: Date;
  phaseHeading: string | null;
}) {
  const status = stageStatus(stage, today);
  const statusLabel = stageStatusLabel(stage, status);
  const title = `${stage.name} · ${formatStageRange(stage.start, stage.end)} · ${statusLabel}`;
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
        title={title}
      >
        <div className="tl-sg-name">
          <span className="tl-sg-mk mono" aria-hidden="true">
            {mark}
          </span>
          <span className="tl-sg-t">{stage.name}</span>
        </div>
        <div className="tl-sg-span mono">
          {formatStageRange(stage.start, stage.end)}
        </div>
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
