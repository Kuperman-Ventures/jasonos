import assert from "node:assert/strict";
import test from "node:test";
import { ROADMAP_TRACKS } from "./roadmap";
import {
  TIMELINE_PROJECTS,
  allTimelineStages,
  buildStageTicks,
  nowLinePosition,
  resolveProjectStages,
  stageBarGeometry,
  stageStatus,
  stagesForProject,
  summarizeStages,
  timelineProjectById,
} from "./timeline-stages";

test("every roadmap bar project has stages", () => {
  const bars = ROADMAP_TRACKS.filter((track) => track.kind === "bar");
  assert.equal(TIMELINE_PROJECTS.length, bars.length);
  const stages = allTimelineStages();
  assert.ok(stages.length >= 40);
  for (const project of TIMELINE_PROJECTS) {
    const rows = stagesForProject(project.id);
    assert.ok(rows.length > 0, `${project.id} missing stages`);
    assert.ok(rows.every((row) => row.projectId === project.id));
  }
});

test("status: past end without confirmation is overdue, not done", () => {
  const today = new Date(2026, 8, 26); // Sep 26 2026
  const stage = {
    id: "x",
    projectId: "visits",
    name: "Virtual tours",
    start: "2026-09-01",
    end: "2026-11-30",
    phase: null,
    isMilestone: false,
    completedAt: null,
  };
  assert.equal(stageStatus(stage, today), "now");
  assert.equal(
    stageStatus({ ...stage, end: "2026-09-01", completedAt: null }, today),
    "overdue",
  );
  assert.equal(
    stageStatus({ ...stage, start: "2027-01-01", end: "2027-01-15" }, today),
    "next",
  );
  assert.equal(
    stageStatus({ ...stage, start: "2027-01-01", end: "2027-01-15", completedAt: "2026-09-01" }, today),
    "done",
  );
  assert.equal(
    stageStatus({ ...stage, end: "2026-09-01", completedAt: "2026-09-20" }, today),
    "done",
  );
});

test("checklist completions mark seed stages done", () => {
  const open = resolveProjectStages("passion", [], {});
  const pick = open.find((row) => row.id === "passion-s1");
  assert.ok(pick);
  assert.equal(stageStatus(pick!, new Date(2026, 8, 26)), "overdue");

  const closed = resolveProjectStages("passion", [], { "passion-s1": true });
  const done = closed.find((row) => row.id === "passion-s1");
  assert.ok(done?.completedAt);
  assert.equal(stageStatus(done!, new Date(2026, 8, 26)), "done");
});

test("essays project uses week ticks", () => {
  const essays = timelineProjectById("essays");
  assert.ok(essays);
  const ticks = buildStageTicks(essays, new Date(2026, 8, 26));
  assert.ok(ticks.length >= 3);
  assert.match(ticks[0]!.label, /Jun/);
  // No tick label should be empty
  assert.ok(ticks.every((tick) => tick.label.trim().length > 0));
});

test("milestones are excluded from stage totals", () => {
  const list = stagesForProject("college-list");
  const summary = summarizeStages(list, new Date(2026, 8, 26));
  const milestones = list.filter((row) => row.isMilestone).length;
  assert.equal(summary.total + milestones, list.length);
});

test("live subtasks with projectId override seed stages", () => {
  const live = resolveProjectStages("visits", [
    {
      id: "live-1",
      label: "Custom visit stage",
      startDate: "2026-10-01",
      endDate: "2026-10-15",
      dueDate: null,
      projectId: "visits",
      phase: null,
      isMilestone: false,
      completedAt: null,
      done: false,
    },
  ]);
  assert.equal(live.length, 1);
  assert.equal(live[0]!.name, "Custom visit stage");
});

test("stage bar geometry is within 0–1 for mid-month stage", () => {
  const project = timelineProjectById("testing")!;
  const stage = stagesForProject("testing").find((row) => row.name === "PSAT/NMSQT");
  assert.ok(stage);
  const geo = stageBarGeometry(stage, project);
  assert.ok(geo.left > 0 && geo.left < 1);
  assert.ok(geo.width > 0);
});

test("now line only when today is inside project window", () => {
  const visits = timelineProjectById("visits")!;
  assert.ok(nowLinePosition(visits, new Date(2026, 10, 1)) != null);
  assert.equal(nowLinePosition(visits, new Date(2028, 0, 1)), null);
});
