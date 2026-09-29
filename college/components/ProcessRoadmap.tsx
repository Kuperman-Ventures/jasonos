"use client";

import { useMemo, useRef, useState } from "react";
import {
  ROADMAP_TRACKS,
  accessibleTrackName,
  currentMonthIndex,
  dayProgressInMonth,
  formatNowDay,
  formatSpan,
  gridColumnStart,
  monthCells,
  monthIndex,
  segmentState,
  spanLength,
  trackState,
  yearBands,
  type RoadmapTrack,
} from "@/lib/roadmap";
import {
  monthEndIso,
  monthStartIso,
  openStagesAriaLabel,
} from "@/lib/timeline-stages";
import { TimelineStageModal, type StageAssignPayload } from "./TimelineStageModal";
import type { MemberProfile } from "@/lib/member-avatars";
import type { PersistedProjectStep } from "@/lib/ingest";
import {
  stageOwnerMap,
  type TodoEditMap,
  type TodoSubtaskMap,
} from "@/lib/project-todos";
import type { Owner } from "@/lib/types";

function trackStartIso(track: RoadmapTrack): string {
  return monthStartIso(track.start.year, track.start.month);
}
function trackEndIso(track: RoadmapTrack): string {
  return monthEndIso(track.end.year, track.end.month);
}

