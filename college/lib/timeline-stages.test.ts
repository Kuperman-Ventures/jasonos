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

test("checklist completions mark seed stages done without stamping today", () => {
  const open = resolveProjectStages("passion", [], {});
  const pick = open.find((row) => row.id === "passion-s1");
  assert.ok(pick);
  assert.equal(stageStatus(pick!, new Date(2026, 8, 26)), "overdue");

  const closed = resolveProjectStages(
    "passion",
    [{ id: "passion-s1", label: "Pick a cause", startDate: "2026-09-01", endDate: "2026-09-15", dueDate: "2026-09-15", completedAt: "2026-09-10" }],
    { "passion-s1": true },
  );
  const done = closed.find((row) => row.id === "passion-s1");
  assert.equal(done?.completedAt, "2026-09-10");
  assert.equal(stageStatus(done!, new Date(2026, 8, 26)), "done");
  assert.equal(stageStatus(done!, new Date(2026, 9, 5)), "done");
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

test("resolveProjectStages uses an edited to-do's dates and label", () => {
  const seed = stagesForProject("visits").find((row) => row.id === "visits-s1");
  assert.ok(seed);
  const live = resolveProjectStages("visits", [
    {
      id: "visits-s1",
      label: "Tours moved up",
      startDate: "2026-10-05",
      endDate: "2026-10-20",
      dueDate: "2026-10-20",
      completedAt: null,
    },
  ]);
  const row = live.find((item) => item.id === "visits-s1");
  assert.equal(row?.name, "Tours moved up");
  assert.equal(row?.start, "2026-10-05");
  assert.equal(row?.end, "2026-10-20");
  assert.ok(live.length > 1);
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
