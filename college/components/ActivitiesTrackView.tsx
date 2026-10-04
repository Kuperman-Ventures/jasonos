"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIcon } from "./ActivityIcon";
import type { ActivitiesViewId } from "@/lib/apps-materials";
import {
  INTENT_PILLS,
  TRACK_GRADES,
  TRACK_TYPES,
  activityStates,
  activitySpanText,
  applyTrackToJournal,
  answeredCount,
  cellStyle,
  copyTrackNotes,
  gradeHeaders,
  lensesForIntent,
  lensLabel,
  longestActivityStates,
  migrateTrackFromJournal,
  nextBand,
  nowGrade,
  nudgeFor,
  projectStarters,
  questionsFor,
  stageMarks,
  threadLengthBar,
  yearsInStates,
  type ActivitiesTrack,
  type TrackActivity,
  type TrackCell,
  type TrackProject,
  type TrackStageId,
  type TrackType,
} from "@/lib/activities-track";
import { newId as journalNewId, type ActivitiesJournal as Journal } from "@/lib/activities-journal";

const EXPLAINER: {
  n: string;
  title: string;
  goal: string;
  note: string;
  key: TrackStageId;
}[] = [
  {
    n: "1",
    title: "Gather",
    goal: "Get everything you do onto one record.",
    note: "Name each activity and the grade you started.",
    key: "gather",
  },
  {
    n: "2",
    title: "Shape",
    goal: "Group related activities into threads.",
    note: "Rename threads and move activities between them.",
    key: "shape",
  },
  {
    n: "3",
    title: "Plan",
    goal: "Decide the rest of high school, and start a project of your own.",
    note: "Choose what to keep, step up or finish. Sketch a project with an outside partner.",
    key: "plan",
  },
  {
    n: "4",
    title: "Application Prep",
    goal: "Bring what you have built into one place, ready for when you fill out your applications.",
    note: "You write your own answers. Nothing here is written for you.",
    key: "prep",
  },
];

const WHENS = [
  { id: "11" as const, label: "This year (11th)" },
  { id: "12" as const, label: "Senior year (12th)" },
];

function Rib({ states, width, height }: { states: TrackCell[]; width: number; height: number }) {
  return (
    <div className="at-rib">
      {states.map((c, i) => {
        const s = cellStyle(c);
        return (
          <span
            key={i}
            style={{ width, height, background: s.background, border: s.border, boxSizing: "border-box" }}
          />
        );
      })}
    </div>
  );
}

function Icon({ activity, size }: { activity: TrackActivity; size: number }) {
  return (
    <ActivityIcon
      activity={{ name: activity.name, organization: activity.org, icon: activity.icon }}
      size={size}
      className="at-icon"
    />
  );
}

function threadName(track: ActivitiesTrack, id: string | null): string {
  if (!id) return "Not in a thread";
  return track.threads.find((t) => t.id === id)?.name ?? "Not in a thread";
}

type GatherState = {
  step: number;
  name: string;
  start: number | null;
  still: boolean;
  end: number | null;
  threadSel: string | null;
  newThread: string;
};

const EMPTY_GATHER: GatherState = {
  step: 0,
  name: "",
  start: null,
  still: true,
  end: null,
  threadSel: null,
  newThread: "",
};

