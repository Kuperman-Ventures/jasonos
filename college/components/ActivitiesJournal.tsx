"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivitiesTrackView } from "./ActivitiesTrackView";
import { ActivitiesRecall } from "./ActivitiesRecall";
import { GradeStrip } from "./GradeStrip";
import { GraduationYearPicker } from "./GraduationYearPicker";
import { RecallAnswerCard, emptyRecallState, nextRecallPick, recallSpanComplete, type RecallAnswerState } from "./RecallAnswerCard";
import { ActivityIcon } from "./ActivityIcon";
import { useEnsureActivityIcons } from "./use-activity-icons";
import { pickActivityIcon } from "@/lib/activity-icons";
import { type ActivitiesViewId } from "@/lib/apps-materials";
import {
  ACTIVITY_CATEGORIES,
  APP_DRAFT_LIMITS,
  COMMON_APP_LIST_ID,
  HONOR_LEVEL_LABEL,
  HONOR_LIMITS,
  activityFromRecall,
  activityNeedsDetails,
  activityStatusLabel,
  addPeriod,
  addUpdate,
  applyRecallSpan,
  archiveActivity,
  archiveAward,
  assignActivityToThread,
  charCount,
  commonAppCopyText,
  commonAppGrades,
  commonAppTime,
  commonAppTiming,
  currentGrade,
  ensureCommonAppList,
  estimatedHours,
  getCommonAppList,
  gradeCells,
  inferHonorLevel,
  isDraftStale,
  isSelfStartedProject,
  newId,
  ongoingFromPeriods,
  prepSummary,
  recordSchoolYears,
  recordSpanText,
  recordSummary,
  removeActivity,
  removeDraftFromList,
  removeHonorFromList,
  removePeriod,
  reorderDraft,
  restoreActivity,
  resolveClassOf,
  schoolYearForGrade,
  setClassOf,
  sortRecordActivities,
  updatePeriod,
  upsertActivity,
  upsertAward,
  upsertDraft,
  upsertHonor,
  type ActivitiesJournal as Journal,
  type Activity,
  type ActivityCategoryId,
  type ActivityThread,
  type ActivityUpdate,
  type ApplicationDraft,
  type Award,
  type GradeLevel,
  type HonorDraft,
  type HonorLevel,
  type ParticipationPeriod,
  type PeriodKind,
  type PeriodStatus,
} from "@/lib/activities-journal";

const GRADE_OPTIONS: { id: GradeLevel; label: string }[] = [
  { id: "6", label: "6th" },
  { id: "7", label: "7th" },
  { id: "8", label: "8th" },
  { id: "9", label: "9th" },
  { id: "10", label: "10th" },
  { id: "11", label: "11th" },
  { id: "12", label: "12th" },
  { id: "post", label: "Post-grad" },
  { id: "other", label: "Other" },
];

const MONTHS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

const PERIOD_KINDS: { id: PeriodKind; label: string }[] = [
  { id: "school_year", label: "School year" },
  { id: "summer", label: "Summer" },
  { id: "all_year", label: "All year" },
  { id: "custom", label: "Custom" },
];

const PERIOD_STATUSES: { id: PeriodStatus; label: string }[] = [
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "planned", label: "Planned" },
];

type DetailTab = "overview" | "periods" | "updates" | "reflections" | "people";

function gradeLabel(grade: GradeLevel | string): string {
  return GRADE_OPTIONS.find((g) => g.id === grade)?.label ?? grade;
}

function GradeGroupedOptions({
  includeBlank,
  blankLabel = "—",
}: {
  includeBlank?: boolean;
  blankLabel?: string;
}) {
  const middle = GRADE_OPTIONS.filter((g) => g.id === "6" || g.id === "7" || g.id === "8");
  const high = GRADE_OPTIONS.filter((g) => g.id === "9" || g.id === "10" || g.id === "11" || g.id === "12");
  const rest = GRADE_OPTIONS.filter((g) => g.id === "post" || g.id === "other");
  return (
    <>
      {includeBlank ? <option value="">{blankLabel}</option> : null}
      <optgroup label="Middle school">
        {middle.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="High school">
        {high.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
          </option>
        ))}
      </optgroup>
      {rest.map((g) => (
        <option key={g.id} value={g.id}>
          {g.label}
        </option>
      ))}
    </>
  );
}

