"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivitiesRecall } from "./ActivitiesRecall";
import { GradeStrip } from "./GradeStrip";
import { GraduationYearPicker } from "./GraduationYearPicker";
import { PlanView } from "./PlanView";
import { RecallAnswerCard, emptyRecallState, nextRecallPick, recallSpanComplete, type RecallAnswerState } from "./RecallAnswerCard";
import { ActivityIcon } from "./ActivityIcon";
import { useEnsureActivityIcons } from "./use-activity-icons";
import { pickActivityIcon } from "@/lib/activity-icons";
import { ACTIVITIES_VIEWS, type ActivitiesViewId } from "@/lib/apps-materials";
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
  createThread,
  currentGrade,
  deleteThread,
  ensureCommonAppList,
  estimatedHours,
  getCommonAppList,
  gradeCells,
  inferHonorLevel,
  isDraftStale,
  isSelfStartedProject,
  newId,
  prepSummary,
  recordSchoolYears,
  recordSpanText,
  recordSummary,
  removeActivity,
  removeDraftFromList,
  removeHonorFromList,
  renameThread,
  reorderDraft,
  restoreActivity,
  resolveClassOf,
  setClassOf,
  sortRecordActivities,
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
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [detailTab, setDetailTab] = useState<DetailTab | undefined>(undefined);
  const [focusAwards, setFocusAwards] = useState(false);

  useEffect(() => {
    if (view !== "my") setHighlightIds([]);
  }, [view]);

  useEnsureActivityIcons(journal, onChange, canEdit && loaded);

  const openActivity = openActivityId
    ? journal.activities.find((a) => a.id === openActivityId) ?? null
    : null;

  function openActivityAt(id: string | null, tab?: DetailTab) {
    setDetailTab(tab);
    onOpenActivity(id);
  }

  function goToMyRecord(activityId?: string | null, tab?: DetailTab) {
    onViewChange("my");
    if (activityId) openActivityAt(activityId, tab);
    else {
      openActivityAt(null);
    }
  }

  function goToAwards() {
    setFocusAwards(true);
    onViewChange("my");
    openActivityAt(null);
  }

  return (
    <div className="aj">
      <nav className="aj-view-nav" aria-label="Activities views">
        {ACTIVITIES_VIEWS.map((item) => {
          const selected = item.id === view;
          return (
            <button
              key={item.id}
              type="button"
              className={selected ? "aj-view-tab active" : "aj-view-tab"}
              aria-current={selected ? "page" : undefined}
              onClick={() => {
                onViewChange(item.id);
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {view === "my" ? (
        openActivity ? (
          <ActivityDetail
            key={openActivity.id}
            journal={journal}
            activity={openActivity}
            canEdit={canEdit}
            initialTab={detailTab}
            onChange={onChange}
            onBack={() => openActivityAt(null)}
          />
        ) : (
          <MyActivitiesView
            journal={journal}
            canEdit={canEdit}
            loaded={loaded}
            highlightIds={highlightIds}
            onHighlightIds={setHighlightIds}
            onChange={onChange}
            onOpenActivity={openActivityAt}
            focusAwards={focusAwards}
            onFocusAwardsHandled={() => setFocusAwards(false)}
          />
        )
      ) : null}

      {view === "plan" ? (
        <PlanView
          journal={journal}
          canEdit={canEdit}
          loaded={loaded}
          onChange={onChange}
          onOpenActivity={(id, tab) => goToMyRecord(id, tab ?? "overview")}
          onGoToMyRecord={() => goToMyRecord(null)}
        />
      ) : null}

      {view === "prep" ? (
        <PrepView
          journal={journal}
          canEdit={canEdit}
          loaded={loaded}
          onChange={onChange}
          onOpenActivity={(id) => goToMyRecord(id, "periods")}
          onGoToMyRecord={() => goToMyRecord(null)}
          onGoToAwards={goToAwards}
        />
      ) : null}
    </div>
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
}) {
  const [recallOpen, setRecallOpen] = useState(false);
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
  const [groupingMode, setGroupingMode] = useState(false);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [newThreadName, setNewThreadName] = useState("");
  const [renameThreadId, setRenameThreadId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
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
  const showGrouped = hasThreads || groupingMode;
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
    setRecallOpen(false);
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

  function addNamedThread(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const name = newThreadName.trim();
    if (!name) return;
    const { journal: next, thread } = createThread(journalRef.current, name);
    commit(next);
    setNewThreadName("");
    setNewThreadOpen(false);
    setGroupingMode(true);
    return thread;
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
                  <button
                    type="button"
                    role="menuitem"
                    className="is-new"
                    onClick={() => {
                      setMoveMenuId(null);
                      setNewThreadOpen(true);
                      setGroupingMode(true);
                    }}
                  >
                    + New thread
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

  function renderNewThreadForm(key: string) {
    if (!canEdit || !newThreadOpen) return null;
    return (
      <form key={key} className="rec-thread-new" onSubmit={addNamedThread}>
        <label htmlFor={`rec-thread-name-${key}`} className="sr-only">
          Thread name
        </label>
        <input
          id={`rec-thread-name-${key}`}
          autoComplete="off"
          autoFocus
          placeholder="Name the thread"
          value={newThreadName}
          onChange={(e) => setNewThreadName(e.target.value)}
        />
        <button type="submit" className="aj-recall-add" disabled={!newThreadName.trim()}>
          Add
        </button>
        <button
          type="button"
          className="aj-text-btn"
          onClick={() => {
            setNewThreadOpen(false);
            setNewThreadName("");
            if (!(journalRef.current.threads?.length)) setGroupingMode(false);
          }}
        >
          Cancel
        </button>
      </form>
    );
  }

  function renderThreadHeader(thread: ActivityThread, count: number) {
    if (deleteThreadId === thread.id) {
      return (
        <div key={`del-${thread.id}`} className="rec-group-h">
          <p className="rec-group-confirm">
            Delete the {thread.name} thread? The activities stay in My Record.
          </p>
          <span className="rec-group-tools">
            <button
              type="button"
              className="aj-text-btn strong"
              onClick={() => {
                commit(deleteThread(journalRef.current, thread.id));
                setDeleteThreadId(null);
              }}
            >
              Delete
            </button>
            <button type="button" className="aj-text-btn" onClick={() => setDeleteThreadId(null)}>
              Cancel
            </button>
          </span>
        </div>
      );
    }
    if (renameThreadId === thread.id) {
      return (
        <form
          key={`ren-${thread.id}`}
          className="rec-group-h"
          onSubmit={(e) => {
            e.preventDefault();
            if (!renameDraft.trim()) return;
            commit(renameThread(journalRef.current, thread.id, renameDraft));
            setRenameThreadId(null);
            setRenameDraft("");
          }}
        >
          <input
            className="rec-group-rename"
            value={renameDraft}
            autoFocus
            onChange={(e) => setRenameDraft(e.target.value)}
            aria-label="Thread name"
          />
          <span className="rec-group-tools">
            <button type="submit" className="aj-text-btn strong" disabled={!renameDraft.trim()}>
              Save
            </button>
            <button
              type="button"
              className="aj-text-btn"
              onClick={() => {
                setRenameThreadId(null);
                setRenameDraft("");
              }}
            >
              Cancel
            </button>
          </span>
        </form>
      );
    }
    return (
      <div key={`h-${thread.id}`} className="rec-group-h">
        <h3>{thread.name}</h3>
        <span className="rec-group-count">
          {count} {count === 1 ? "activity" : "activities"}
        </span>
        {canEdit ? (
          <span className="rec-group-tools">
            <button
              type="button"
              className="aj-text-btn"
              onClick={() => {
                setRenameThreadId(thread.id);
                setRenameDraft(thread.name);
                setDeleteThreadId(null);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="aj-text-btn"
              onClick={() => {
                setDeleteThreadId(thread.id);
                setRenameThreadId(null);
              }}
            >
              Delete
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
            <button type="button" className="btn btn-secondary" onClick={() => setRecallOpen(true)}>
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
                {threads.map((thread) => {
                  const groupRows = sortRecordActivities(
                    rows.filter((a) => a.threadId === thread.id),
                  );
                  return (
                    <div key={thread.id} className="rec-group">
                      {renderThreadHeader(thread, groupRows.length)}
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
                    {canEdit ? (
                      <span className="rec-group-tools">
                        <button
                          type="button"
                          className="aj-text-btn strong"
                          onClick={() => {
                            setNewThreadOpen(true);
                            setGroupingMode(true);
                          }}
                        >
                          + New thread
                        </button>
                      </span>
                    ) : null}
                  </div>
                  {renderNewThreadForm("loose")}
                  {sortRecordActivities(rows.filter((a) => !a.threadId)).map((activity) =>
                    renderRecordRow(activity),
                  )}
                </div>
              </>
            )
          : rows.map((activity) => renderRecordRow(activity))}

        {!showGrouped && canEdit && activeCount >= 3 ? (
          <div className="rec-thread-hint">
            <span>
              Some of these go together. Group them into threads, like everything you do with music.
            </span>
            <button
              type="button"
              className="aj-text-btn strong"
              onClick={() => {
                setGroupingMode(true);
                setNewThreadOpen(true);
              }}
            >
              Group into threads
            </button>
          </div>
        ) : null}

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
  const [tab, setTab] = useState<DetailTab>(initialTab ?? "overview");
  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  function patchActivity(patch: Partial<Activity>) {
    const next = { ...activity, ...patch };
    if (patch.name != null && patch.name.trim() !== activity.name) {
      next.icon = pickActivityIcon({ ...next, icon: undefined });
    }
    onChange(upsertActivity(journal, next));
  }

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "periods", label: "Participation & Roles" },
    { id: "updates", label: "Updates" },
    { id: "reflections", label: "Reflections" },
    { id: "people", label: "People & Files" },
  ];

  return (
    <div className="aj-detail">
      <div className="aj-detail-bar">
        <button type="button" className="btn btn-secondary compact" onClick={onBack}>
          ← Back
        </button>
        <div className="aj-detail-title-wrap">
          <h3 className="aj-title">
            <ActivityIcon activity={activity} size={26} />
            <span>{activity.name}</span>
          </h3>
          <span className="aj-pill">{activityStatusLabel(activity)}</span>
        </div>
        {canEdit ? (
          confirmArchive ? (
            <div className="aj-actions">
              <span className="aj-muted">Archive this activity?</span>
              <button
                type="button"
                className="btn btn-primary compact"
                onClick={() => {
                  onChange(archiveActivity(journal, activity.id));
                  onBack();
                }}
              >
                Archive
              </button>
              <button
                type="button"
                className="btn btn-secondary compact"
                onClick={() => setConfirmArchive(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-secondary compact"
              onClick={() => setConfirmArchive(true)}
            >
              Archive
            </button>
          )
        ) : null}
      </div>

      <nav className="aj-tabs" aria-label="Activity sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="aj-section">
          <div className="aj-form-grid">
            <label className="stack-field">
              <span className="label">Name</span>
              <input
                className="field"
                value={activity.name}
                disabled={!canEdit}
                onChange={(e) => patchActivity({ name: e.target.value })}
              />
            </label>
            <label className="stack-field">
              <span className="label">Category</span>
              <select
                className="field"
                value={activity.category}
                disabled={!canEdit}
                onChange={(e) =>
                  patchActivity({ category: e.target.value as ActivityCategoryId })
                }
              >
                {ACTIVITY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-field">
              <span className="label">Organization</span>
              <input
                className="field"
                value={activity.organization ?? ""}
                disabled={!canEdit}
                onChange={(e) => patchActivity({ organization: e.target.value })}
              />
            </label>
            <label className="stack-field">
              <span className="label">Role</span>
              <input
                className="field"
                value={activity.role ?? ""}
                disabled={!canEdit}
                onChange={(e) => patchActivity({ role: e.target.value })}
              />
            </label>
            <label className="stack-field aj-check">
              <span className="label">Ongoing</span>
              <input
                type="checkbox"
                checked={activity.ongoing}
                disabled={!canEdit}
                onChange={(e) => patchActivity({ ongoing: e.target.checked })}
              />
            </label>
            <label className="stack-field aj-span-2">
              <span className="label">What do you do?</span>
              <textarea
                className="field"
                rows={3}
                value={activity.responsibilities ?? ""}
                disabled={!canEdit}
                onChange={(e) => patchActivity({ responsibilities: e.target.value })}
              />
            </label>
            <label className="stack-field aj-span-2">
              <span className="label">Organization purpose</span>
              <textarea
                className="field"
                rows={2}
                value={activity.orgPurpose ?? ""}
                disabled={!canEdit}
                onChange={(e) => patchActivity({ orgPurpose: e.target.value })}
              />
            </label>
          </div>
        </div>
      ) : null}

      {tab === "periods" ? (
        <div className="aj-section">
          {canEdit ? (
            <div className="aj-section-actions">
              <button
                type="button"
                className="btn btn-secondary compact"
                onClick={() => setShowAddPeriod((v) => !v)}
              >
                {showAddPeriod ? "Close form" : "Add period"}
              </button>
            </div>
          ) : null}
          {showAddPeriod && canEdit ? (
            <AddPeriodForm
              onCancel={() => setShowAddPeriod(false)}
              onSave={(period) => {
                onChange(addPeriod(journal, activity.id, period));
                setShowAddPeriod(false);
              }}
            />
          ) : null}
          {!activity.periods.length ? (
            <p className="board-empty">No participation periods yet.</p>
          ) : (
            <ul className="aj-card-list">
              {[...activity.periods]
                .sort((a, b) => (b.schoolYear || "").localeCompare(a.schoolYear || ""))
                .map((period) => {
                  const hours = periodHoursLabel(period);
                  return (
                    <li key={period.id} className="aj-card aj-card-compact">
                      <div className="aj-card-main">
                        <div className="aj-card-top">
                          <strong>{period.schoolYear || "Period"}</strong>
                          <span className="aj-pill">{period.status.replace("_", " ")}</span>
                        </div>
                        <p className="aj-card-meta">
                          <span>{gradeLabel(period.grade)}</span>
                          <span>· {PERIOD_KINDS.find((k) => k.id === period.periodKind)?.label}</span>
                          {period.role ? <span>· {period.role}</span> : null}
                          {hours ? <span>· {hours}</span> : null}
                        </p>
                        {period.responsibilities ? (
                          <p className="aj-card-update">{period.responsibilities}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "updates" ? (
        <div className="aj-section">
          {canEdit ? (
            <div className="aj-section-actions">
              <button
                type="button"
                className="btn btn-secondary compact"
                onClick={() => setShowAddUpdate((v) => !v)}
              >
                {showAddUpdate ? "Close form" : "Add update"}
              </button>
            </div>
          ) : null}
          {showAddUpdate && canEdit ? (
            <AddUpdateForm
              activities={[activity]}
              fixedActivityId={activity.id}
              onCancel={() => setShowAddUpdate(false)}
              onSave={(activityId, fields) => {
                onChange(addUpdate(journal, activityId, fields));
                setShowAddUpdate(false);
              }}
            />
          ) : null}
          {!activity.updates.length ? (
            <p className="board-empty">No updates yet.</p>
          ) : (
            <ul className="aj-card-list">
              {[...activity.updates]
                .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                .map((update) => (
                  <UpdateCard key={update.id} update={update} />
                ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "reflections" ? (
        <div className="aj-section">
          <div className="aj-form-grid">
            {(
              [
                ["whyMatters", "Why it matters"],
                ["skills", "Skills"],
                ["growth", "Growth"],
                ["memorable", "Memorable moment"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="stack-field aj-span-2">
                <span className="label">{label}</span>
                <textarea
                  className="field"
                  rows={3}
                  value={activity.reflections?.[key] ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    patchActivity({
                      reflections: {
                        ...activity.reflections,
                        [key]: e.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "people" ? (
        <div className="aj-section">
          <div className="aj-form-grid">
            <label className="stack-field">
              <span className="label">Mentor name</span>
              <input
                className="field"
                value={activity.mentorName ?? ""}
                disabled={!canEdit}
                onChange={(e) => patchActivity({ mentorName: e.target.value })}
              />
            </label>
            <label className="stack-field">
              <span className="label">Mentor role</span>
              <input
                className="field"
                value={activity.mentorRole ?? ""}
                disabled={!canEdit}
                onChange={(e) => patchActivity({ mentorRole: e.target.value })}
              />
            </label>
            <label className="stack-field aj-span-2">
              <span className="label">Mentor email</span>
              <input
                className="field"
                type="email"
                value={activity.mentorEmail ?? ""}
                disabled={!canEdit}
                onChange={(e) => patchActivity({ mentorEmail: e.target.value })}
              />
            </label>
          </div>
          <h4 className="aj-subhead">Links &amp; files</h4>
          <p className="aj-muted">Add URLs only — no uploads.</p>
          <ul className="aj-link-list">
            {(activity.links ?? []).map((link) => (
              <li key={link.id}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.label || link.url}
                </a>
                {link.note ? <span className="aj-muted"> — {link.note}</span> : null}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <AddLinkForm
              onAdd={(link) =>
                patchActivity({ links: [...(activity.links ?? []), link] })
              }
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function UpdateCard({ update }: { update: ActivityUpdate }) {
  return (
    <li className="aj-card aj-card-compact">
      <div className="aj-card-main">
        <div className="aj-card-top">
          <strong>{formatShortDate(update.date)}</strong>
        </div>
        <p className="aj-card-update">{update.whatHappened}</p>
        {update.outcomes ? (
          <p className="aj-card-meta">Outcomes: {update.outcomes}</p>
        ) : null}
        {update.recognition ? (
          <p className="aj-card-meta">Recognition: {update.recognition}</p>
        ) : null}
        {update.learned ? <p className="aj-card-meta">Learned: {update.learned}</p> : null}
      </div>
    </li>
  );
}

function AddPeriodForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (period: Omit<ParticipationPeriod, "id" | "createdAt" | "updatedAt">) => void;
}) {
  const year = new Date().getFullYear();
  const [schoolYear, setSchoolYear] = useState(`${year}–${String((year + 1) % 100).padStart(2, "0")}`);
  const [grade, setGrade] = useState<GradeLevel>("11");
  const [periodKind, setPeriodKind] = useState<PeriodKind>("school_year");
  const [status, setStatus] = useState<PeriodStatus>("in_progress");
  const [role, setRole] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [weeksActive, setWeeksActive] = useState("");
  const [responsibilities, setResponsibilities] = useState("");

  return (
    <form
      className="aj-panel"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          schoolYear: schoolYear.trim(),
          grade,
          periodKind,
          status,
          role: role.trim() || undefined,
          hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : undefined,
          weeksActive: weeksActive ? Number(weeksActive) : undefined,
          responsibilities: responsibilities.trim() || undefined,
        });
      }}
    >
      <h4>Add period</h4>
      <div className="aj-form-grid">
        <label className="stack-field">
          <span className="label">School year</span>
          <input
            className="field"
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            placeholder="2024–25"
          />
        </label>
        <label className="stack-field">
          <span className="label">Grade</span>
          <select
            className="field"
            value={grade}
            onChange={(e) => setGrade(e.target.value as GradeLevel)}
          >
            <GradeGroupedOptions />
          </select>
        </label>
        <label className="stack-field">
          <span className="label">Kind</span>
          <select
            className="field"
            value={periodKind}
            onChange={(e) => setPeriodKind(e.target.value as PeriodKind)}
          >
            {PERIOD_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="stack-field">
          <span className="label">Status</span>
          <select
            className="field"
            value={status}
            onChange={(e) => setStatus(e.target.value as PeriodStatus)}
          >
            {PERIOD_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="stack-field">
          <span className="label">Role</span>
          <input className="field" value={role} onChange={(e) => setRole(e.target.value)} />
        </label>
        <label className="stack-field">
          <span className="label">Hours / week</span>
          <input
            className="field"
            type="number"
            min={0}
            step="0.5"
            value={hoursPerWeek}
            onChange={(e) => setHoursPerWeek(e.target.value)}
          />
        </label>
        <label className="stack-field">
          <span className="label">Weeks active</span>
          <input
            className="field"
            type="number"
            min={0}
            value={weeksActive}
            onChange={(e) => setWeeksActive(e.target.value)}
          />
        </label>
        <label className="stack-field aj-span-2">
          <span className="label">Responsibilities</span>
          <textarea
            className="field"
            rows={2}
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
          />
        </label>
      </div>
      <div className="aj-actions">
        <button type="submit" className="btn btn-primary">
          Save period
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
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
  onCancel,
  onSave,
}: {
  activities: Activity[];
  onCancel: () => void;
  onSave: (award: Award) => void;
}) {
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [date, setDate] = useState("");
  const [grade, setGrade] = useState<GradeLevel | "">("");
  const [activityId, setActivityId] = useState("");
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