function TrackRow({
  track,
  row,
  checklist,
  now,
  onOpenStages,
}: {
  track: RoadmapTrack;
  row: number;
  checklist: Record<string, boolean>;
  now: Date;
  onOpenStages: (projectId: string, trigger: HTMLElement) => void;
}) {
  const state = trackState(track, checklist, now);
  const start = monthIndex(track.start.year, track.start.month);
  const length = spanLength(track.start, track.end);
  const name = accessibleTrackName(track, state);
  const span = formatSpan(track);
  const detail = `${name} · ${span}`;
  const segments = track.segments ?? [];
  const statusWord =
    state === "done" ? "complete" : state === "future" ? "not started" : "in progress";

  return (
    <>
      <div className="rule" style={{ gridRow: row, gridColumn: "1 / -1" }} />
      <div
        className="name"
        style={
          track.kind === "milestone"
            ? { gridRow: row, color: "var(--milestone-ink)" }
            : { gridRow: row }
        }
        data-state={state === "future" ? "future" : undefined}
        title={detail}
      >
        {track.label}
      </div>
      {track.kind === "milestone" ? (
        <button
          type="button"
          className="pin"
          style={{ gridRow: row, gridColumn: gridColumnStart(start) }}
          title={detail}
          aria-label={detail}
        />
      ) : segments.length ? (
        <div
          className="bar-stack"
          style={{
            gridRow: row,
            gridColumn: `${gridColumnStart(start)} / span ${length}`,
            gridTemplateColumns: segments
              .map((segment) => `${spanLength(segment.start, segment.end)}fr`)
              .join(" "),
          }}
          role="group"
          aria-label={detail}
        >
          {segments.map((segment) => {
            const segState = segmentState(segment, now);
            const segStatus =
              segState === "done"
                ? "complete"
                : segState === "future"
                  ? "not started"
                  : "in progress";
            const aria = openStagesAriaLabel(
              track.label,
              segment.label,
              monthStartIso(segment.start.year, segment.start.month),
              monthEndIso(segment.end.year, segment.end.month),
              segStatus,
            );
            return (
              <button
                key={segment.id}
                type="button"
                className="bar-seg"
                data-state={segState}
                title={aria}
                aria-label={aria}
                onClick={(event) => onOpenStages(track.id, event.currentTarget)}
              >
                <span className="bar-seg-label">{segment.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          className="bar"
          data-state={state === "future" ? "future" : undefined}
          style={{
            gridRow: row,
            gridColumn: `${gridColumnStart(start)} / span ${length}`,
          }}
          title={openStagesAriaLabel(
            track.label,
            null,
            trackStartIso(track),
            trackEndIso(track),
            statusWord,
          )}
          aria-label={openStagesAriaLabel(
            track.label,
            null,
            trackStartIso(track),
            trackEndIso(track),
            statusWord,
          )}
          onClick={(event) => onOpenStages(track.id, event.currentTarget)}
        />
      )}
    </>
  );
}

export function ProcessRoadmap({
  checklist,
  title = "Timeline",
  showTitle = true,
  dateline,
  subtasks = {},
  projectSteps = [],
  todoEdits = {},
  memberId,
  memberProfiles = [],
  onOpenTodos,
  onToggle,
  onAssignStage,
}: {
  checklist: Record<string, boolean>;
  title?: string;
  showTitle?: boolean;
  dateline?: string;
  /** Live to-do subtasks — when they carry projectId + startDate they drive the modal. */
  subtasks?: TodoSubtaskMap;
  projectSteps?: PersistedProjectStep[];
  todoEdits?: TodoEditMap;
  memberId?: string;
  memberProfiles?: MemberProfile[];
  onOpenTodos?: (projectId: string) => void;
  /** Persist stage completion (checklist key = stage id). */
  onToggle?: (id: string, checked: boolean) => void;
  onAssignStage?: (stage: StageAssignPayload, owner: Owner | null) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const cells = useMemo(() => monthCells(), []);
  const bands = useMemo(() => yearBands(cells), [cells]);
  const nowIndex = currentMonthIndex(now);
  const dayProgress = dayProgressInMonth(now);
  const nowDayLabel = formatNowDay(now);
  const nowMonthLabel = cells[nowIndex]
    ? `${cells[nowIndex].label} ${cells[nowIndex].year}`
    : "";
  const lineLeft = `${dayProgress * 100}%`;

  const bars = ROADMAP_TRACKS.filter((track) => track.kind === "bar");
  const milestones = ROADMAP_TRACKS.filter((track) => track.kind === "milestone");
  const ordered = ROADMAP_TRACKS;
  const lastTrackRow = 2 + ordered.length;

  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const liveStages = useMemo(() => {
    const rows: Array<{
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
    }> = [];
    for (const list of Object.values(subtasks)) {
      for (const row of list) {
        rows.push({
          id: row.id,
          label: row.label,
          startDate: row.startDate,
          endDate: row.endDate,
          dueDate: row.dueDate,
          projectId: row.projectId,
          phase: row.phase,
          isMilestone: row.isMilestone,
          completedAt: row.completedAt,
          done: row.done,
        });
      }
    }
    return rows;
  }, [subtasks]);

  const stageOwners = useMemo(
    () => stageOwnerMap(checklist, projectSteps, todoEdits),
    [checklist, projectSteps, todoEdits],
  );

  function openStages(projectId: string, trigger: HTMLElement) {
    lastFocusRef.current = trigger;
    setOpenProjectId(projectId);
  }

  function closeStages() {
    setOpenProjectId(null);
    window.requestAnimationFrame(() => lastFocusRef.current?.focus());
  }

  return (
    <section className="roadmap" aria-label={title}>
      {showTitle ? (
        <header className="page-head roadmap-head">
          <div>
            {dateline ? <div className="dateline">{dateline}</div> : null}
            <h3 className="dash-title">{title}</h3>
          </div>
          <div className="mono roadmap-meta">
            {bars.length} tasks
            {milestones.length
              ? ` · ${milestones.length} milestone${milestones.length === 1 ? "" : "s"}`
              : ""}{" "}
            · Sep 2026 – Jan 2028
          </div>
        </header>
      ) : null}

      <div className="gantt-scroll">
        <div
          className="gantt"
          role="table"
          aria-label="Application timeline by month"
        >
          {bands.map((band) => (
            <div
              key={band.year}
              className="yr"
              style={{
                gridRow: 1,
                gridColumn: `${gridColumnStart(band.start)} / span ${band.span}`,
              }}
            >
              {band.year}
            </div>
          ))}

          <div className="head-pad" style={{ gridRow: 2, gridColumn: 1 }} />
          {cells.map((cell) => (
            <div
              key={`${cell.year}-${cell.month}`}
              className={cell.index === nowIndex ? "mo mo-now" : "mo"}
              style={{ gridRow: 2, gridColumn: gridColumnStart(cell.index) }}
              {...(cell.quarter ? { "data-q": true } : {})}
              {...(cell.index === nowIndex ? { "aria-current": "date" as const } : {})}
            >
              {cell.label}
            </div>
          ))}

          <div className="gridlines" aria-hidden="true" />
          <div
            className="now"
            style={{
              gridColumn: gridColumnStart(nowIndex),
              gridRow: `1 / ${lastTrackRow + 1}`,
            }}
            aria-hidden="true"
          >
            <span className="now-line" style={{ left: lineLeft }} />
            <span className="now-badge" style={{ left: lineLeft }}>
              <span className="now-badge-label">You are here</span>
              <span className="now-badge-date">{nowDayLabel}</span>
            </span>
          </div>

          {ordered.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              row={3 + index}
              checklist={checklist}
              now={now}
              onOpenStages={openStages}
            />
          ))}
        </div>
      </div>

      <div className="legend">
        <span className="legend-here">
          <i className="swatch now" />
          You are here · {nowDayLabel} · {nowMonthLabel}
        </span>
        <span>
          <i className="swatch bar" />
          In progress
        </span>
        <span>
          <i className="swatch future" />
          Not started
        </span>
        <span>
          <i className="swatch pin" />
          Milestone
        </span>
        <span className="legend-hint">Click a bar to see its stages</span>
      </div>

      {openProjectId ? (
        <TimelineStageModal
          projectId={openProjectId}
          liveStages={liveStages}
          stageCompletions={checklist}
          memberId={memberId}
          memberProfiles={memberProfiles}
          stageOwners={stageOwners}
          onClose={closeStages}
          onSelectProject={setOpenProjectId}
          onOpenTodos={(id) => {
            closeStages();
            onOpenTodos?.(id);
          }}
          onMarkStageDone={
            onToggle
              ? (stageId) => {
                  onToggle(stageId, true);
                }
              : undefined
          }
          onAssignStage={onAssignStage}
        />
      ) : null}
    </section>
  );
}