function formatShortDate(iso: string | undefined): string {
  if (!iso) return "";
  const day = iso.slice(0, 10);
  const t = Date.parse(day);
  if (Number.isNaN(t)) return day;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function periodHoursLabel(period: ParticipationPeriod | null): string | null {
  if (!period) return null;
  const year = period.schoolYear || "—";
  if (period.hoursPerWeek != null) {
    return `${period.hoursPerWeek} hrs/wk · ${year}`;
  }
  const est = estimatedHours(period);
  if (est != null) return `${est} hrs total · ${year}`;
  if (period.schoolYear) return year;
  return null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function CharCounter({ value, limit }: { value: string | undefined; limit: number }) {
  const n = charCount(value);
  const over = n > limit;
  return (
    <span className={over ? "aj-char aj-char-over" : "aj-char"}>
      {n} / {limit}
    </span>
  );
}

function clipChars(value: string | undefined, limit: number): string | undefined {
  if (!value) return undefined;
  const chars = [...value];
  if (chars.length <= limit) return value;
  return chars.slice(0, limit).join("");
}

function ordinalGrade(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function gradeRangeLabel(grades: number[]): string | null {
  if (!grades.length) return null;
  if (grades.length === 1) return ordinalGrade(grades[0]!);
  return `${ordinalGrade(grades[0]!)}-${ordinalGrade(grades[grades.length - 1]!)}`;
}

function middleSchoolGrades(activity: Activity): number[] {
  const grades = new Set<number>();
  for (const period of activity.periods) {
    if (period.status !== "completed" && period.status !== "in_progress") continue;
    const grade = Number(period.grade);
    if (Number.isInteger(grade) && grade >= 6 && grade <= 8) grades.add(grade);
  }
  return [...grades].sort((a, b) => a - b);
}

function chosenActivitySub(activity: Activity): string {
  const high = commonAppGrades(activity);
  const middle = middleSchoolGrades(activity);
  const range = gradeRangeLabel(high);
  const since = middle.length ? `since ${ordinalGrade(middle[0]!)}` : null;
  if (range && since) return `${range} · ${since}`;
  if (range) return range;
  if (since) return since;
  return "Grades not set";
}

function poolActivityFact(activity: Activity): string {
  const high = commonAppGrades(activity);
  if (high.length) {
    const range = gradeRangeLabel(high)!;
    const yrs = high.length;
    return `${range} · ${yrs} yr${yrs === 1 ? "" : "s"}`;
  }
  if (middleSchoolGrades(activity).length) return "Middle school only";
  return "Grades not set";
}

function draftIsOverLimit(draft: ApplicationDraft): boolean {
  return (
    charCount(draft.draftRole) > APP_DRAFT_LIMITS.role ||
    charCount(draft.draftOrg) > APP_DRAFT_LIMITS.org ||
    charCount(draft.shortDescription) > APP_DRAFT_LIMITS.short
  );
}

function draftStateLabel(
  draft: ApplicationDraft,
  activity: Activity | undefined,
): { kind: "draft" | "ready" | "over" | "changed"; label: string } {
  if (draftIsOverLimit(draft)) return { kind: "over", label: "Over limit" };
  if (activity && isDraftStale(draft, activity)) return { kind: "changed", label: "Changed" };
  if (draft.reviewStatus === "reviewed") return { kind: "ready", label: "Ready" };
  return { kind: "draft", label: "Draft" };
}

export function ActivitiesJournal({
  journal,
  canEdit,
  loaded = true,
  view,
  onViewChange,
  onChange,
  openActivityId,
  onOpenActivity,
}: {
  journal: Journal;
  canEdit: boolean;
  loaded?: boolean;
  view: ActivitiesViewId;
  onViewChange: (view: ActivitiesViewId) => void;
  onChange: (next: Journal) => void;
  openActivityId: string | null;
  onOpenActivity: (id: string | null) => void;
}) {
  useEnsureActivityIcons(journal, onChange, canEdit && loaded);

  return (
    <ActivitiesTrackView
      journal={journal}
      canEdit={canEdit}
      loaded={loaded}
      view={view}
      onViewChange={onViewChange}
      onChange={onChange}
      openActivityId={openActivityId}
      onOpenActivity={onOpenActivity}
    />
  );
}

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function stripAriaLabel(name: string, span: string): string {
  const clause = span.replace(/ · /g, ", ").replace(/^Since /, "since ").replace(/^Start /, "start ");
  return `${name}: ${clause}`;
}

function awardGradeNumber(grade: GradeLevel | undefined): number | null {
  if (!grade || grade === "post" || grade === "other") return null;
  const n = Number(grade);
  return Number.isInteger(n) && n >= 6 && n <= 12 ? n : null;
}

function MyActivitiesView({
  journal,
  canEdit,
  loaded,
  highlightIds,
  onHighlightIds,
  onChange,
  onOpenActivity,
  focusAwards = false,
  onFocusAwardsHandled,
  recallOpen,
  onRecallOpenChange,
  onEditThreadsInPlan,
}: {
  journal: Journal;
  canEdit: boolean;
  loaded: boolean;
  highlightIds: string[];
  onHighlightIds: (ids: string[]) => void;
  onChange: (next: Journal) => void;
  onOpenActivity: (id: string | null, tab?: DetailTab) => void;
  focusAwards?: boolean;
  onFocusAwardsHandled?: () => void;
  recallOpen: boolean;
  onRecallOpenChange: (open: boolean) => void;
  onEditThreadsInPlan: () => void;
}) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDraft, setQuickDraft] = useState("");
  const [quickDup, setQuickDup] = useState("");
  const [quickId, setQuickId] = useState<string | null>(null);
  const [quickState, setQuickState] = useState<RecallAnswerState>(emptyRecallState);
  const [spanEditId, setSpanEditId] = useState<string | null>(null);
  const [spanEditState, setSpanEditState] = useState<RecallAnswerState>(emptyRecallState);
  const [showAddAward, setShowAddAward] = useState(false);
  const [moveMenuId, setMoveMenuId] = useState<string | null>(null);
  const journalRef = useRef(journal);
  const moveMenuRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    journalRef.current = journal;
  }, [journal]);

  useEffect(() => {
    if (!focusAwards) return;
    document.getElementById("rec-awards-h")?.scrollIntoView({ behavior: "smooth", block: "start" });
    onFocusAwardsHandled?.();
  }, [focusAwards, onFocusAwardsHandled]);

  useEffect(() => {
    if (!moveMenuId) return;
    function onDoc(event: MouseEvent) {
      if (!moveMenuRef.current?.contains(event.target as Node)) setMoveMenuId(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moveMenuId]);

  const active = journal.activities.filter((a) => !a.archived);
  const archived = journal.activities.filter((a) => a.archived);
  const activeCount = active.length;
  const threads = journal.threads ?? [];
  const hasThreads = threads.length > 0;
  const showGrouped = hasThreads;
  const showRecall = canEdit && loaded && recallOpen;
  const savedClassOf = journal.profile?.classOf;
  const classOf = resolveClassOf(savedClassOf);
  const gradeNow = currentGrade(classOf);
  const needle = query.trim().toLowerCase();
  const searched = needle
    ? active.filter((a) =>
        [a.name, a.organization, a.role].filter(Boolean).join(" ").toLowerCase().includes(needle),
      )
    : active;
  const rows = sortRecordActivities(searched);
  const awards = journal.awards.filter((a) => !a.archived);
  const quickActivity = quickId ? journal.activities.find((a) => a.id === quickId) : undefined;
  const activityById = useMemo(() => {
    const map = new Map<string, Activity>();
    for (const a of journal.activities) map.set(a.id, a);
    return map;
  }, [journal.activities]);

  function closeRecall(ids: string[]) {
    onRecallOpenChange(false);
    if (ids.length) onHighlightIds([...new Set([...highlightIds, ...ids])]);
  }

  function commit(next: Journal) {
    journalRef.current = next;
    onChange(next);
  }

  function saveSpan(id: string, next: RecallAnswerState, closeQuick: boolean) {
    if (!recallSpanComplete(next)) return false;
    const year = resolveClassOf(journalRef.current.profile?.classOf ?? classOf);
    let saved = journalRef.current;
    if (saved.profile?.classOf == null) saved = setClassOf(saved, year);
    saved = applyRecallSpan(saved, id, year, {
      sinceGrade: next.since ?? undefined,
      untilGrade: next.until ?? undefined,
      stillDoing: next.stillDoing,
    });
    const activity = saved.activities.find((a) => a.id === id);
    if (!activity || activity.periods.length === 0) return false;
    commit(saved);
    onHighlightIds([...new Set([...highlightIds, id])]);
    setSpanEditId(null);
    setSpanEditState(emptyRecallState());
    if (closeQuick) {
      setQuickOpen(false);
      setQuickId(null);
      setQuickDraft("");
      setQuickDup("");
      setQuickState(emptyRecallState());
    }
    return true;
  }

  function addQuick(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const name = quickDraft.trim();
    if (!name) return;
    if (journalRef.current.activities.some((a) => !a.archived && namesMatch(a.name, name))) {
      setQuickDup(name);
      setQuickDraft("");
      return;
    }
    const year = resolveClassOf(journalRef.current.profile?.classOf ?? classOf);
    let next = journalRef.current;
    if (next.profile?.classOf == null) next = setClassOf(next, year);
    const activity = activityFromRecall(
      { name, category: "other", stillDoing: true },
      year,
    );
    commit(upsertActivity(next, activity));
    setQuickId(activity.id);
    setQuickState(emptyRecallState());
    setQuickDraft("");
    setQuickDup("");
  }

  function renderRecordRow(activity: Activity) {
    const cells = gradeCells(activity);
    const years = recordSchoolYears(activity);
    const span = recordSpanText(activity, gradeNow);
    const isNew = highlightIds.includes(activity.id);
    const needsDetails = activityNeedsDetails(activity);
    const markers = awards
      .filter((award) => award.activityId === activity.id && awardGradeNumber(award.grade) != null)
      .map((award) => ({
        grade: awardGradeNumber(award.grade)!,
        title: award.title,
      }));
    const metaBits = [activity.role, activity.organization].filter(Boolean) as string[];
    const editingSpan = spanEditId === activity.id;
    const moveOpen = moveMenuId === activity.id;
    return (
      <div key={activity.id} className={isNew ? "rec-row rec-cols is-new" : "rec-row rec-cols"}>
        <div className="rec-name">
          <button type="button" onClick={() => onOpenActivity(activity.id)}>
            <ActivityIcon activity={activity} size={20} />
            <span>{activity.name}</span>
          </button>
          {isSelfStartedProject(activity) ? (
            <span className="rec-project-pill">Self-started project</span>
          ) : null}
          <span className="rec-meta">
            {isNew ? <span className="rec-new-tag">New</span> : null}
            <span>
              {span}
              {metaBits.length ? ` · ${metaBits.join(", ")}` : ""}
            </span>
          </span>
        </div>
        {editingSpan ? (
          <ul className="aj-recall-items rec-span-edit">
            <RecallAnswerCard
              name={activity.name}
              leading={<ActivityIcon activity={activity} size={20} />}
              state={spanEditState}
              currentGrade={gradeNow}
              prompt="Tap the grade you started."
              removeLabel="Cancel"
              onRemove={() => {
                setSpanEditId(null);
                setSpanEditState(emptyRecallState());
              }}
              onPick={(g) => {
                const next = nextRecallPick(spanEditState, g);
                setSpanEditState(next);
                saveSpan(activity.id, next, false);
              }}
              onStill={() => {
                const next: RecallAnswerState = {
                  ...spanEditState,
                  stillDoing: true,
                  until: null,
                  pickMode: "start",
                };
                setSpanEditState(next);
                saveSpan(activity.id, next, false);
              }}
              onStopped={() => {
                const next: RecallAnswerState = {
                  ...spanEditState,
                  stillDoing: false,
                  pickMode: spanEditState.since == null ? "start" : "end",
                  editing: true,
                };
                setSpanEditState(next);
                saveSpan(activity.id, next, false);
              }}
              onDone={() => {
                const next = { ...spanEditState, editing: false };
                setSpanEditState(next);
                saveSpan(activity.id, next, false);
              }}
              onChangeClick={() =>
                setSpanEditState((s) => ({
                  ...s,
                  editing: true,
                  pickMode: s.stillDoing ? "start" : "end",
                }))
              }
            />
          </ul>
        ) : (
          <GradeStrip
            size="row"
            currentGrade={gradeNow}
            cells={cells}
            markers={markers}
            label={stripAriaLabel(activity.name, span)}
            onEmptyClick={
              canEdit && years === 0 && activity.id !== quickId
                ? () => {
                    setSpanEditId(activity.id);
                    setSpanEditState(emptyRecallState());
                  }
                : undefined
            }
          />
        )}
        <span className="rec-years">
          {years ? `${years} ${years === 1 ? "yr" : "yrs"}` : ""}
        </span>
        <span className="rec-act" ref={moveOpen ? moveMenuRef : undefined}>
          {canEdit && showGrouped ? (
            <span className="rec-move-wrap">
              <button
                type="button"
                className="aj-text-btn"
                onClick={() => setMoveMenuId(moveOpen ? null : activity.id)}
              >
                Move
              </button>
              {moveOpen ? (
                <div className="rec-move-menu" role="menu">
                  {threads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        commit(assignActivityToThread(journalRef.current, activity.id, thread.id));
                        setMoveMenuId(null);
                      }}
                    >
                      {thread.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      commit(assignActivityToThread(journalRef.current, activity.id, null));
                      setMoveMenuId(null);
                    }}
                  >
                    Not in a thread
                  </button>
                </div>
              ) : null}
            </span>
          ) : null}
          {canEdit && needsDetails ? (
            <button
              type="button"
              className="aj-text-btn strong"
              onClick={() => onOpenActivity(activity.id)}
            >
              Add details
            </button>
          ) : null}
        </span>
      </div>
    );
  }

  function renderThreadHeader(thread: ActivityThread, count: number, isFirst: boolean) {
    return (
      <div key={`h-${thread.id}`} className="rec-group-h">
        <h3>{thread.name}</h3>
        <span className="rec-group-count">
          {count} {count === 1 ? "activity" : "activities"}
        </span>
        {canEdit && isFirst ? (
          <span className="rec-group-tools">
            <button type="button" className="aj-text-btn" onClick={onEditThreadsInPlan}>
              Edit threads in Plan
            </button>
          </span>
        ) : null}
      </div>
    );
  }

  if (showRecall) {
    return (
      <div className="aj-view">
        <ActivitiesRecall
          journal={journal}
          onChange={onChange}
          onDone={closeRecall}
          onExit={closeRecall}
        />
      </div>
    );
  }

  if (!loaded) {
    return <div className="aj-view" />;
  }

  if (!canEdit && !activeCount) {
    return (
      <div className="aj-view">
        <p className="board-empty">No activities yet.</p>
      </div>
    );
  }

  return (
    <div className="aj-view rec">
      <header className="rec-head">
        <div>
          <h3 className="rec-title">My Record</h3>
          <p className="rec-sum">{recordSummary(journal, gradeNow)}</p>
        </div>
        {canEdit ? (
          <div className="rec-actions">
            <button type="button" className="btn btn-secondary" onClick={() => onRecallOpenChange(true)}>
              Add with questions
            </button>
          </div>
        ) : null}
      </header>

      {canEdit && savedClassOf == null ? (
        <GraduationYearPicker
          compact
          classOf={savedClassOf}
          onPick={(year) => commit(setClassOf(journalRef.current, year))}
        />
      ) : null}

      {activeCount > 12 ? (
        <label className="rec-find">
          <span className="sr-only">Find an activity</span>
          <input
            className="field"
            type="search"
            value={query}
            placeholder="Find an activity"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      ) : null}

      <div className="rec-list">
        <div className="rec-cols rec-colhead" aria-hidden="true">
          <span />
          <div className="rec-gradehead">
            <span className="rec-grade-grp rec-ms">Middle school</span>
            <span className="rec-grade-grp rec-hs">High school</span>
            {[6, 7, 8, 9, 10, 11, 12].map((g, i) => (
              <span
                key={g}
                className={g === gradeNow ? "rec-g is-now" : "rec-g"}
                style={{ gridColumn: i < 3 ? i + 1 : i + 2 }}
              >
                {g === gradeNow ? `${g} now` : g}
              </span>
            ))}
          </div>
          <span />
          <span />
        </div>

        {showGrouped
          ? (
              <>
                {threads.map((thread, index) => {
                  const groupRows = sortRecordActivities(
                    rows.filter((a) => a.threadId === thread.id),
                  );
                  return (
                    <div key={thread.id} className="rec-group">
                      {renderThreadHeader(thread, groupRows.length, index === 0)}
                      {groupRows.map((activity) => renderRecordRow(activity))}
                    </div>
                  );
                })}
                <div className="rec-group">
                  <div className="rec-group-h is-loose">
                    <h3>Not in a thread</h3>
                    <span className="rec-group-count">
                      {rows.filter((a) => !a.threadId).length}{" "}
                      {rows.filter((a) => !a.threadId).length === 1 ? "activity" : "activities"}
                    </span>
                  </div>
                  {sortRecordActivities(rows.filter((a) => !a.threadId)).map((activity) =>
                    renderRecordRow(activity),
                  )}
                </div>
              </>
            )
          : rows.map((activity) => renderRecordRow(activity))}

        {canEdit ? (
          <div className="rec-qa">
            {quickOpen ? (
              <div className="rec-qa-card">
                <form className="aj-recall-capture" onSubmit={addQuick}>
                  <label htmlFor="rec-qa-input" className="sr-only">
                    Activity name
                  </label>
                  <input
                    id="rec-qa-input"
                    autoComplete="off"
                    placeholder="What's the activity?"
                    value={quickDraft}
                    onChange={(e) => setQuickDraft(e.target.value)}
                  />
                  <button type="submit" className="aj-recall-add" disabled={!quickDraft.trim()}>
                    Add
                  </button>
                </form>
                <p className="aj-recall-dup" aria-live="polite">
                  {quickDup ? `${quickDup} is already in My Record.` : ""}
                </p>
                {quickId ? (
                  <ul className="aj-recall-items">
                    <RecallAnswerCard
                      name={quickActivity?.name ?? "Activity"}
                      leading={quickActivity ? <ActivityIcon activity={quickActivity} size={20} /> : null}
                      state={quickState}
                      currentGrade={gradeNow}
                      prompt="Then tap the grade you started."
                      onRemove={() => {
                        onChange(removeActivity(journalRef.current, quickId));
                        setQuickId(null);
                        setQuickState(emptyRecallState());
                      }}
                      onPick={(g) => {
                        const next = nextRecallPick(quickState, g);
                        setQuickState(next);
                        saveSpan(quickId, next, true);
                      }}
                      onStill={() => {
                        const next: RecallAnswerState = {
                          ...quickState,
                          stillDoing: true,
                          until: null,
                          pickMode: "start",
                        };
                        setQuickState(next);
                        saveSpan(quickId, next, true);
                      }}
                      onStopped={() => {
                        const next: RecallAnswerState = {
                          ...quickState,
                          stillDoing: false,
                          pickMode: quickState.since == null ? "start" : "end",
                          editing: true,
                        };
                        setQuickState(next);
                        saveSpan(quickId, next, false);
                      }}
                      onDone={() => {
                        const next = { ...quickState, editing: false };
                        setQuickState(next);
                        saveSpan(quickId, next, true);
                      }}
                      onChangeClick={() =>
                        setQuickState((s) => ({
                          ...s,
                          editing: true,
                          pickMode: s.stillDoing ? "start" : "end",
                        }))
                      }
                    />
                  </ul>
                ) : null}
                <button
                  type="button"
                  className="aj-text-btn"
                  onClick={() => {
                    setQuickOpen(false);
                    setQuickDraft("");
                    setQuickDup("");
                    setQuickId(null);
                    setQuickState(emptyRecallState());
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="aj-text-btn strong" onClick={() => setQuickOpen(true)}>
                + Add one activity
              </button>
            )}
          </div>
        ) : null}

        {archived.length ? (
          <div className="rec-archived">
            <button
              type="button"
              className="aj-text-btn"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "Hide archived" : `Show archived (${archived.length})`}
            </button>
            {showArchived ? (
              <ul>
                {archived.map((activity) => (
                  <li key={activity.id}>
                    <span className="aj-activity-label">
                      <ActivityIcon activity={activity} size={16} />
                      <span>{activity.name}</span>
                    </span>
                    {canEdit ? (
                      <button
                        type="button"
                        className="aj-text-btn"
                        onClick={() => commit(restoreActivity(journalRef.current, activity.id))}
                      >
                        Restore
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <section className="rec-awards" aria-labelledby="rec-awards-h">
        <div className="rec-awards-h">
          <h3 id="rec-awards-h">Awards and Recognition</h3>
          {canEdit ? (
            <button
              type="button"
              className="aj-text-btn strong"
              onClick={() => setShowAddAward((v) => !v)}
            >
              + Add an award
            </button>
          ) : null}
        </div>
        {showAddAward && canEdit ? (
          <AddAwardForm
            activities={active}
            onCancel={() => setShowAddAward(false)}
            onSave={(award) => {
              commit(upsertAward(journalRef.current, award));
              setShowAddAward(false);
            }}
          />
        ) : null}
        {!awards.length ? (
          <p className="rec-awards-empty">No awards yet.</p>
        ) : (
          <ul>
            {awards.map((award) => {
              const linked = award.activityId ? activityById.get(award.activityId) : null;
              const meta = [
                award.grade ? gradeLabel(award.grade) + " grade" : "",
                award.recognitionLevel,
              ].filter(Boolean);
              return (
                <li key={award.id}>
                  <span className="rec-diamond" aria-hidden="true" />
                  <span>
                    <span className="rec-award-name">{award.title}</span>
                    {linked || meta.length ? (
                      <>
                        <br />
                        <span className="rec-award-meta">
                          {linked ? (
                            <span className="aj-activity-label">
                              <ActivityIcon activity={linked} size={14} />
                              {linked.name}
                            </span>
                          ) : null}
                          {linked && meta.length ? " · " : null}
                          {meta.join(" · ")}
                        </span>
                      </>
                    ) : null}
                  </span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="aj-text-btn"
                      onClick={() => commit(archiveAward(journalRef.current, award.id))}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="rec-award-note">
          Awards linked to an activity also show as a marker on that activity&apos;s row.
        </p>
      </section>
    </div>
  );
}

function AddUpdateForm({
  activities,
  fixedActivityId,
  initialActivityId,
  onCancel,
  onSave,
}: {
  activities: Activity[];
  fixedActivityId?: string;
  initialActivityId?: string;
  onCancel: () => void;
  onSave: (
    activityId: string,
    fields: {
      date: string;
      whatHappened: string;
      outcomes?: string;
      recognition?: string;
      learned?: string;
    },
  ) => void;
}) {
  const [activityId, setActivityId] = useState(
    fixedActivityId ?? initialActivityId ?? activities[0]?.id ?? "",
  );
  const [date, setDate] = useState(todayIsoDate());
  const [whatHappened, setWhatHappened] = useState("");
  const [outcomes, setOutcomes] = useState("");
  const [recognition, setRecognition] = useState("");
  const [learned, setLearned] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="aj-panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (!activityId) {
          setError("Pick an activity.");
          return;
        }
        if (!whatHappened.trim()) {
          setError("What happened is required.");
          return;
        }
        onSave(activityId, {
          date: date || todayIsoDate(),
          whatHappened: whatHappened.trim(),
          outcomes: outcomes.trim() || undefined,
          recognition: recognition.trim() || undefined,
          learned: learned.trim() || undefined,
        });
      }}
    >
      <h4>Add update</h4>
      <div className="aj-form-grid">
        {!fixedActivityId ? (
          <label className="stack-field aj-span-2">
            <span className="label">Activity *</span>
            <select
              className="field"
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              required
            >
              {!activities.length ? <option value="">No activities</option> : null}
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="stack-field">
          <span className="label">Date</span>
          <input
            className="field"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="stack-field aj-span-2">
          <span className="label">What happened *</span>
          <textarea
            className="field"
            rows={3}
            value={whatHappened}
            onChange={(e) => setWhatHappened(e.target.value)}
            required
          />
        </label>
        <label className="stack-field aj-span-2">
          <span className="label">Outcomes</span>
          <textarea
            className="field"
            rows={2}
            value={outcomes}
            onChange={(e) => setOutcomes(e.target.value)}
          />
        </label>
        <label className="stack-field">
          <span className="label">Recognition</span>
          <input
            className="field"
            value={recognition}
            onChange={(e) => setRecognition(e.target.value)}
          />
        </label>
        <label className="stack-field">
          <span className="label">What I learned</span>
          <input className="field" value={learned} onChange={(e) => setLearned(e.target.value)} />
        </label>
      </div>
      {error ? <p className="aj-error">{error}</p> : null}
      <div className="aj-actions">
        <button type="submit" className="btn btn-primary" disabled={!activities.length && !fixedActivityId}>
          Save update
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ActivityDetail({
  journal,
  activity,
  canEdit,
  initialTab,
  onChange,
  onBack,
}: {
  journal: Journal;
  activity: Activity;
  canEdit: boolean;
  initialTab?: DetailTab;
  onChange: (next: Journal) => void;
  onBack: () => void;
}) {
  const journalRef = useRef(journal);
  useEffect(() => {
    journalRef.current = journal;
  }, [journal]);

  const classOf = resolveClassOf(journal.profile?.classOf);
  const gradeNow = currentGrade(classOf);
  const thread = (journal.threads ?? []).find((t) => t.id === activity.threadId);
  const span = recordSpanText(activity, gradeNow);
  const awards = journal.awards.filter((a) => !a.archived && a.activityId === activity.id);

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(activity.name);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [removePeriodId, setRemovePeriodId] = useState<string | null>(null);
  const [addYearPills, setAddYearPills] = useState(false);
  const [planYearPills, setPlanYearPills] = useState(false);
  const [showMoment, setShowMoment] = useState(false);
  const [momentDate, setMomentDate] = useState(todayIsoDate());
  const [momentWhat, setMomentWhat] = useState("");
  const [momentRecognition, setMomentRecognition] = useState("");
  const [momentLearned, setMomentLearned] = useState("");
  const [showAward, setShowAward] = useState(false);
  const [showPerson, setShowPerson] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [moreTypes, setMoreTypes] = useState(false);
  const moreRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    setNameDraft(activity.name);
  }, [activity.name]);

  useEffect(() => {
    const map: Record<DetailTab, string> = {
      overview: "detail-what",
      periods: "detail-years",
      updates: "detail-moments",
      reflections: "detail-why",
      people: "detail-people",
    };
    const id = initialTab ? map[initialTab] : null;
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => window.clearTimeout(t);
  }, [initialTab, activity.id]);

  useEffect(() => {
    if (!moreTypes) return;
    function onDoc(event: MouseEvent) {
      if (!moreRef.current?.contains(event.target as Node)) setMoreTypes(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreTypes]);

  function commit(next: Journal) {
    journalRef.current = next;
    onChange(next);
  }

  function withOngoing(nextActivity: Activity): Activity {
    return { ...nextActivity, ongoing: ongoingFromPeriods(nextActivity, gradeNow) };
  }

  function patchActivity(patch: Partial<Activity>) {
    let next = { ...activity, ...patch };
    if (patch.name != null && patch.name.trim() !== activity.name) {
      next.icon = pickActivityIcon({ ...next, icon: undefined });
    }
    if (patch.periods) next = withOngoing(next);
    commit(upsertActivity(journalRef.current, next));
  }

  function applyPeriodMutation(mutator: (j: Journal) => Journal) {
    let next = mutator(journalRef.current);
    const updated = next.activities.find((a) => a.id === activity.id);
    if (updated) {
      next = upsertActivity(next, withOngoing(updated));
    }
    commit(next);
  }

  const periodsNewestFirst = [...activity.periods].sort((a, b) => {
    const ag = a.grade === "post" || a.grade === "other" ? -1 : Number(a.grade);
    const bg = b.grade === "post" || b.grade === "other" ? -1 : Number(b.grade);
    if (bg !== ag) return bg - ag;
    return (b.schoolYear || "").localeCompare(a.schoolYear || "");
  });

  const gradesWithPeriods = new Set(
    activity.periods
      .map((p) => (p.grade === "post" || p.grade === "other" ? null : Number(p.grade)))
      .filter((g): g is number => g != null && g >= 6 && g <= 12),
  );

  function missingPastGrades(): number[] {
    const end = gradeNow ?? 12;
    const missing: number[] = [];
    for (let g = 6; g <= end; g++) {
      if (!gradesWithPeriods.has(g)) missing.push(g);
    }
    return missing;
  }

  function futureGrades(): number[] {
    if (gradeNow == null) return [10, 11, 12].filter((g) => !gradesWithPeriods.has(g));
    const out: number[] = [];
    for (let g = gradeNow + 1; g <= 12; g++) {
      if (!gradesWithPeriods.has(g)) out.push(g);
    }
    return out;
  }

  function addYearForGrade(grade: number, status: PeriodStatus) {
    applyPeriodMutation((j) =>
      addPeriod(j, activity.id, {
        schoolYear: schoolYearForGrade(classOf, grade),
        grade: String(grade) as GradeLevel,
        periodKind: "school_year",
        status,
      }),
    );
    setAddYearPills(false);
    setPlanYearPills(false);
  }

  function onAddYear() {
    const missing = missingPastGrades();
    if (!missing.length) {
      setAddYearPills(true);
      return;
    }
    if (missing.length === 1) {
      addYearForGrade(missing[0]!, gradeNow != null && missing[0] === gradeNow ? "in_progress" : "completed");
      return;
    }
    setAddYearPills(true);
    setPlanYearPills(false);
  }

  const likelyCategories: ActivityCategoryId[] = (() => {
    const set = new Set<ActivityCategoryId>([activity.category]);
    if (activity.category !== "school-club") set.add("school-club");
    if (activity.category !== "arts-music-theater") set.add("arts-music-theater");
    return [...set];
  })();

  const updatesNewest = [...activity.updates].sort((a, b) =>
    (b.date || "").localeCompare(a.date || ""),
  );

  const metaLine = thread ? `${span} · ${thread.name} thread` : span;

  return (
    <div className="aj-detail det">
      <p className="det-back">
        <button type="button" className="aj-text-btn" onClick={onBack}>
          ← My Record
        </button>
      </p>

      <header className="det-head">
        <div className="det-head-main">
          {renaming && canEdit ? (
            <form
              className="det-rename"
              onSubmit={(e) => {
                e.preventDefault();
                const name = nameDraft.trim();
                if (!name) return;
                patchActivity({ name });
                setRenaming(false);
              }}
            >
              <input
                autoFocus
                value={nameDraft}
                aria-label="Activity name"
                onChange={(e) => setNameDraft(e.target.value)}
              />
              <button type="submit" className="aj-text-btn strong" disabled={!nameDraft.trim()}>
                Save
              </button>
              <button
                type="button"
                className="aj-text-btn"
                onClick={() => {
                  setRenaming(false);
                  setNameDraft(activity.name);
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <h2 className="det-name">
              <ActivityIcon activity={activity} size={28} />
              <span>{activity.name}</span>
            </h2>
          )}
          <p className="det-meta">{metaLine}</p>
        </div>
        {canEdit ? (
          confirmArchive ? (
            <span className="det-tools">
              <span className="det-confirm">Archive this activity?</span>
              <button
                type="button"
                className="aj-text-btn strong"
                onClick={() => {
                  commit(archiveActivity(journalRef.current, activity.id));
                  onBack();
                }}
              >
                Archive
              </button>
              <button type="button" className="aj-text-btn" onClick={() => setConfirmArchive(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <span className="det-tools">
              <button
                type="button"
                className="aj-text-btn"
                onClick={() => {
                  setRenaming(true);
                  setNameDraft(activity.name);
                }}
              >
                Rename
              </button>
              <button type="button" className="aj-text-btn" onClick={() => setConfirmArchive(true)}>
                Archive
              </button>
            </span>
          )
        ) : null}
      </header>

      <section className="det-sec" id="detail-years">
        <h3>Each Year</h3>
        <p className="det-sub">Hours and weeks feed your Common App entry. Fill in your best estimate.</p>
        {periodsNewestFirst.length ? (
          <div className="det-wrap-x">
            <table className="det-years">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>When</th>
                  <th>Hours per week</th>
                  <th>Weeks per year</th>
                  <th>Your role that year</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {periodsNewestFirst.map((period) => {
                  const gradeNum =
                    period.grade === "post" || period.grade === "other"
                      ? null
                      : Number(period.grade);
                  const missingHours =
                    (period.status === "completed" || period.status === "in_progress") &&
                    (period.hoursPerWeek == null || period.weeksActive == null);
                  const confirming = removePeriodId === period.id;
                  return (
                    <tr key={period.id}>
                      <td>
                        <b>
                          {gradeNum != null
                            ? `${gradeNum}th`
                            : gradeLabel(period.grade)}
                        </b>
                        {gradeNum != null && gradeNum === gradeNow ? (
                          <span className="det-now"> now</span>
                        ) : null}
                        {period.status === "planned" ? (
                          <span className="det-planned"> planned</span>
                        ) : null}
                      </td>
                      <td>
                        <span className="plan-pills">
                          {(
                            [
                              ["school_year", "School year"],
                              ["summer", "Summer"],
                              ["all_year", "All year"],
                            ] as const
                          ).map(([kind, label]) => (
                            <button
                              key={kind}
                              type="button"
                              aria-pressed={period.periodKind === kind}
                              disabled={!canEdit}
                              onClick={() =>
                                applyPeriodMutation((j) =>
                                  updatePeriod(j, activity.id, period.id, { periodKind: kind }),
                                )
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </span>
                      </td>
                      <td>
                        <input
                          className={missingHours && period.hoursPerWeek == null ? "det-miss" : "det-num"}
                          inputMode="numeric"
                          aria-label={`Hours per week in ${gradeLabel(period.grade)}`}
                          value={period.hoursPerWeek ?? ""}
                          disabled={!canEdit}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            applyPeriodMutation((j) =>
                              updatePeriod(j, activity.id, period.id, {
                                hoursPerWeek: raw === "" ? undefined : Number(raw),
                              }),
                            );
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className={missingHours && period.weeksActive == null ? "det-miss" : "det-num"}
                          inputMode="numeric"
                          aria-label={`Weeks per year in ${gradeLabel(period.grade)}`}
                          value={period.weeksActive ?? ""}
                          disabled={!canEdit}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            applyPeriodMutation((j) =>
                              updatePeriod(j, activity.id, period.id, {
                                weeksActive: raw === "" ? undefined : Number(raw),
                              }),
                            );
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="det-wide"
                          placeholder="Member"
                          aria-label={`Role in ${gradeLabel(period.grade)}`}
                          value={period.role ?? ""}
                          disabled={!canEdit}
                          onChange={(e) =>
                            applyPeriodMutation((j) =>
                              updatePeriod(j, activity.id, period.id, {
                                role: e.target.value || undefined,
                              }),
                            )
                          }
                        />
                      </td>
                      <td>
                        {canEdit ? (
                          confirming ? (
                            <span className="det-inline-confirm">
                              Remove this year?
                              <button
                                type="button"
                                className="aj-text-btn strong"
                                onClick={() => {
                                  applyPeriodMutation((j) =>
                                    removePeriod(j, activity.id, period.id),
                                  );
                                  setRemovePeriodId(null);
                                }}
                              >
                                Remove
                              </button>
                              <button
                                type="button"
                                className="aj-text-btn"
                                onClick={() => setRemovePeriodId(null)}
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="aj-text-btn"
                              onClick={() => {
                                if (activity.periods.length <= 1) setRemovePeriodId(period.id);
                                else
                                  applyPeriodMutation((j) =>
                                    removePeriod(j, activity.id, period.id),
                                  );
                              }}
                            >
                              Remove
                            </button>
                          )
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="det-empty">No years yet.</p>
        )}
        {canEdit ? (
          <p className="det-sub det-year-actions">
            <button type="button" className="aj-text-btn strong" onClick={onAddYear}>
              + Add a year
            </button>
            {" · "}
            <button
              type="button"
              className="aj-text-btn"
              onClick={() => {
                setPlanYearPills(true);
                setAddYearPills(false);
              }}
            >
              + Plan a future year
            </button>
          </p>
        ) : null}
        {canEdit && addYearPills ? (
          <div className="plan-pills det-grade-pills" role="group" aria-label="Add a year">
            {missingPastGrades().map((g) => (
              <button
                key={g}
                type="button"
                onClick={() =>
                  addYearForGrade(
                    g,
                    gradeNow != null && g === gradeNow ? "in_progress" : "completed",
                  )
                }
              >
                {g}th
              </button>
            ))}
            <button type="button" className="aj-text-btn" onClick={() => setAddYearPills(false)}>
              Cancel
            </button>
          </div>
        ) : null}
        {canEdit && planYearPills ? (
          <div className="plan-pills det-grade-pills" role="group" aria-label="Plan a future year">
            {futureGrades().map((g) => (
              <button key={g} type="button" onClick={() => addYearForGrade(g, "planned")}>
                {g}th
              </button>
            ))}
            <button type="button" className="aj-text-btn" onClick={() => setPlanYearPills(false)}>
              Cancel
            </button>
          </div>
        ) : null}
      </section>

      <section className="det-sec" id="detail-what">
        <h3>What You Do</h3>
        <div className="det-qa">
          <div>
            <label htmlFor="det-role">
              What&apos;s your role?
              <span className="det-help">Your title or position now, if you have one.</span>
            </label>
            <input
              id="det-role"
              placeholder="For example: section member"
              value={activity.role ?? ""}
              disabled={!canEdit}
              onChange={(e) => patchActivity({ role: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="det-org">Which group or organization?</label>
            <input
              id="det-org"
              placeholder="For example: your school's band program"
              value={activity.organization ?? ""}
              disabled={!canEdit}
              onChange={(e) => patchActivity({ organization: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="det-do">
              What do you actually do?
              <span className="det-help">
                A few sentences in your own words. You&apos;ll shorten it for the Common App later.
              </span>
            </label>
            <textarea
              id="det-do"
              rows={3}
              value={activity.responsibilities ?? ""}
              disabled={!canEdit}
              onChange={(e) => patchActivity({ responsibilities: e.target.value })}
            />
          </div>
          <div>
            <span className="det-q-label">What type of activity is it?</span>
            <span className="plan-pills" style={{ marginTop: 6 }}>
              {likelyCategories.map((id) => {
                const label = ACTIVITY_CATEGORIES.find((c) => c.id === id)?.label ?? id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={activity.category === id}
                    disabled={!canEdit}
                    onClick={() => patchActivity({ category: id })}
                  >
                    {label}
                  </button>
                );
              })}
              <span className="det-more-wrap" ref={moreRef}>
                <button
                  type="button"
                  aria-pressed={moreTypes}
                  disabled={!canEdit}
                  onClick={() => setMoreTypes((v) => !v)}
                >
                  More types
                </button>
                {moreTypes ? (
                  <div className="det-more-menu" role="menu">
                    {ACTIVITY_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          patchActivity({ category: cat.id });
                          setMoreTypes(false);
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </span>
            </span>
          </div>
          <div>
            <label htmlFor="det-purpose">What does the group do?</label>
            <input
              id="det-purpose"
              value={activity.orgPurpose ?? ""}
              disabled={!canEdit}
              onChange={(e) => patchActivity({ orgPurpose: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="det-sec" id="detail-why">
        <h3>Why It Matters</h3>
        <p className="det-sub">
          These are notes for your essays. Nobody else sees them unless you share them.
        </p>
        <div className="det-qa">
          {(
            [
              ["whyMatters", "Why does this matter to you?"],
              ["skills", "What have you gotten better at?"],
              ["growth", "How have you changed since you started?"],
              ["memorable", "What's one moment you remember?"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`det-r-${key}`}>{label}</label>
              <textarea
                id={`det-r-${key}`}
                rows={2}
                value={activity.reflections?.[key] ?? ""}
                disabled={!canEdit}
                onBlur={(e) =>
                  patchActivity({
                    reflections: { ...activity.reflections, [key]: e.target.value },
                  })
                }
                onChange={(e) =>
                  patchActivity({
                    reflections: { ...activity.reflections, [key]: e.target.value },
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="det-sec" id="detail-moments">
        <h3>Moments</h3>
        <p className="det-sub">
          Things that happened: a show, a competition, a new role, something you learned.
        </p>
        {updatesNewest.length ? (
          <ul className="det-moments">
            {updatesNewest.map((update) => (
              <li key={update.id}>
                <span className="det-moment-date">{formatShortDate(update.date)}</span>
                <span>
                  <span className="det-moment-what">{update.whatHappened}</span>
                  {update.recognition ? (
                    <span className="det-moment-meta">Recognition: {update.recognition}</span>
                  ) : null}
                  {update.learned ? (
                    <span className="det-moment-meta">Learned: {update.learned}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : !showMoment ? (
          <p className="det-empty">
            No moments yet.
            {canEdit ? (
              <>
                {" "}
                <button
                  type="button"
                  className="aj-text-btn strong"
                  onClick={() => setShowMoment(true)}
                >
                  + Add a moment
                </button>
              </>
            ) : null}
          </p>
        ) : null}
        {canEdit && showMoment ? (
          <form
            className="det-moment-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!momentWhat.trim()) return;
              commit(
                addUpdate(journalRef.current, activity.id, {
                  date: momentDate || todayIsoDate(),
                  whatHappened: momentWhat.trim(),
                  recognition: momentRecognition.trim() || undefined,
                  learned: momentLearned.trim() || undefined,
                }),
              );
              setShowMoment(false);
              setMomentWhat("");
              setMomentRecognition("");
              setMomentLearned("");
              setMomentDate(todayIsoDate());
            }}
          >
            <label>
              Date
              <input
                type="date"
                value={momentDate}
                onChange={(e) => setMomentDate(e.target.value)}
              />
            </label>
            <label>
              What happened?
              <textarea
                rows={2}
                required
                value={momentWhat}
                onChange={(e) => setMomentWhat(e.target.value)}
              />
            </label>
            <label>
              Any recognition?
              <input
                value={momentRecognition}
                onChange={(e) => setMomentRecognition(e.target.value)}
              />
            </label>
            <label>
              What did you learn?
              <input value={momentLearned} onChange={(e) => setMomentLearned(e.target.value)} />
            </label>
            <div className="det-form-actions">
              <button type="submit" className="aj-recall-add" disabled={!momentWhat.trim()}>
                Save moment
              </button>
              <button type="button" className="aj-text-btn" onClick={() => setShowMoment(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
        {canEdit && updatesNewest.length && !showMoment ? (
          <p className="det-sub">
            <button type="button" className="aj-text-btn strong" onClick={() => setShowMoment(true)}>
              + Add a moment
            </button>
          </p>
        ) : null}
      </section>

      <section className="det-sec" id="detail-awards">
        <h3>Awards</h3>
        {awards.length ? (
          <ul className="det-awards">
            {awards.map((award) => (
              <li key={award.id}>
                <span className="rec-award-name">{award.title}</span>
                <span className="rec-award-meta">
                  {[award.organization, award.date, award.grade ? gradeLabel(award.grade) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="det-empty">
            None linked to this activity.
            {canEdit ? (
              <>
                {" "}
                <button
                  type="button"
                  className="aj-text-btn strong"
                  onClick={() => setShowAward(true)}
                >
                  + Add an award
                </button>
              </>
            ) : null}
          </p>
        )}
        {canEdit && showAward ? (
          <AddAwardForm
            activities={[activity]}
            presetActivityId={activity.id}
            onCancel={() => setShowAward(false)}
            onSave={(award) => {
              commit(upsertAward(journalRef.current, { ...award, activityId: activity.id }));
              setShowAward(false);
            }}
          />
        ) : null}
        {canEdit && awards.length && !showAward ? (
          <p className="det-sub">
            <button type="button" className="aj-text-btn strong" onClick={() => setShowAward(true)}>
              + Add an award
            </button>
          </p>
        ) : null}
      </section>

      <section className="det-sec" id="detail-people">
        <h3>People and Links</h3>
        {(activity.mentorName || activity.mentorRole || activity.mentorEmail || (activity.links ?? []).length) ? (
          <>
            {(activity.mentorName || activity.mentorRole || activity.mentorEmail || showPerson) && (
              <div className="det-qa">
                <div>
                  <label htmlFor="det-mentor-name">Who knows your work?</label>
                  <input
                    id="det-mentor-name"
                    placeholder="Name"
                    value={activity.mentorName ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => patchActivity({ mentorName: e.target.value || undefined })}
                  />
                </div>
                <div>
                  <label htmlFor="det-mentor-role">Their role</label>
                  <input
                    id="det-mentor-role"
                    value={activity.mentorRole ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => patchActivity({ mentorRole: e.target.value || undefined })}
                  />
                </div>
                <div>
                  <label htmlFor="det-mentor-email">Email</label>
                  <input
                    id="det-mentor-email"
                    type="email"
                    value={activity.mentorEmail ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => patchActivity({ mentorEmail: e.target.value || undefined })}
                  />
                </div>
              </div>
            )}
            <ul className="det-links">
              {(activity.links ?? []).map((link) => (
                <li key={link.id}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label || link.url}
                  </a>
                  {link.note ? <span className="det-moment-meta"> {link.note}</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="det-empty">
            A coach, director or mentor who knows your work, and links to recordings or photos.
            {canEdit ? (
              <>
                {" "}
                <button
                  type="button"
                  className="aj-text-btn strong"
                  onClick={() => setShowPerson(true)}
                >
                  + Add a person
                </button>
                {" · "}
                <button
                  type="button"
                  className="aj-text-btn strong"
                  onClick={() => setShowLink(true)}
                >
                  + Add a link
                </button>
              </>
            ) : null}
          </p>
        )}
        {canEdit && showPerson && !(activity.mentorName || activity.mentorRole || activity.mentorEmail) ? (
          <div className="det-qa">
            <div>
              <label htmlFor="det-mentor-name-new">Who knows your work?</label>
              <input
                id="det-mentor-name-new"
                placeholder="Name"
                value={activity.mentorName ?? ""}
                onChange={(e) => patchActivity({ mentorName: e.target.value || undefined })}
              />
            </div>
            <div>
              <label htmlFor="det-mentor-role-new">Their role</label>
              <input
                id="det-mentor-role-new"
                value={activity.mentorRole ?? ""}
                onChange={(e) => patchActivity({ mentorRole: e.target.value || undefined })}
              />
            </div>
            <div>
              <label htmlFor="det-mentor-email-new">Email</label>
              <input
                id="det-mentor-email-new"
                type="email"
                value={activity.mentorEmail ?? ""}
                onChange={(e) => patchActivity({ mentorEmail: e.target.value || undefined })}
              />
            </div>
          </div>
        ) : null}
        {canEdit && showLink ? (
          <AddLinkForm
            onAdd={(link) => {
              patchActivity({ links: [...(activity.links ?? []), link] });
              setShowLink(false);
            }}
          />
        ) : null}
        {canEdit &&
        (activity.mentorName ||
          activity.mentorRole ||
          activity.mentorEmail ||
          (activity.links ?? []).length) &&
        !showLink ? (
          <p className="det-sub">
            <button type="button" className="aj-text-btn strong" onClick={() => setShowPerson(true)}>
              + Add a person
            </button>
            {" · "}
            <button type="button" className="aj-text-btn strong" onClick={() => setShowLink(true)}>
              + Add a link
            </button>
          </p>
        ) : null}
      </section>
    </div>
  );
}

function AddLinkForm({
  onAdd,
}: {
  onAdd: (link: { id: string; label: string; url: string; note?: string }) => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  return (
    <form
      className="aj-panel aj-panel-tight"
      onSubmit={(e) => {
        e.preventDefault();
        if (!url.trim()) return;
        onAdd({
          id: newId("link"),
          label: label.trim() || "Link",
          url: url.trim(),
          note: note.trim() || undefined,
        });
        setLabel("");
        setUrl("");
        setNote("");
      }}
    >
      <div className="aj-form-grid">
        <label className="stack-field">
          <span className="label">Label</span>
          <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="stack-field">
          <span className="label">URL *</span>
          <input
            className="field"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
          />
        </label>
        <label className="stack-field aj-span-2">
          <span className="label">Note</span>
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div className="aj-actions">
        <button type="submit" className="btn btn-secondary compact">
          Add link
        </button>
      </div>
    </form>
  );
}

function AddAwardForm({
  activities,
  presetActivityId,
  onCancel,
  onSave,
}: {
  activities: Activity[];
  presetActivityId?: string;
  onCancel: () => void;
  onSave: (award: Award) => void;
}) {
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [date, setDate] = useState("");
  const [grade, setGrade] = useState<GradeLevel | "">("");
  const [activityId, setActivityId] = useState(presetActivityId ?? "");
  const [academic, setAcademic] = useState(false);
  const [recognitionLevel, setRecognitionLevel] = useState("");
  const [whatDid, setWhatDid] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="aj-panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) {
          setError("Title is required.");
          return;
        }
        const stamp = new Date().toISOString();
        onSave({
          id: newId("award"),
          title: title.trim(),
          organization: organization.trim() || undefined,
          date: date || undefined,
          grade: grade || undefined,
          activityId: activityId || null,
          academic,
          recognitionLevel: recognitionLevel.trim() || undefined,
          whatDid: whatDid.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
          createdAt: stamp,
          updatedAt: stamp,
        });
      }}
    >
      <h4>Add award</h4>
      <div className="aj-form-grid">
        <label className="stack-field aj-span-2">
          <span className="label">Title *</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="stack-field">
          <span className="label">Organization</span>
          <input
            className="field"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
          />
        </label>
        <label className="stack-field">
          <span className="label">Date</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="stack-field">
          <span className="label">Grade</span>
          <select
            className="field"
            value={grade}
            onChange={(e) => setGrade(e.target.value as GradeLevel | "")}
          >
            <GradeGroupedOptions includeBlank blankLabel="—" />
          </select>
        </label>
        <label className="stack-field">
          <span className="label">Linked activity</span>
          {presetActivityId ? (
            <input
              className="field"
              value={activities.find((a) => a.id === presetActivityId)?.name ?? "This activity"}
              disabled
            />
          ) : (
            <select
              className="field"
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
            >
              <option value="">None</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="stack-field aj-check">
          <span className="label">Academic</span>
          <input
            type="checkbox"
            checked={academic}
            onChange={(e) => setAcademic(e.target.checked)}
          />
        </label>
        <label className="stack-field">
          <span className="label">Recognition level</span>
          <input
            className="field"
            value={recognitionLevel}
            onChange={(e) => setRecognitionLevel(e.target.value)}
            placeholder="School / regional / national…"
          />
        </label>
        <label className="stack-field aj-span-2">
          <span className="label">What you did</span>
          <textarea
            className="field"
            rows={2}
            value={whatDid}
            onChange={(e) => setWhatDid(e.target.value)}
          />
        </label>
        <label className="stack-field aj-span-2">
          <span className="label">Link</span>
          <input
            className="field"
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://"
          />
        </label>
      </div>
      {error ? <p className="aj-error">{error}</p> : null}
      <div className="aj-actions">
        <button type="submit" className="btn btn-primary">
          Save award
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function PrepView({
  journal,
  canEdit,
  loaded = true,
  onChange,
  onOpenActivity,
  onGoToMyRecord,
  onGoToAwards,
}: {
  journal: Journal;
  canEdit: boolean;
  loaded?: boolean;
  onChange: (next: Journal) => void;
  onOpenActivity: (id: string) => void;
  onGoToMyRecord: () => void;
  onGoToAwards: () => void;
}) {
  const [section, setSection] = useState<"activities" | "honors">("activities");
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedHonorId, setSelectedHonorId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const ensuredRef = useRef(false);

  useEffect(() => {
    if (!loaded || !canEdit || ensuredRef.current) return;
    if (journal.applicationLists.some((l) => l.id === COMMON_APP_LIST_ID)) {
      ensuredRef.current = true;
      return;
    }
    ensuredRef.current = true;
    onChange(ensureCommonAppList(journal));
  }, [loaded, canEdit, journal, onChange]);

  const list = canEdit
    ? journal.applicationLists.find((l) => l.id === COMMON_APP_LIST_ID) ?? null
    : getCommonAppList(journal);

  const ordered = list
    ? [...list.entries].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];
  const honors = list
    ? [...(list.honors ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  const selectedDraft =
    ordered.find((d) => d.id === selectedDraftId) ?? ordered[0] ?? null;
  const selectedActivity = selectedDraft
    ? journal.activities.find((a) => a.id === selectedDraft.activityId)
    : null;

  const activeActivities = journal.activities.filter((a) => !a.archived);
  const chosenIds = new Set(ordered.map((d) => d.activityId));
  const poolActivities = activeActivities
    .filter((a) => !chosenIds.has(a.id))
    .sort((a, b) => {
      const ga = commonAppGrades(a).length;
      const gb = commonAppGrades(b).length;
      if (gb !== ga) return gb - ga;
      return a.name.localeCompare(b.name);
    });

  const activeAwards = journal.awards.filter((a) => !a.archived);
  const chosenAwardIds = new Set(honors.map((h) => h.awardId));
  const poolAwards = activeAwards
    .filter((a) => !chosenAwardIds.has(a.id))
    .sort((a, b) => a.title.localeCompare(b.title));

  const summary = list
    ? prepSummary(list, journal)
    : "0 of 10 activities chosen, 0 ready. 0 of 5 honors chosen. Built from My Record, in Common App fields.";

  function moveDraft(draftId: string, direction: -1 | 1) {
    if (!list || !canEdit) return;
    const idx = ordered.findIndex((d) => d.id === draftId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx]!;
    const b = ordered[swapIdx]!;
    let next = reorderDraft(journal, list.id, a.id, b.sortOrder);
    next = reorderDraft(next, list.id, b.id, a.sortOrder);
    onChange(next);
  }

  function patchDraft(patch: Partial<ApplicationDraft>, draft = selectedDraft) {
    if (!list || !draft || !canEdit) return;
    const nextPatch = { ...patch };
    if (
      draft.reviewStatus === "reviewed" &&
      ("draftRole" in patch ||
        "draftOrg" in patch ||
        "shortDescription" in patch ||
        "continueInCollegeChoice" in patch)
    ) {
      nextPatch.reviewStatus = "draft";
      nextPatch.reviewedAt = undefined;
    }
    onChange(upsertDraft(journal, list.id, { ...draft, ...nextPatch }));
  }

  function addActivity(activity: Activity) {
    if (!list || !canEdit || ordered.length >= 10) return;
    const maxOrder = ordered.reduce((m, d) => Math.max(m, d.sortOrder), -1);
    const draft: ApplicationDraft = {
      id: newId("draft"),
      activityId: activity.id,
      sortOrder: maxOrder + 1,
      reviewStatus: "draft",
      draftRole: clipChars(activity.role, APP_DRAFT_LIMITS.role),
      draftOrg: clipChars(activity.organization, APP_DRAFT_LIMITS.org),
    };
    onChange(upsertDraft(journal, list.id, draft));
    setSelectedDraftId(draft.id);
    setSection("activities");
  }

  function moveHonor(honorId: string, direction: -1 | 1) {
    if (!list || !canEdit) return;
    const idx = honors.findIndex((h) => h.id === honorId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= honors.length) return;
    const a = honors[idx]!;
    const b = honors[swapIdx]!;
    let next = upsertHonor(journal, list.id, { ...a, sortOrder: b.sortOrder });
    next = upsertHonor(next, list.id, { ...b, sortOrder: a.sortOrder });
    onChange(next);
  }

  function patchHonor(honor: HonorDraft, patch: Partial<HonorDraft>) {
    if (!list || !canEdit) return;
    const nextPatch = { ...patch };
    if (
      honor.reviewStatus === "reviewed" &&
      ("title" in patch || "grades" in patch || "level" in patch)
    ) {
      nextPatch.reviewStatus = "draft";
    }
    onChange(upsertHonor(journal, list.id, { ...honor, ...nextPatch }));
  }

  function addHonor(award: Award) {
    if (!list || !canEdit || honors.length >= HONOR_LIMITS.count) return;
    const gradeNum =
      award.grade && award.grade !== "post" && award.grade !== "other"
        ? Number(award.grade)
        : NaN;
    const grades =
      Number.isInteger(gradeNum) && gradeNum >= 9 && gradeNum <= 12 ? [gradeNum] : [];
    const maxOrder = honors.reduce((m, h) => Math.max(m, h.sortOrder), -1);
    const honor: HonorDraft = {
      id: newId("honor"),
      awardId: award.id,
      sortOrder: maxOrder + 1,
      title: clipChars(award.title, HONOR_LIMITS.title) ?? "",
      grades,
      level: inferHonorLevel(award.recognitionLevel),
      reviewStatus: "draft",
    };
    onChange(upsertHonor(journal, list.id, honor));
    setSelectedHonorId(honor.id);
    setSection("honors");
  }

  async function copyAll() {
    if (!list) return;
    const text = commonAppCopyText(list, journal);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFallback(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyFallback(text);
    }
  }

  const emptyRecord = !activeActivities.length;

  return (
    <div className="aj-view prep">
      <header className="prep-head">
        <div>
          <h3 className="prep-title">Application Prep</h3>
          <p className="prep-sum">{summary}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void copyAll()}>
          {copied ? "Copied" : "Copy all for the Common App"}
        </button>
      </header>

      {!loaded ? null : (
        <>
      {copyFallback ? (
        <div className="prep-copy-fallback">
          <p>Copy failed. Select the text and copy it yourself.</p>
          <textarea
            readOnly
            rows={12}
            value={copyFallback}
            onFocus={(e) => e.currentTarget.select()}
            ref={(el) => el?.select()}
          />
        </div>
      ) : null}

      <div className="prep-seg" role="group" aria-label="Section">
        <button
          type="button"
          aria-pressed={section === "activities"}
          onClick={() => setSection("activities")}
        >
          Activities
        </button>
        <button
          type="button"
          aria-pressed={section === "honors"}
          onClick={() => setSection("honors")}
        >
          Honors
        </button>
      </div>

      {section === "activities" ? (
        emptyRecord ? (
          <p className="board-empty">
            Your list is empty because My Record is empty.{" "}
            <button type="button" className="aj-text-btn strong" onClick={onGoToMyRecord}>
              Go to My Record
            </button>
          </p>
        ) : (
          <div className="prep-layout">
            <div className="prep-col">
              <div className="prep-col-h">
                <h3>Your list</h3>
                <span className="prep-count">{ordered.length} / 10</span>
              </div>
              {ordered.length ? (
                <ol className="prep-chosen">
                  {ordered.map((draft, index) => {
                    const act = journal.activities.find((a) => a.id === draft.activityId);
                    const state = draftStateLabel(draft, act);
                    const selected = selectedDraft?.id === draft.id;
                    return (
                      <li
                        key={draft.id}
                        className={selected ? "is-selected" : undefined}
                      >
                        <button
                          type="button"
                          className="prep-chosen-btn"
                          onClick={() => setSelectedDraftId(draft.id)}
                        >
                          <span className="prep-num">{index + 1}</span>
                          <span className="prep-c-name">
                            {act?.name ?? draft.activityId}
                            {act ? <span className="prep-c-sub">{chosenActivitySub(act)}</span> : null}
                          </span>
                          <span className={`prep-state is-${state.kind}`}>{state.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="prep-hint">No activities on the list yet.</p>
              )}
              <p className="prep-hint">
                Colleges see them in this order. Put the ones that matter most to you first.
              </p>
              {poolActivities.length ? (
                <>
                  <p className="prep-pool-h">From My Record, not on the list</p>
                  <ul className="prep-pool">
                    {poolActivities.map((activity) => {
                      const atLimit = ordered.length >= 10;
                      return (
                        <li key={activity.id}>
                          <span>
                            {activity.name}{" "}
                            <span className="prep-why">{poolActivityFact(activity)}</span>
                          </span>
                          {canEdit ? (
                            atLimit ? (
                              <span className="prep-why">The Common App holds 10. Remove one to add another.</span>
                            ) : (
                              <button
                                type="button"
                                className="aj-text-btn strong"
                                onClick={() => addActivity(activity)}
                              >
                                Add
                              </button>
                            )
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
            </div>

            {selectedDraft && selectedActivity ? (
              <section className="prep-editor" aria-labelledby="prep-entry-h">
                <div className="prep-e-head">
                  <h3 id="prep-entry-h" className="aj-activity-label">
                    <ActivityIcon activity={selectedActivity} size={22} />
                    {selectedActivity.name}
                  </h3>
                  {canEdit ? (
                    <span className="prep-e-tools">
                      <button
                        type="button"
                        className="aj-text-btn"
                        disabled={ordered[0]?.id === selectedDraft.id}
                        onClick={() => moveDraft(selectedDraft.id, -1)}
                      >
                        Move up
                      </button>
                      {" · "}
                      <button
                        type="button"
                        className="aj-text-btn"
                        disabled={ordered[ordered.length - 1]?.id === selectedDraft.id}
                        onClick={() => moveDraft(selectedDraft.id, 1)}
                      >
                        Move down
                      </button>
                      {" · "}
                      <button
                        type="button"
                        className="aj-text-btn"
                        onClick={() => {
                          onChange(removeDraftFromList(journal, list!.id, selectedDraft.id));
                          setSelectedDraftId(null);
                        }}
                      >
                        Remove
                      </button>
                    </span>
                  ) : null}
                </div>

                {(() => {
                  const grades = commonAppGrades(selectedActivity);
                  const timing = commonAppTiming(selectedActivity);
                  const time = commonAppTime(selectedActivity);
                  const gradeText = grades.length ? grades.join(", ") : null;
                  return (
                    <>
                      <div className="prep-facts">
                        <div className="prep-fact">
                          <span>Grades</span>
                          {gradeText ? (
                            <b>{gradeText}</b>
                          ) : (
                            <button
                              type="button"
                              className="prep-missing"
                              onClick={() => onOpenActivity(selectedActivity.id)}
                            >
                              Add in My Record
                            </button>
                          )}
                        </div>
                        <div className="prep-fact">
                          <span>Timing</span>
                          {timing ? (
                            <b>{timing}</b>
                          ) : (
                            <button
                              type="button"
                              className="prep-missing"
                              onClick={() => onOpenActivity(selectedActivity.id)}
                            >
                              Add in My Record
                            </button>
                          )}
                        </div>
                        <div className="prep-fact">
                          <span>Hours per week</span>
                          {time.hoursPerWeek != null ? (
                            <b>{time.hoursPerWeek}</b>
                          ) : (
                            <button
                              type="button"
                              className="prep-missing"
                              onClick={() => onOpenActivity(selectedActivity.id)}
                            >
                              Add in My Record
                            </button>
                          )}
                        </div>
                        <div className="prep-fact">
                          <span>Weeks per year</span>
                          {time.weeksPerYear != null ? (
                            <b>{time.weeksPerYear}</b>
                          ) : (
                            <button
                              type="button"
                              className="prep-missing"
                              onClick={() => onOpenActivity(selectedActivity.id)}
                            >
                              Add in My Record
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="prep-facts-note">
                        These come from My Record. Change them there and they update here.
                      </p>
                      {middleSchoolGrades(selectedActivity).length ? (
                        <p className="prep-facts-note">
                          The Common App lists grades 9-12. Your earlier years belong in your essays.
                        </p>
                      ) : null}
                    </>
                  );
                })()}

                <PrepField
                  id="prep-role"
                  label="Position or leadership"
                  value={selectedDraft.draftRole ?? ""}
                  limit={APP_DRAFT_LIMITS.role}
                  disabled={!canEdit}
                  onChange={(value) => patchDraft({ draftRole: value })}
                />
                <PrepField
                  id="prep-org"
                  label="Organization"
                  value={selectedDraft.draftOrg ?? ""}
                  limit={APP_DRAFT_LIMITS.org}
                  disabled={!canEdit}
                  onChange={(value) => patchDraft({ draftOrg: value })}
                />
                <PrepField
                  id="prep-desc"
                  label="Description"
                  note="about 20-25 words"
                  value={selectedDraft.shortDescription ?? ""}
                  limit={APP_DRAFT_LIMITS.short}
                  disabled={!canEdit}
                  multiline
                  onChange={(value) => patchDraft({ shortDescription: value })}
                />

                <div className="prep-field">
                  <span className="prep-f-label">Do you plan to do this in college?</span>
                  <div className="prep-pills" role="group" aria-label="Continue in college">
                    <button
                      type="button"
                      aria-pressed={selectedDraft.continueInCollegeChoice === true}
                      disabled={!canEdit}
                      onClick={() => patchDraft({ continueInCollegeChoice: true })}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      aria-pressed={selectedDraft.continueInCollegeChoice === false}
                      disabled={!canEdit}
                      onClick={() => patchDraft({ continueInCollegeChoice: false })}
                    >
                      No
                    </button>
                  </div>
                </div>

                {isDraftStale(selectedDraft, selectedActivity) ? (
                  <p className="prep-stale">
                    My Record changed after you marked this ready. Check the facts and text, then mark it ready again.
                  </p>
                ) : null}

                {canEdit ? (
                  <div className="prep-foot">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={draftIsOverLimit(selectedDraft)}
                      onClick={() => {
                        if (selectedDraft.reviewStatus === "reviewed") {
                          patchDraft({ reviewStatus: "draft", reviewedAt: undefined }, selectedDraft);
                        } else {
                          patchDraft(
                            {
                              reviewStatus: "reviewed",
                              reviewedAt: new Date().toISOString(),
                            },
                            selectedDraft,
                          );
                        }
                      }}
                    >
                      {selectedDraft.reviewStatus === "reviewed"
                        ? "Ready - mark as draft"
                        : "Mark as ready"}
                    </button>
                    {draftIsOverLimit(selectedDraft) ? (
                      <span className="prep-over-note">Shorten the fields in red first.</span>
                    ) : null}
                  </div>
                ) : null}

                <PrepSourceNotes
                  activity={selectedActivity}
                  awards={activeAwards.filter((a) => a.activityId === selectedActivity.id)}
                  onOpenActivity={() => onOpenActivity(selectedActivity.id)}
                />
              </section>
            ) : ordered.length ? (
              <p className="prep-hint">Pick an activity from your list.</p>
            ) : null}
          </div>
        )
      ) : (
        <div className="prep-honors">
          <div className="prep-col-h">
            <h3>Honors</h3>
            <span className="prep-count">{honors.length} / {HONOR_LIMITS.count}</span>
          </div>
          <p className="prep-hint">
            The Common App asks for up to 5 academic honors from high school. Other recognition can go in an activity&apos;s description.
          </p>

          {honors.map((honor, index) => {
            const titleOver = charCount(honor.title) > HONOR_LIMITS.title;
            const canReady =
              !titleOver && honor.grades.length > 0 && honor.level != null;
            return (
              <div
                key={honor.id}
                className={
                  selectedHonorId === honor.id ? "prep-honor is-selected" : "prep-honor"
                }
              >
                <PrepField
                  id={`honor-title-${honor.id}`}
                  label="Honor title"
                  value={honor.title}
                  limit={HONOR_LIMITS.title}
                  disabled={!canEdit}
                  onChange={(value) => patchHonor(honor, { title: value })}
                  onFocus={() => setSelectedHonorId(honor.id)}
                />
                <div className="prep-honor-row">
                  <span className="prep-honor-lbl">Grades</span>
                  <div className="prep-pills" role="group" aria-label="Honor grades">
                    {[9, 10, 11, 12].map((g) => {
                      const on = honor.grades.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          aria-pressed={on}
                          disabled={!canEdit}
                          onClick={() => {
                            const grades = on
                              ? honor.grades.filter((x) => x !== g)
                              : [...honor.grades, g].sort((a, b) => a - b);
                            patchHonor(honor, { grades });
                          }}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="prep-honor-row">
                  <span className="prep-honor-lbl">Level</span>
                  <div className="prep-pills" role="group" aria-label="Honor level">
                    {(Object.keys(HONOR_LEVEL_LABEL) as HonorLevel[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        aria-pressed={honor.level === level}
                        disabled={!canEdit}
                        onClick={() => patchHonor(honor, { level })}
                      >
                        {HONOR_LEVEL_LABEL[level]}
                      </button>
                    ))}
                  </div>
                </div>
                {canEdit ? (
                  <div className="prep-honor-row prep-e-tools">
                    <button
                      type="button"
                      className="aj-text-btn"
                      disabled={index === 0}
                      onClick={() => moveHonor(honor.id, -1)}
                    >
                      Move up
                    </button>
                    {" · "}
                    <button
                      type="button"
                      className="aj-text-btn"
                      disabled={index === honors.length - 1}
                      onClick={() => moveHonor(honor.id, 1)}
                    >
                      Move down
                    </button>
                    {" · "}
                    <button
                      type="button"
                      className="aj-text-btn"
                      onClick={() => onChange(removeHonorFromList(journal, list!.id, honor.id))}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!canReady && honor.reviewStatus !== "reviewed"}
                      onClick={() => {
                        if (honor.reviewStatus === "reviewed") {
                          patchHonor(honor, { reviewStatus: "draft" });
                        } else if (canReady) {
                          patchHonor(honor, { reviewStatus: "reviewed" });
                        }
                      }}
                    >
                      {honor.reviewStatus === "reviewed"
                        ? "Ready - mark as draft"
                        : "Mark as ready"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

          {!activeAwards.length ? (
            <div className="prep-empty-box">
              No awards in My Record yet.{" "}
              <button type="button" className="aj-text-btn strong" onClick={onGoToAwards}>
                Add an award in My Record
              </button>
            </div>
          ) : poolAwards.length ? (
            <>
              <p className="prep-pool-h">From My Record, not on the list</p>
              <ul className="prep-pool">
                {poolAwards.map((award) => {
                  const atLimit = honors.length >= HONOR_LIMITS.count;
                  return (
                    <li key={award.id}>
                      <span>
                        {award.title}
                        {award.academic === false ? (
                          <span className="prep-why"> Not marked academic</span>
                        ) : null}
                      </span>
                      {canEdit ? (
                        atLimit ? (
                          <span className="prep-why">The Common App holds 5. Remove one to add another.</span>
                        ) : (
                          <button
                            type="button"
                            className="aj-text-btn strong"
                            onClick={() => addHonor(award)}
                          >
                            Add
                          </button>
                        )
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>
      )}
        </>
      )}
    </div>
  );
}

function PrepField({
  id,
  label,
  note,
  value,
  limit,
  disabled,
  multiline,
  onChange,
  onFocus,
}: {
  id: string;
  label: string;
  note?: string;
  value: string;
  limit: number;
  disabled?: boolean;
  multiline?: boolean;
  onChange: (value: string) => void;
  onFocus?: () => void;
}) {
  const n = charCount(value);
  const over = n > limit;
  return (
    <div className={over ? "prep-field is-over" : "prep-field"}>
      <div className="prep-f-top">
        <label className="prep-f-label" htmlFor={id}>
          {label}
          {note ? <small> {note}</small> : null}
        </label>
        <span className={over ? "prep-counter is-over" : "prep-counter"}>
          {n} / {limit}
        </span>
      </div>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          disabled={disabled}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          value={value}
          disabled={disabled}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
      )}
    </div>
  );
}

function PrepSourceNotes({
  activity,
  awards,
  onOpenActivity,
}: {
  activity: Activity;
  awards: Award[];
  onOpenActivity: () => void;
}) {
  const updates = [...activity.updates]
    .sort((a, b) => {
      const da = Date.parse(a.date) || 0;
      const db = Date.parse(b.date) || 0;
      if (db !== da) return db - da;
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    })
    .slice(0, 3);
  const role = activity.role?.trim();
  const what = activity.responsibilities?.trim();
  const why = activity.reflections?.whyMatters?.trim();
  const allEmpty = !role && !what && !why && !updates.length && !awards.length;

  return (
    <div className="prep-notes">
      <h4>From My Record</h4>
      <dl>
        <dt>Role</dt>
        <dd className={role ? undefined : "is-empty"}>{role || "Not added yet"}</dd>
        <dt>What you do</dt>
        <dd className={what ? undefined : "is-empty"}>{what || "Not added yet"}</dd>
        <dt>Why it matters</dt>
        <dd className={why ? undefined : "is-empty"}>{why || "Not added yet"}</dd>
        <dt>Updates</dt>
        <dd className={updates.length ? undefined : "is-empty"}>
          {updates.length
            ? updates.map((u) => `${formatShortDate(u.date)}: ${u.whatHappened}`).join(" · ")
            : "None yet"}
        </dd>
        <dt>Awards</dt>
        <dd className={awards.length ? undefined : "is-empty"}>
          {awards.length ? awards.map((a) => a.title).join(", ") : "None yet"}
        </dd>
      </dl>
      {allEmpty ? (
        <p className="prep-hint">
          <button type="button" className="aj-text-btn strong" onClick={onOpenActivity}>
            Add details in My Record
          </button>{" "}
          to have more to draft from.
        </p>
      ) : null}
    </div>
  );
}