export function ActivitiesTrackView({
  journal,
  canEdit,
  loaded,
  view,
  onViewChange,
  onChange,
  openActivityId,
  onOpenActivity,
}: {
  journal: Journal;
  canEdit: boolean;
  loaded: boolean;
  view: ActivitiesViewId;
  onViewChange: (view: ActivitiesViewId) => void;
  onChange: (next: Journal) => void;
  openActivityId: string | null;
  onOpenActivity: (id: string | null) => void;
}) {
  const now = nowGrade(journal);
  const track = useMemo(() => {
    const t = migrateTrackFromJournal(journal, now);
    return {
      ...t,
      acts: t.acts.map((a) => {
        const src = journal.activities.find((x) => x.id === a.id);
        if (src?.icon && src.icon !== a.icon) return { ...a, icon: src.icon };
        return a;
      }),
    };
  }, [journal, now]);
  const [explain, setExplain] = useState(false);
  const [toast, setToast] = useState("");
  const [mode, setMode] = useState<"rest" | "project">("rest");
  const [gather, setGather] = useState<GatherState>(EMPTY_GATHER);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState<string | null>(null);
  const [editT, setEditT] = useState<string | null>(null);
  const [fo, setFo] = useState<{ actId: string; qi: number; nudge: string | null; seen: string } | null>(
    null,
  );
  const [comp, setComp] = useState<{
    open: { actId: string; year: 11 | 12 } | null;
    lens: string;
    text: string;
  }>({ open: null, lens: "deeper", text: "" });
  const [projId, setProjId] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(openActivityId);
  const toastTimer = useRef<number | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (openActivityId) setEntryId(openActivityId);
  }, [openActivityId]);

  useEffect(() => {
    if (!loaded || !canEdit || seeded.current) return;
    const existing = journal.track;
    const hasTrackActs =
      existing && typeof existing === "object" && Array.isArray((existing as { acts?: unknown }).acts)
        ? ((existing as { acts: unknown[] }).acts?.length ?? 0) > 0
        : false;
    if (hasTrackActs) {
      seeded.current = true;
      return;
    }
    if (!track.acts.length && !track.threads.length) {
      seeded.current = true;
      return;
    }
    seeded.current = true;
    onChange(applyTrackToJournal(journal, track, now));
  }, [loaded, canEdit, journal, track, now, onChange]);

  function say(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }

  function persist(next: ActivitiesTrack) {
    if (!loaded || !canEdit) return;
    onChange(applyTrackToJournal(journal, next, now));
  }

  function patchAct(id: string, patch: Partial<TrackActivity>) {
    persist({
      ...track,
      acts: track.acts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  }

  function go(next: ActivitiesViewId) {
    setMoveOpen(null);
    onViewChange(next);
    if (next !== "prep") {
      setEntryId(null);
      onOpenActivity(null);
    }
  }

  const marks = stageMarks(track);
  const stages: { id: ActivitiesViewId; label: string; mark: string }[] = [
    { id: "gather", label: "1 Gather", mark: "" },
    { id: "shape", label: "2 Shape", mark: marks.shape },
    { id: "plan", label: "3 Plan", mark: marks.plan },
    { id: "prep", label: "4 Application Prep", mark: marks.prep },
  ];
  const headers = gradeHeaders(now);
  const band = nextBand(track);
  const nChoices = Object.keys(track.intents).length;
  const nProj = track.projects.length;
  const showEntry = view === "prep" && entryId != null && track.acts.some((a) => a.id === entryId);
  const entry = showEntry ? track.acts.find((a) => a.id === entryId) ?? track.acts[0] : null;

  function onBandClick() {
    if (band.go === "shape" || band.go === "prep") go(band.go);
    else if (band.go === "rest") setMode("rest");
    else if (band.go === "project") setMode("project");
    else if (band.go === "copy") copyNotes();
  }

  function copyNotes() {
    const text = copyTrackNotes(track.acts);
    void navigator.clipboard?.writeText(text).catch(() => {});
    say("Copied your notes");
  }

  return (
    <div className="at">
      <div className="at-head">
        <div className="at-title">Activities</div>
        <button type="button" className="at-link at-hint" onClick={() => setExplain((v) => !v)}>
          {explain ? "Hide how this works" : "How this works"}
        </button>
      </div>

      {explain ? (
        <div className="at-explain">
          {EXPLAINER.map((e, i) => {
            const on = e.key === view || (view === "prep" && e.key === "prep");
            return (
              <button
                key={e.key}
                type="button"
                className="at-explain-col"
                onClick={() => go(e.key)}
                style={{
                  background: on ? "var(--color-accent-tint)" : "transparent",
                  boxShadow: on
                    ? "inset 0 3px 0 var(--color-accent)"
                    : "inset 0 1px 0 var(--color-border)",
                }}
              >
                <span
                  className="at-ser"
                  style={{
                    fontSize: 30,
                    lineHeight: 1,
                    color: on ? "var(--text-accent)" : "var(--text-subtle)",
                  }}
                >
                  {e.n}
                </span>
                <div style={{ height: 116, display: "flex", alignItems: "flex-end" }}>
                  {i === 0 ? <ExplainGather /> : null}
                  {i === 1 ? <ExplainShape /> : null}
                  {i === 2 ? <ExplainPlan /> : null}
                  {i === 3 ? <ExplainPrep /> : null}
                </div>
                <div className="at-ser" style={{ fontSize: 20 }}>
                  {e.title}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.4 }}>{e.goal}</div>
                <div className="at-hint" style={{ lineHeight: 1.4 }}>
                  {e.note}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="at-stages">
        {stages.map((s) => (
          <button
            key={s.id}
            type="button"
            className={view === s.id || (s.id === "prep" && showEntry) ? "at-tab on" : "at-tab"}
            onClick={() => go(s.id)}
          >
            {s.label}
            {s.mark}
          </button>
        ))}
      </div>

      {view === "gather" ? (
        <GatherStage
          track={track}
          now={now}
          headers={headers}
          gather={gather}
          setGather={setGather}
          lastAdded={lastAdded}
          canEdit={canEdit}
          onSkip={() => go("shape")}
          onAdd={(next, name, id) => {
            persist(next);
            setLastAdded(id);
            setGather(EMPTY_GATHER);
            say(`${name} added`);
          }}
        />
      ) : null}

      {view === "shape" ? (
        <ShapeStage
          track={track}
          now={now}
          headers={headers}
          canEdit={canEdit}
          moveOpen={moveOpen}
          setMoveOpen={setMoveOpen}
          editT={editT}
          setEditT={setEditT}
          fo={fo}
          setFo={setFo}
          persist={persist}
          patchAct={patchAct}
          say={say}
          onAddActivity={() => go("gather")}
          onContinue={() => go("plan")}
        />
      ) : null}

      {view === "plan" ? (
        <PlanStage
          track={track}
          now={now}
          headers={headers}
          canEdit={canEdit}
          mode={mode}
          setMode={setMode}
          band={band}
          nChoices={nChoices}
          nProj={nProj}
          onBandClick={onBandClick}
          persist={persist}
          say={say}
          comp={comp}
          setComp={setComp}
          projId={projId}
          setProjId={setProjId}
        />
      ) : null}

      {view === "prep" && !showEntry ? (
        <PrepList
          track={track}
          persist={persist}
          onOpen={(id) => {
            setEntryId(id);
            onOpenActivity(id);
          }}
          onCopy={copyNotes}
        />
      ) : null}

      {view === "prep" && entry ? (
        <PrepEntry
          track={track}
          activity={entry}
          now={now}
          canEdit={canEdit}
          patchAct={patchAct}
          persist={persist}
          say={say}
          onBack={() => {
            setEntryId(null);
            onOpenActivity(null);
          }}
          onAdvance={(id) => {
            setEntryId(id);
            onOpenActivity(id);
          }}
        />
      ) : null}

      {toast ? <div className="at-toast">{toast}</div> : null}
    </div>
  );
}

function ExplainGather() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <div className="at-ser" style={{ fontSize: 13, color: "var(--text-muted)" }}>
        What do you do?
      </div>
      <div style={{ fontSize: 14, borderBottom: "2px solid var(--color-accent)", paddingBottom: 2, width: 150 }}>
        Trumpet
      </div>
      <div className="at-rib" style={{ gap: 3 }}>
        {[6, 7, 8].map((g, i) => (
          <span
            key={g}
            className="at-m"
            style={{
              width: 22,
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              letterSpacing: 0,
              background: i === 0 ? "var(--color-text)" : "var(--color-surface)",
              color: i === 0 ? "var(--color-bg)" : "var(--color-text)",
            }}
          >
            {g}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExplainShape() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
        {["Trumpet", "Band", "Robotics"].map((n) => (
          <span key={n} className="at-pill xs">
            {n}
          </span>
        ))}
      </div>
      <span style={{ color: "var(--text-subtle)", fontSize: 18 }}>→</span>
      <div>
        <div className="at-ser" style={{ fontSize: 13, marginBottom: 3 }}>
          Music
        </div>
        <Rib states={["d", "d", "d", "d", "d", "n", "e"]} width={11} height={6} />
        <div style={{ height: 2 }} />
        <Rib states={["e", "e", "e", "d", "d", "n", "e"]} width={11} height={6} />
      </div>
    </div>
  );
}

function ExplainPlan() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <Rib states={["d", "d", "d", "d", "d", "n", "p"]} width={26} height={10} />
      <div style={{ display: "flex", gap: 4 }}>
        <span className="at-pill xs">Keep going</span>
        <span className="at-pill xs on">Step up</span>
        <span className="at-pill xs">Finish</span>
      </div>
      <div
        style={{
          border: "1px dashed var(--color-dash)",
          padding: "6px 9px",
          fontSize: 12,
          lineHeight: 1.35,
          color: "var(--text-muted)",
        }}
      >
        Your own project
        <br />
        with an outside partner
      </div>
    </div>
  );
}

function ExplainPrep() {
  return (
    <div style={{ width: "100%", background: "var(--color-surface)", padding: "9px 12px" }}>
      <div className="at-ser" style={{ fontSize: 14, marginBottom: 2 }}>
        Trumpet
      </div>
      {["Hours and weeks", "Role and group", "Your own notes"].map((l) => (
        <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
          <span style={{ color: "var(--text-muted)" }}>{l}</span>
          <span style={{ color: "var(--text-accent)" }}>✓</span>
        </div>
      ))}
    </div>
  );
}

function GatherStage({
  track,
  now,
  headers,
  gather,
  setGather,
  lastAdded,
  canEdit,
  onSkip,
  onAdd,
}: {
  track: ActivitiesTrack;
  now: number;
  headers: ReturnType<typeof gradeHeaders>;
  gather: GatherState;
  setGather: (g: GatherState) => void;
  lastAdded: string | null;
  canEdit: boolean;
  onSkip: () => void;
  onAdd: (next: ActivitiesTrack, name: string, id: string) => void;
}) {
  const G = gather;
  const q = [
    "What do you do that takes regular time, in school or out?",
    `When did you start ${G.name || "it"}?`,
    "Which thread does it belong to?",
  ][G.step];
  const ex = [
    "For example: an instrument, a sport, a club, a job, caring for family.",
    "Your best guess is fine.",
    "A thread groups things that belong together, like everything you do with music.",
  ][G.step];
  const startGrades = [6, 7, 8, 9, 10, 11].filter((g) => g <= Math.max(now, 11) && g <= 11);
  const endGrades = startGrades.filter((g) => g >= (G.start || 6));
  const noThread = !G.threadSel || (G.threadSel === "__new" && !G.newThread.trim());

  function add() {
    if (!canEdit || !G.name.trim() || !G.start) return;
    const id = journalNewId("activity");
    let tid = G.threadSel;
    let threads = track.threads;
    if (G.threadSel === "__new") {
      tid = journalNewId("thread");
      threads = [...threads, { id: tid, name: G.newThread.trim() }];
    }
    if (G.threadSel === "__none") tid = null;
    const next: ActivitiesTrack = {
      ...track,
      threads,
      acts: [
        ...track.acts,
        {
          id,
          name: G.name.trim(),
          thread: tid,
          start: G.start,
          still: G.still,
          end: G.still ? now : (G.end ?? G.start),
          type: "other",
          answers: {},
          role: "",
          org: "",
          desc: "",
          hours: "",
          weeks: "",
          college: "",
          status: "draft",
        },
      ],
    };
    onAdd(next, G.name.trim(), id);
  }

  const miniBlocks = [
    ...track.threads.map((t) => ({
      thread: t,
      list: track.acts.filter((a) => a.thread === t.id),
    })),
    ...(track.acts.some((a) => !a.thread)
      ? [{ thread: null, list: track.acts.filter((a) => !a.thread) }]
      : []),
  ];

  return (
    <div className="at-gather">
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <span className="at-m">Question {G.step + 1} of 3</span>
        <div className="at-ser" style={{ fontSize: 34, lineHeight: 1.2 }}>
          {q}
        </div>
        <div className="at-hint" style={{ fontSize: 15 }}>
          {ex}
        </div>
        {G.step === 0 ? (
          <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
            <input
              className="at-ul"
              style={{ fontSize: 20 }}
              placeholder="Name it in a few words"
              value={G.name}
              disabled={!canEdit}
              onChange={(e) => setGather({ ...G, name: e.target.value })}
            />
            <button type="button" className="at-btn" disabled={!canEdit || !G.name.trim()} onClick={() => setGather({ ...G, step: 1 })}>
              Next
            </button>
          </div>
        ) : null}
        {G.step === 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="at-rib" style={{ gap: 6 }}>
              {startGrades.map((y) => (
                <button
                  key={y}
                  type="button"
                  className="at-m"
                  disabled={!canEdit}
                  onClick={() => setGather({ ...G, start: y, end: G.still ? null : Math.max(y, G.end || y) })}
                  style={{
                    width: 56,
                    height: 46,
                    border: 0,
                    background: G.start === y ? "var(--color-text)" : "var(--color-surface)",
                    color: G.start === y ? "var(--color-bg)" : "var(--color-text)",
                    cursor: "pointer",
                  }}
                >
                  {y}th
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={G.still ? "at-pill on" : "at-pill"}
                disabled={!canEdit}
                onClick={() => setGather({ ...G, still: true, end: null })}
              >
                Still doing it
              </button>
              <button
                type="button"
                className={!G.still ? "at-pill on" : "at-pill"}
                disabled={!canEdit}
                onClick={() => setGather({ ...G, still: false, end: G.start })}
              >
                I stopped
              </button>
            </div>
            {!G.still ? (
              <div>
                <div className="at-hint" style={{ marginBottom: 6 }}>
                  Last grade
                </div>
                <div className="at-rib" style={{ gap: 6 }}>
                  {endGrades.map((y) => (
                    <button
                      key={y}
                      type="button"
                      className="at-m"
                      disabled={!canEdit}
                      onClick={() => setGather({ ...G, end: y })}
                      style={{
                        width: 56,
                        height: 40,
                        border: 0,
                        background: G.end === y ? "var(--color-text)" : "var(--color-surface)",
                        color: G.end === y ? "var(--color-bg)" : "var(--color-text)",
                        cursor: "pointer",
                      }}
                    >
                      {y}th
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <button
                type="button"
                className="at-btn"
                disabled={!canEdit || !G.start || (!G.still && !G.end)}
                onClick={() => setGather({ ...G, step: 2 })}
              >
                Next
              </button>
              <button type="button" className="at-link" onClick={() => setGather({ ...G, step: 0 })}>
                ← Back
              </button>
            </div>
          </div>
        ) : null}
        {G.step === 2 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                ...track.threads.map((t) => ({ label: t.name, sel: t.id })),
                { label: "A new thread", sel: "__new" },
                { label: "Decide later", sel: "__none" },
              ].map((p) => (
                <button
                  key={p.sel}
                  type="button"
                  className={G.threadSel === p.sel ? "at-pill on" : "at-pill"}
                  disabled={!canEdit}
                  onClick={() => setGather({ ...G, threadSel: p.sel })}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {G.threadSel === "__new" ? (
              <input
                className="at-ul"
                style={{ fontSize: 18, maxWidth: 360 }}
                placeholder="Name the new thread"
                value={G.newThread}
                disabled={!canEdit}
                onChange={(e) => setGather({ ...G, newThread: e.target.value })}
              />
            ) : null}
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <button type="button" className="at-btn" disabled={!canEdit || noThread} onClick={add}>
                Add to my record
              </button>
              <button type="button" className="at-link" onClick={() => setGather({ ...G, step: 1 })}>
                ← Back
              </button>
            </div>
          </div>
        ) : null}
        <div style={{ marginTop: 8 }}>
          <button type="button" className="at-link" onClick={onSkip}>
            Skip the questions and shape my threads
          </button>
        </div>
      </div>
      <div>
        <div className="at-m" style={{ marginBottom: 10 }}>
          Your record
        </div>
        <div className="at-rib" style={{ marginBottom: 6 }}>
          {headers.map((g) => (
            <span
              key={g.n}
              className="at-m"
              style={{ width: 24, textAlign: "center", letterSpacing: "0.04em", fontSize: 10, color: g.fg }}
            >
              {g.l}
            </span>
          ))}
        </div>
        {miniBlocks.map(({ thread, list }) => {
          const hl = list.some((a) => a.id === lastAdded);
          const len = list.length
            ? Math.max(...list.map((a) => yearsInStates(activityStates(a, track.plans, track.intents, now))))
            : 0;
          return (
            <div
              key={thread?.id ?? "loose"}
              style={{
                padding: "12px 8px",
                margin: "0 -8px",
                background: hl ? "var(--color-accent-tint)" : "transparent",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span
                  className="at-ser"
                  style={{ fontSize: 20, color: thread ? "var(--color-text)" : "var(--text-muted)" }}
                >
                  {thread ? thread.name : "Not in a thread"}
                </span>
                <span className="at-m" style={{ color: "var(--color-text)" }}>
                  {list.length ? `${len} yrs` : ""}
                </span>
              </div>
              {list.map((a) => (
                <div key={a.id}>
                  <div style={{ marginTop: 8 }}>
                    <Rib states={activityStates(a, track.plans, track.intents, now)} width={24} height={6} />
                  </div>
                  <div className="at-hint" style={{ fontSize: 12, marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
                    <Icon activity={a} size={14} />
                    {a.name}
                    {a.id === lastAdded ? "  ·  new" : ""}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShapeStage({
  track,
  now,
  headers,
  canEdit,
  moveOpen,
  setMoveOpen,
  editT,
  setEditT,
  fo,
  setFo,
  persist,
  patchAct,
  say,
  onAddActivity,
  onContinue,
}: {
  track: ActivitiesTrack;
  now: number;
  headers: ReturnType<typeof gradeHeaders>;
  canEdit: boolean;
  moveOpen: string | null;
  setMoveOpen: (id: string | null) => void;
  editT: string | null;
  setEditT: (id: string | null) => void;
  fo: { actId: string; qi: number; nudge: string | null; seen: string } | null;
  setFo: (v: { actId: string; qi: number; nudge: string | null; seen: string } | null) => void;
  persist: (next: ActivitiesTrack) => void;
  patchAct: (id: string, patch: Partial<TrackActivity>) => void;
  say: (m: string) => void;
  onAddActivity: () => void;
  onContinue: () => void;
}) {
  const loose = track.acts.filter((a) => !a.thread);
  const blocks: { thread: { id: string; name: string } | null; list: TrackActivity[] }[] = [
    ...(loose.length ? [{ thread: null, list: loose }] : []),
    ...track.threads.map((t) => ({ thread: t, list: track.acts.filter((a) => a.thread === t.id) })),
  ];

  return (
    <div>
      <div style={{ maxWidth: 660 }}>
        <h2 className="at-ser" style={{ margin: 0, fontSize: 40 }}>
          Shape
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5, color: "var(--text-muted)" }}>
          A thread groups activities that belong together. Use Edit thread to rename or remove a thread. Type in an
          activity name to rename it. Use Move to put an activity in a different thread.
        </p>
      </div>
      <div className="at-shape-grid" style={{ marginTop: 34 }}>
        <span />
        <div className="at-rib">
          {headers.map((g) => (
            <span
              key={g.n}
              style={{ width: 56, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
            >
              <span className="at-ser" style={{ fontSize: 26, lineHeight: 1, fontWeight: 600, color: g.num }}>
                {g.n}
              </span>
              <span className="at-m" style={{ fontSize: 9, height: 12, color: "var(--text-accent)" }}>
                {g.tag}
              </span>
            </span>
          ))}
        </div>
      </div>
      {blocks.map(({ thread, list }) => {
        const best = longestActivityStates(list, track.plans, track.intents, now);
        const bar = best ? threadLengthBar(best) : null;
        return (
          <div
            key={thread?.id ?? "loose"}
            className="at-block"
            style={{ background: thread ? "transparent" : "var(--color-accent-tint)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h3
                className="at-ser"
                style={{ margin: 0, fontSize: 28, color: thread ? undefined : "var(--text-muted)" }}
              >
                {thread ? thread.name : "Not in a thread"}
              </h3>
              <div className="at-hint">
                {thread
                  ? list.length
                    ? `${list.length} ${list.length === 1 ? "activity" : "activities"}`
                    : "Empty"
                  : `${list.length} ${list.length === 1 ? "activity" : "activities"} to place`}
              </div>
              {thread ? (
                <button
                  type="button"
                  className="at-link at-hint"
                  style={{ alignSelf: "flex-start", fontSize: 14 }}
                  onClick={() => setEditT(editT === thread.id ? null : thread.id)}
                >
                  {editT === thread.id ? "Close" : "Edit thread"}
                </button>
              ) : null}
              {thread && editT === thread.id ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    padding: "14px 16px",
                    background: "var(--color-surface)",
                  }}
                >
                  <input
                    className="at-ul"
                    value={thread.name}
                    disabled={!canEdit}
                    onChange={(e) =>
                      persist({
                        ...track,
                        threads: track.threads.map((x) => (x.id === thread.id ? { ...x, name: e.target.value } : x)),
                      })
                    }
                  />
                  <div className="at-hint" style={{ lineHeight: 1.4 }}>
                    Removing a thread keeps all its activities. They simply stay unassigned.
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      className="at-btn2 sm"
                      disabled={!canEdit}
                      onClick={() => {
                        persist({
                          ...track,
                          threads: track.threads.filter((x) => x.id !== thread.id),
                          acts: track.acts.map((x) => (x.thread === thread.id ? { ...x, thread: null } : x)),
                        });
                        setEditT(null);
                        say(`${thread.name} removed. Its activities are loose.`);
                      }}
                    >
                      Remove thread
                    </button>
                    <button type="button" className="at-btn sm" onClick={() => setEditT(null)}>
                      Done
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div>
              {thread && bar && list.length ? (
                <div className="at-lenbar" style={{ marginLeft: bar.left, width: bar.width }}>
                  {bar.years} {bar.years === 1 ? "year" : "years"}
                </div>
              ) : null}
              {list.length === 0 && thread ? (
                <div className="at-hint" style={{ padding: "6px 0" }}>
                  No activities yet. Use Move on an activity to put it here.
                </div>
              ) : null}
              {list.map((a) => (
                <ShapeLane
                  key={a.id}
                  activity={a}
                  track={track}
                  now={now}
                  canEdit={canEdit}
                  cur={thread?.id ?? null}
                  moveOpen={moveOpen === a.id}
                  fo={fo?.actId === a.id ? fo : null}
                  setMoveOpen={setMoveOpen}
                  setFo={setFo}
                  persist={persist}
                  patchAct={patchAct}
                  say={say}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginTop: 18,
          paddingTop: 20,
          borderTop: "1px dashed var(--color-dash)",
        }}
      >
        <button
          type="button"
          className="at-btn2"
          disabled={!canEdit}
          onClick={() => {
            persist({
              ...track,
              threads: [...track.threads, { id: journalNewId("thread"), name: "New thread" }],
            });
            say("New thread added. Type to rename it.");
          }}
        >
          + New thread
        </button>
        <button type="button" className="at-link" onClick={onAddActivity}>
          + Add an activity
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="at-btn" onClick={onContinue}>
          Continue to Plan
        </button>
      </div>
    </div>
  );
}

function ShapeLane({
  activity,
  track,
  now,
  canEdit,
  cur,
  moveOpen,
  fo,
  setMoveOpen,
  setFo,
  persist,
  patchAct,
  say,
}: {
  activity: TrackActivity;
  track: ActivitiesTrack;
  now: number;
  canEdit: boolean;
  cur: string | null;
  moveOpen: boolean;
  fo: { actId: string; qi: number; nudge: string | null; seen: string } | null;
  setMoveOpen: (id: string | null) => void;
  setFo: (v: { actId: string; qi: number; nudge: string | null; seen: string } | null) => void;
  persist: (next: ActivitiesTrack) => void;
  patchAct: (id: string, patch: Partial<TrackActivity>) => void;
  say: (m: string) => void;
}) {
  const a = activity;
  const sts = activityStates(a, track.plans, track.intents, now);
  const yrs = yearsInStates(sts);
  const qs = questionsFor(a, now);
  const answered = answeredCount(a, now);
  const qi = fo ? Math.min(fo.qi, Math.max(0, qs.length - 1)) : 0;
  const q = qs[qi];
  const ans = a.answers ?? {};
  const text = q ? (ans[q.id] ?? "") : "";
  const labels = [...new Set(qs.map((x) => x.layer))];

  function moveTo(tid: string | null, label: string) {
    persist({
      ...track,
      acts: track.acts.map((x) => (x.id === a.id ? { ...x, thread: tid } : x)),
    });
    setMoveOpen(null);
    say(`${a.name} moved to ${label}`);
  }

  return (
    <div style={{ marginTop: 20 }}>
      <Rib states={sts} width={56} height={12} />
      <div className="at-lane-meta">
        <Icon activity={a} size={24} />
        <div style={{ minWidth: 0 }}>
          <input
            className="at-nm"
            style={{ fontSize: 16, fontWeight: 600, width: "100%" }}
            value={a.name}
            disabled={!canEdit}
            onChange={(e) => patchAct(a.id, { name: e.target.value })}
          />
          <div className="at-hint" style={{ marginTop: 1 }}>
            {yrs} {yrs === 1 ? "yr" : "yrs"} · Since {a.start}th grade · {activitySpanText(a)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="at-pill sm"
            onClick={() => setMoveOpen(moveOpen ? null : a.id)}
          >
            {moveOpen ? "Close" : "Move"}
          </button>
          <button
            type="button"
            className="at-pill sm"
            onClick={() => setFo(fo ? null : { actId: a.id, qi: 0, nudge: null, seen: "" })}
          >
            {fo ? "Close" : answered ? `Add detail · ${answered} answered` : "Add detail"}
          </button>
        </div>
      </div>
      {moveOpen ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
          <span className="at-hint">Move to</span>
          {track.threads
            .filter((t) => t.id !== cur)
            .map((t) => (
              <button key={t.id} type="button" className="at-pill sm" disabled={!canEdit} onClick={() => moveTo(t.id, t.name)}>
                {t.name}
              </button>
            ))}
          {cur ? (
            <button type="button" className="at-pill sm" disabled={!canEdit} onClick={() => moveTo(null, "no thread")}>
              No thread
            </button>
          ) : null}
          <button
            type="button"
            className="at-pill sm"
            disabled={!canEdit}
            onClick={() => {
              const tid = journalNewId("thread");
              persist({
                ...track,
                threads: [...track.threads, { id: tid, name: "New thread" }],
                acts: track.acts.map((x) => (x.id === a.id ? { ...x, thread: tid } : x)),
              });
              setMoveOpen(null);
              say("New thread created. Type to rename it.");
            }}
          >
            + New thread
          </button>
        </div>
      ) : null}
      {fo && q ? (
        <div
          style={{
            marginTop: 14,
            padding: "22px 24px",
            background: "var(--color-surface)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            maxWidth: 640,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="at-hint">Add extra questions about</span>
            <select
              value={a.type}
              disabled={!canEdit}
              onChange={(e) => patchAct(a.id, { type: e.target.value as TrackType })}
            >
              {TRACK_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {labels.map((l) => (
              <div key={l} style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "flex-start" }}>
                <button
                  type="button"
                  className={l === q.layer ? "at-tab on" : "at-tab"}
                  style={{ fontSize: 10, padding: 0, boxShadow: "none", color: l === q.layer ? "var(--text-accent)" : "var(--text-muted)" }}
                  onClick={() => setFo({ ...fo, qi: qs.findIndex((x) => x.layer === l), nudge: null })}
                >
                  {l}
                </button>
                <div style={{ display: "flex", gap: 5 }}>
                  {qs.map((x, i) => (x.layer === l ? { x, i } : null)).filter((o): o is { x: typeof q; i: number } => Boolean(o)).map((o) => {
                    const done = (ans[o.x.id] ?? "").trim();
                    return (
                      <button
                        key={o.x.id}
                        type="button"
                        className={done ? "at-dot done" : "at-dot"}
                        onClick={() => setFo({ ...fo, qi: o.i, nudge: null })}
                        style={{
                          boxShadow: o.i === qi ? "0 0 0 2px var(--color-bg), 0 0 0 3px var(--color-text)" : "none",
                        }}
                        aria-label={o.x.q}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <span className="at-m" style={{ color: "var(--text-accent)" }}>
            Question {qi + 1} of {qs.length}
          </span>
          <div className="at-ser" style={{ fontSize: 24, lineHeight: 1.25 }}>
            {q.q}
          </div>
          <div className="at-hint">For example: {q.ex}</div>
          <textarea
            className="at-ul"
            rows={3}
            style={{ background: "transparent" }}
            placeholder="A phrase is fine. You can come back to it."
            value={text}
            disabled={!canEdit}
            onChange={(e) => {
              patchAct(a.id, { answers: { ...ans, [q.id]: e.target.value } });
              if (fo.nudge) setFo({ ...fo, nudge: null });
            }}
          />
          {fo.nudge ? (
            <div style={{ fontSize: 14, color: "var(--text-accent)" }}>
              {fo.nudge}{" "}
              <button type="button" className="at-link at-hint" onClick={() => setFo({ ...fo, nudge: null })}>
                Dismiss
              </button>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <button
              type="button"
              className="at-btn"
              onClick={() => {
                const nx = nudgeFor(q, text);
                const key = `${a.id}:${q.id}:${nx || ""}`;
                if (nx && fo.seen !== key) {
                  setFo({ ...fo, nudge: nx, seen: key });
                  return;
                }
                if (qi >= qs.length - 1) {
                  setFo(null);
                  say(`Saved to ${a.name}`);
                } else setFo({ ...fo, qi: qi + 1, nudge: null });
              }}
            >
              {!text.trim() ? "Skip" : fo.nudge ? "Continue anyway" : qi === qs.length - 1 ? "Done" : "Next"}
            </button>
            {qi > 0 ? (
              <button type="button" className="at-link" onClick={() => setFo({ ...fo, qi: qi - 1, nudge: null })}>
                ← Back
              </button>
            ) : null}
            <span className="at-hint" style={{ marginLeft: "auto" }}>
              Saves as you type. Every question can be skipped.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlanStage({
  track,
  now,
  headers,
  canEdit,
  mode,
  setMode,
  band,
  nChoices,
  nProj,
  onBandClick,
  persist,
  say,
  comp,
  setComp,
  projId,
  setProjId,
}: {
  track: ActivitiesTrack;
  now: number;
  headers: ReturnType<typeof gradeHeaders>;
  canEdit: boolean;
  mode: "rest" | "project";
  setMode: (m: "rest" | "project") => void;
  band: ReturnType<typeof nextBand>;
  nChoices: number;
  nProj: number;
  onBandClick: () => void;
  persist: (next: ActivitiesTrack) => void;
  say: (m: string) => void;
  comp: { open: { actId: string; year: 11 | 12 } | null; lens: string; text: string };
  setComp: (c: { open: { actId: string; year: 11 | 12 } | null; lens: string; text: string }) => void;
  projId: string | null;
  setProjId: (id: string | null) => void;
}) {
  const modes = [
    {
      id: "rest" as const,
      kicker: "Mode 1 · What you already do",
      title: "The rest of high school",
      sub: "Decide what to do with each of your activities in 11th and 12th grade.",
      status: nChoices ? `${nChoices} ${nChoices === 1 ? "choice made" : "choices made"}` : "Not started",
    },
    {
      id: "project" as const,
      kicker: "Mode 2 · Something new",
      title: "A project of your own",
      sub: "Start something yourself, with a partner outside your school.",
      status: nProj ? `${nProj} ${nProj === 1 ? "idea" : "ideas"}` : "No ideas yet",
    },
  ];
  const P = track.projects.find((p) => p.id === projId) ?? track.projects[0];
  const activeProj = P && (projId === P.id || !projId) ? P : null;
  const starters = projectStarters(track.threads);

  function mkProject(title = "") {
    if (!canEdit) return;
    const id = journalNewId("idea");
    persist({
      ...track,
      projects: [...track.projects, { id, title, partner: "", outcome: "", when: "", why: "" }],
    });
    setProjId(id);
  }

  function updProj(id: string, patch: Partial<TrackProject>) {
    persist({
      ...track,
      projects: track.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  return (
    <div>
      <div
        style={{
          padding: "22px 26px",
          background: "var(--color-accent-tint)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 30,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 620 }}>
          <span className="at-m" style={{ color: "var(--text-on-tint)" }}>
            {band.kicker}
          </span>
          <div className="at-ser" style={{ fontSize: 24, lineHeight: 1.25, color: "var(--text-on-tint)" }}>
            {band.text}
          </div>
        </div>
        <button type="button" className="at-btn" style={{ flex: "none" }} onClick={onBandClick}>
          {band.btn}
        </button>
      </div>
      <div className="at-modes">
        {modes.map((m) => {
          const on = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              className="at-mode"
              onClick={() => setMode(m.id)}
              style={{
                background: on ? "var(--color-accent-tint)" : "transparent",
                boxShadow: on ? "inset 0 4px 0 var(--color-accent)" : "inset 0 1px 0 var(--color-border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "4px 16px" }}>
                <span className="at-m" style={{ color: on ? "var(--text-accent)" : "var(--text-subtle)" }}>
                  {m.kicker}
                </span>
                <span className="at-m" style={{ color: "var(--text-subtle)" }}>
                  {m.status}
                </span>
              </div>
              <div className="at-ser" style={{ fontSize: 28, lineHeight: 1.1 }}>
                {m.title}
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.4, color: "var(--text-muted)" }}>{m.sub}</div>
              <div style={{ height: 76, display: "flex", alignItems: "flex-end" }}>
                {m.id === "rest" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Rib states={["d", "d", "d", "d", "d", "n", "p"]} width={26} height={10} />
                    <Rib states={["e", "e", "e", "d", "d", "n", "p"]} width={26} height={10} />
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <span className="at-pill xs">Keep going</span>
                      <span className="at-pill xs on">Step up</span>
                      <span className="at-pill xs">Finish</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {["Idea", "Partner", "Result"].map((lab, i) => (
                      <span key={lab} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {i > 0 ? <span style={{ width: 16, borderTop: "2px dashed var(--color-accent-border)" }} /> : null}
                        <span className="at-pill xs" style={{ borderStyle: "dashed" }}>
                          {lab}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {mode === "rest" ? (
        <div style={{ marginTop: 34 }}>
          <div className="at-m" style={{ color: "var(--text-accent)", marginBottom: 8 }}>
            Mode 1 · What you already do
          </div>
          <h2 className="at-ser" style={{ margin: 0, fontSize: 40 }}>
            The rest of high school
          </h2>
          <p style={{ margin: "8px 0 0", maxWidth: 640, fontSize: 16, lineHeight: 1.5, color: "var(--text-muted)" }}>
            You have this year and senior year. For each activity, choose what you want to do in each year. If you keep
            going or step up, add steps that would make it stronger.
          </p>
          <div className="at-shape-grid" style={{ marginTop: 30, paddingBottom: 8, gridTemplateColumns: "260px 1fr 1fr", gap: 26 }}>
            <span />
            <span className="at-m" style={{ color: "var(--text-accent)" }}>
              11th grade · now
            </span>
            <span className="at-m">12th grade</span>
          </div>
          {track.acts.map((a) => (
            <div key={a.id} className="at-rw at-rest-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 17, display: "flex", gap: 10, alignItems: "center" }}>
                  <Icon activity={a} size={22} />
                  {a.name}
                </div>
                <div className="at-hint" style={{ margin: "2px 0 8px 32px" }}>
                  {threadName(track, a.thread)}
                </div>
                <Rib states={activityStates(a, track.plans, track.intents, now)} width={20} height={10} />
              </div>
              <PlanCell
                activity={a}
                year={11}
                track={track}
                canEdit={canEdit}
                comp={comp}
                setComp={setComp}
                persist={persist}
                say={say}
              />
              <PlanCell
                activity={a}
                year={12}
                track={track}
                canEdit={canEdit}
                comp={comp}
                setComp={setComp}
                persist={persist}
                say={say}
              />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 34, padding: "30px 34px 36px", background: "var(--color-raised)", boxShadow: "var(--shadow-sm)" }}>
          <div className="at-m" style={{ color: "var(--text-accent)", marginBottom: 8 }}>
            Mode 2 · Something new
          </div>
          <h2 className="at-ser" style={{ margin: 0, fontSize: 40 }}>
            A project of your own
          </h2>
          <p style={{ margin: "8px 0 0", maxWidth: 660, fontSize: 16, lineHeight: 1.5, color: "var(--text-muted)" }}>
            Colleges notice what you start, not only what you join. A self-started project is something you organize
            yourself, with a partner outside your school. It can come from anything you care about.
          </p>
          <div className="at-proj">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="at-m" style={{ marginBottom: 6 }}>
                Your ideas
              </div>
              {track.projects.length === 0 ? (
                <div className="at-hint" style={{ fontSize: 14, lineHeight: 1.5 }}>
                  Nothing yet. Pick a starter or begin with your own idea.
                </div>
              ) : null}
              {track.projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProjId(p.id)}
                  style={{
                    textAlign: "left",
                    border: 0,
                    background: (projId ?? activeProj?.id) === p.id ? "var(--color-accent-tint)" : "transparent",
                    padding: 12,
                    cursor: "pointer",
                    font: "inherit",
                    color: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{p.title || "Untitled idea"}</span>
                  <span className="at-hint">{p.when ? `Planned for ${p.when}th grade` : "No date yet"}</span>
                </button>
              ))}
              <div style={{ marginTop: 10 }}>
                <button type="button" className="at-btn2" disabled={!canEdit} onClick={() => mkProject("")}>
                  + New idea
                </button>
              </div>
              <div style={{ marginTop: 22 }} className="at-m">
                Not sure where to start?
              </div>
              {starters.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="at-link"
                  style={{ fontSize: 14, lineHeight: 1.4, textDecoration: "none", textAlign: "left" }}
                  disabled={!canEdit}
                  onClick={() => mkProject(t)}
                >
                  + {t}
                </button>
              ))}
            </div>
            <div>
              {activeProj ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 26, maxWidth: 640 }}>
                  <div>
                    <div className="at-m" style={{ marginBottom: 4 }}>
                      The idea in a few words
                    </div>
                    <input
                      className="at-ul"
                      style={{ fontSize: 20 }}
                      placeholder="e.g. Teach beginners to build their first robot"
                      value={activeProj.title}
                      disabled={!canEdit}
                      onChange={(e) => updProj(activeProj.id, { title: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className="at-m" style={{ marginBottom: 4 }}>
                      Who outside your school could be your partner?
                    </div>
                    <input
                      className="at-ul"
                      placeholder="A library, a business, a nonprofit, a mentor"
                      value={activeProj.partner}
                      disabled={!canEdit}
                      onChange={(e) => updProj(activeProj.id, { partner: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className="at-m" style={{ marginBottom: 4 }}>
                      What will exist at the end, and who will see it?
                    </div>
                    <input
                      className="at-ul"
                      placeholder="A workshop, a show, a website, a donation total"
                      value={activeProj.outcome}
                      disabled={!canEdit}
                      onChange={(e) => updProj(activeProj.id, { outcome: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className="at-m" style={{ marginBottom: 8 }}>
                      When could you do it?
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {WHENS.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          className={activeProj.when === w.id ? "at-pill on" : "at-pill"}
                          disabled={!canEdit}
                          onClick={() => updProj(activeProj.id, { when: activeProj.when === w.id ? "" : w.id })}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="at-m" style={{ marginBottom: 4 }}>
                      Why does it matter to you?
                    </div>
                    <textarea
                      className="at-ul"
                      rows={2}
                      placeholder="In your own words"
                      value={activeProj.why}
                      disabled={!canEdit}
                      onChange={(e) => updProj(activeProj.id, { why: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className="at-rib" style={{ marginBottom: 6 }}>
                      {headers.map((g) => (
                        <span
                          key={g.n}
                          className="at-m"
                          style={{ width: 44, textAlign: "center", fontSize: 10, letterSpacing: "0.04em", color: g.fg }}
                        >
                          {g.l}
                        </span>
                      ))}
                    </div>
                    <Rib
                      states={TRACK_GRADES.map((y) => (activeProj.when && String(y) === activeProj.when ? "p" : "e"))}
                      width={44}
                      height={18}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                    <span className="at-hint">
                      {[activeProj.title, activeProj.partner, activeProj.outcome, activeProj.when].filter(Boolean).length} of 4
                      parts filled in
                    </span>
                    <button
                      type="button"
                      className="at-link at-hint"
                      disabled={!canEdit}
                      onClick={() => {
                        persist({ ...track, projects: track.projects.filter((p) => p.id !== activeProj.id) });
                        setProjId(null);
                        say("Idea removed");
                      }}
                    >
                      Remove this idea
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCell({
  activity,
  year,
  track,
  canEdit,
  comp,
  setComp,
  persist,
  say,
}: {
  activity: TrackActivity;
  year: 11 | 12;
  track: ActivitiesTrack;
  canEdit: boolean;
  comp: { open: { actId: string; year: 11 | 12 } | null; lens: string; text: string };
  setComp: (c: { open: { actId: string; year: 11 | 12 } | null; lens: string; text: string }) => void;
  persist: (next: ActivitiesTrack) => void;
  say: (m: string) => void;
}) {
  const a = activity;
  const it = track.intents[`${a.id}:${year}`];
  const on = !!(comp.open && comp.open.actId === a.id && comp.open.year === year);
  const set = lensesForIntent(it);
  const cur = set.find((l) => l.id === comp.lens) ?? set[0]!;
  const steps = track.plans.filter((p) => p.actId === a.id && p.year === year);
  const mode = INTENT_PILLS.find((p) => p.id === it)?.mode ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {INTENT_PILLS.map((i) => (
          <button
            key={i.id}
            type="button"
            className={it === i.id ? "at-pill sm on" : "at-pill sm"}
            style={{ padding: "0 11px" }}
            disabled={!canEdit}
            onClick={() => {
              const k = `${a.id}:${year}`;
              const ni = { ...track.intents };
              if (ni[k] === i.id) delete ni[k];
              else ni[k] = i.id;
              persist({ ...track, intents: ni });
            }}
          >
            {i.label}
          </button>
        ))}
      </div>
      {steps.map((p) => (
        <div key={p.id} style={{ fontSize: 14, lineHeight: 1.4 }}>
          <span className="at-m" style={{ letterSpacing: "0.06em", color: "var(--text-accent)" }}>
            {lensLabel(p.lens)}
          </span>{" "}
          {p.text}{" "}
          <button
            type="button"
            className="at-x"
            disabled={!canEdit}
            onClick={() => persist({ ...track, plans: track.plans.filter((x) => x.id !== p.id) })}
          >
            ×
          </button>
        </div>
      ))}
      {it && !on ? (
        <button
          type="button"
          className="at-link"
          style={{ fontSize: 14, alignSelf: "flex-start" }}
          onClick={() => setComp({ ...comp, open: { actId: a.id, year }, lens: set[0]!.id, text: "" })}
        >
          + Add a step
        </button>
      ) : null}
      {!it ? <span className="at-hint">Choose one to add steps</span> : null}
      {on ? (
        <div
          style={{
            padding: "14px 16px",
            background: "var(--color-surface)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <span className="at-m" style={{ color: "var(--text-accent)" }}>
            {mode}
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {set.map((l) => (
              <button
                key={l.id}
                type="button"
                className={l.id === cur.id ? "at-pill xs on" : "at-pill xs"}
                onClick={() => setComp({ ...comp, lens: l.id })}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="at-ser" style={{ fontSize: 18, lineHeight: 1.25 }}>
            {cur.q}
          </div>
          <div className="at-hint">{cur.ex}</div>
          <input
            className="at-ul"
            style={{ background: "transparent" }}
            placeholder="Write your idea"
            value={comp.text}
            disabled={!canEdit}
            onChange={(e) => setComp({ ...comp, text: e.target.value })}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              type="button"
              className="at-btn sm"
              disabled={!canEdit || !comp.text.trim()}
              onClick={() => {
                persist({
                  ...track,
                  plans: [
                    ...track.plans,
                    { id: journalNewId("plan"), actId: a.id, year, lens: cur.id, text: comp.text.trim() },
                  ],
                });
                setComp({ ...comp, open: null, text: "" });
                say("Step added");
              }}
            >
              Add step
            </button>
            <button type="button" className="at-link" onClick={() => setComp({ ...comp, open: null, text: "" })}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PrepList({
  track,
  persist,
  onOpen,
  onCopy,
}: {
  track: ActivitiesTrack;
  persist: (next: ActivitiesTrack) => void;
  onOpen: (id: string) => void;
  onCopy: () => void;
}) {
  const ready = track.acts.filter((a) => a.status === "ready").length;
  return (
    <div style={{ maxWidth: 780 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
        <div>
          <h2 className="at-ser" style={{ margin: 0, fontSize: 40 }}>
            Application Prep
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 16, color: "var(--text-muted)" }}>
            {ready} of {track.acts.length} activities prepared. Gather what you have built here so it is on hand when you
            fill out your applications. Everything is your own words and facts. Nothing here is written for you.
          </p>
        </div>
        <button type="button" className="at-btn2" onClick={onCopy}>
          Copy my notes
        </button>
      </div>
      <div style={{ marginTop: 24 }}>
        {track.acts.map((a, i) => (
          <div key={a.id} className="at-rw at-prep-row">
            <span className="at-m">{i + 1}</span>
            <button
              type="button"
              onClick={() => onOpen(a.id)}
              style={{
                cursor: "pointer",
                display: "grid",
                gridTemplateColumns: "28px 1fr",
                columnGap: 12,
                alignItems: "center",
                border: 0,
                background: "transparent",
                font: "inherit",
                color: "inherit",
                textAlign: "left",
                padding: 0,
              }}
            >
              <span style={{ gridRow: "1 / 3" }}>
                <Icon activity={a} size={24} />
              </span>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{a.name}</div>
              <div className="at-hint">{threadName(track, a.thread)}</div>
            </button>
            <span style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                className="at-pill"
                style={{ width: 28, height: 28, padding: 0 }}
                disabled={i === 0}
                onClick={() => {
                  if (i === 0) return;
                  const acts = [...track.acts];
                  [acts[i - 1], acts[i]] = [acts[i]!, acts[i - 1]!];
                  persist({ ...track, acts });
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="at-pill"
                style={{ width: 28, height: 28, padding: 0 }}
                disabled={i === track.acts.length - 1}
                onClick={() => {
                  if (i >= track.acts.length - 1) return;
                  const acts = [...track.acts];
                  [acts[i + 1], acts[i]] = [acts[i]!, acts[i + 1]!];
                  persist({ ...track, acts });
                }}
              >
                ↓
              </button>
            </span>
            <span
              className="at-m"
              style={{ letterSpacing: "0.06em", color: a.status === "ready" ? "var(--text-done)" : "var(--text-subtle)" }}
            >
              {a.status === "ready" ? "Prepared" : "In progress"}
            </span>
            <button type="button" className="at-link" onClick={() => onOpen(a.id)}>
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrepEntry({
  track,
  activity,
  now,
  canEdit,
  patchAct,
  persist,
  say,
  onBack,
  onAdvance,
}: {
  track: ActivitiesTrack;
  activity: TrackActivity;
  now: number;
  canEdit: boolean;
  patchAct: (id: string, patch: Partial<TrackActivity>) => void;
  persist: (next: ActivitiesTrack) => void;
  say: (m: string) => void;
  onBack: () => void;
  onAdvance: (id: string) => void;
}) {
  const A = activity;
  const idx = track.acts.findIndex((x) => x.id === A.id);
  const ready = A.status === "ready";
  const miss = [!A.hours && "hours a week", !A.weeks && "weeks a year", !A.desc.trim() && "some notes"].filter(Boolean);
  const qs = questionsFor(A, now);
  const aans = A.answers ?? {};
  const steps = [
    ...track.plans
      .filter((p) => p.actId === A.id)
      .map((p) => ({ lens: `${lensLabel(p.lens)} · ${p.year}th`, text: p.text })),
    ...qs.filter((q) => (aans[q.id] ?? "").trim()).map((q) => ({ lens: `${q.layer} ·`, text: aans[q.id] })),
  ];
  const span = `${A.start}th–${A.still ? now : A.end}th grade${A.hours ? `, ${A.hours} hours a week` : ""}${A.weeks ? `, ${A.weeks} weeks a year` : ""}.`;

  return (
    <div style={{ maxWidth: 780, display: "flex", flexDirection: "column", gap: 26 }}>
      <div>
        <button type="button" className="at-link" style={{ fontSize: 14 }} onClick={onBack}>
          ← Application Prep
        </button>
        <div className="at-m" style={{ marginTop: 12 }}>
          Activity {idx + 1} of {track.acts.length} · {ready ? "Prepared" : "In progress"}
        </div>
        <h2 className="at-ser" style={{ margin: "6px 0 8px", fontSize: 44, display: "flex", gap: 16, alignItems: "center" }}>
          <Icon activity={A} size={40} />
          {A.name}
        </h2>
        <div className="at-ser" style={{ fontSize: 20, lineHeight: 1.5, color: "var(--text-muted)" }}>
          {span}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
        <div>
          <div className="at-m" style={{ marginBottom: 4 }}>
            Hours a week
          </div>
          <input
            className="at-ul"
            value={A.hours}
            placeholder="e.g. 6"
            disabled={!canEdit}
            onChange={(e) => patchAct(A.id, { hours: e.target.value.replace(/\D/g, ""), status: "draft" })}
          />
        </div>
        <div>
          <div className="at-m" style={{ marginBottom: 4 }}>
            Weeks a year
          </div>
          <input
            className="at-ul"
            value={A.weeks}
            placeholder="e.g. 36"
            disabled={!canEdit}
            onChange={(e) => patchAct(A.id, { weeks: e.target.value.replace(/\D/g, ""), status: "draft" })}
          />
        </div>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="at-m">Position or leadership</span>
          <span className="at-m">{A.role.length} / 50</span>
        </div>
        <input
          className="at-ul"
          maxLength={50}
          value={A.role}
          placeholder="Your role or title"
          disabled={!canEdit}
          onChange={(e) => patchAct(A.id, { role: e.target.value.slice(0, 50) })}
        />
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="at-m">Organization</span>
          <span className="at-m">{A.org.length} / 100</span>
        </div>
        <input
          className="at-ul"
          maxLength={100}
          value={A.org}
          placeholder="Which group or place?"
          disabled={!canEdit}
          onChange={(e) => patchAct(A.id, { org: e.target.value.slice(0, 100) })}
        />
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="at-m">Your notes</span>
          <span className="at-m" style={{ color: A.desc.length >= 140 ? "var(--text-accent)" : "var(--text-subtle)" }}>
            {A.desc.length} / 150
          </span>
        </div>
        <textarea
          className="at-ul"
          rows={3}
          maxLength={150}
          value={A.desc}
          placeholder="Jot down what you do, how often, and what you are responsible for. You will write your own version when you apply."
          disabled={!canEdit}
          onChange={(e) => patchAct(A.id, { desc: e.target.value.slice(0, 150) })}
        />
      </div>
      {steps.length ? (
        <div style={{ background: "var(--color-surface)", padding: "16px 18px" }}>
          <div className="at-m" style={{ marginBottom: 8 }}>
            From your plan and notes, for reference
          </div>
          {steps.map((s, i) => (
            <div key={i} style={{ fontSize: 15, lineHeight: 1.5, color: "var(--text-muted)" }}>
              <b style={{ fontWeight: 600, color: "var(--color-text)" }}>{s.lens}</b> {s.text}
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span className="at-hint">Do you plan to do this in college?</span>
        <button
          type="button"
          className={A.college === "yes" ? "at-pill on" : "at-pill"}
          disabled={!canEdit}
          onClick={() => patchAct(A.id, { college: "yes" })}
        >
          Yes
        </button>
        <button
          type="button"
          className={A.college === "no" ? "at-pill on" : "at-pill"}
          disabled={!canEdit}
          onClick={() => patchAct(A.id, { college: "no" })}
        >
          No
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 6 }}>
        <button
          type="button"
          className="at-btn"
          disabled={!canEdit || (!ready && miss.length > 0)}
          onClick={() => {
            if (ready) {
              patchAct(A.id, { status: "draft" });
              return;
            }
            const nextActs = track.acts.map((x) => (x.id === A.id ? { ...x, status: "ready" as const } : x));
            persist({ ...track, acts: nextActs });
            const nx = nextActs.find((x, j) => j > idx && x.status !== "ready");
            if (nx) {
              say(`Prepared. On to ${nx.name}.`);
              onAdvance(nx.id);
            } else say(`${A.name} is prepared`);
          }}
        >
          {ready ? "Prepared. Mark as in progress" : "Mark as prepared"}
        </button>
        <span className="at-hint">{!ready && miss.length ? `Still needs ${miss.join(", ")}.` : ""}</span>
      </div>
    </div>
  );
}
