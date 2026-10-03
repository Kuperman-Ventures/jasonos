"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivitiesRecall } from "./ActivitiesRecall";
import { GradeStrip } from "./GradeStrip";
import { RecallAnswerCard, type RecallAnswerState } from "./RecallAnswerCard";
import { ACTIVITIES_VIEWS, type ActivitiesViewId } from "@/lib/apps-materials";
import {
  ACTIVITY_CATEGORIES,
  APP_DRAFT_LIMITS,
  activityFromRecall,
  activityNeedsDetails,
  activityStatusLabel,
  addPeriod,
  addUpdate,
  applyRecallSpan,
  archiveActivity,
  archiveAward,
  charCount,
  createApplicationList,
  currentGrade,
  estimatedHours,
  exportListMarkdown,
  gradeCells,
  latestPeriod,
  latestUpdate,
  newId,
  recordSchoolYears,
  recordSpanText,
  recordSummary,
  removeActivity,
  removeDraftFromList,
  reorderDraft,
  restoreActivity,
  sortRecordActivities,
  upsertActivity,
  upsertAward,
  upsertDraft,
  type ActivitiesJournal as Journal,
  type Activity,
  type ActivityCategoryId,
  type ActivityUpdate,
  type ApplicationDraft,
  type Award,
  type GradeLevel,
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

function categoryLabel(id: ActivityCategoryId | string): string {
  return ACTIVITY_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

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

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CharCounter({ value, limit }: { value: string | undefined; limit: number }) {
  const n = charCount(value);
  const over = n > limit;
  return (
    <span className={over ? "aj-char aj-char-over" : "aj-char"}>
      {n}/{limit}
    </span>
  );
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

  useEffect(() => {
    if (view !== "my") setHighlightIds([]);
  }, [view]);

  const openActivity = openActivityId
    ? journal.activities.find((a) => a.id === openActivityId) ?? null
    : null;

  function openActivityAt(id: string | null, tab?: DetailTab) {
    setDetailTab(tab);
    onOpenActivity(id);
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
                if (item.id !== "my") onOpenActivity(null);
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
          />
        )
      ) : null}

      {view === "prep" ? (
        <PrepView journal={journal} canEdit={canEdit} onChange={onChange} />
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
}: {
  journal: Journal;
  canEdit: boolean;
  loaded: boolean;
  highlightIds: string[];
  onHighlightIds: (ids: string[]) => void;
  onChange: (next: Journal) => void;
  onOpenActivity: (id: string | null, tab?: DetailTab) => void;
}) {
  const [recallOpen, setRecallOpen] = useState(false);
  const [recallDismissed, setRecallDismissed] = useState(false);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDraft, setQuickDraft] = useState("");
  const [quickDup, setQuickDup] = useState("");
  const [quickId, setQuickId] = useState<string | null>(null);
  const [quickState, setQuickState] = useState<RecallAnswerState>({
    editing: true,
    pickMode: "start",
    since: null,
    until: null,
    stillDoing: true,
  });
  const [showAddAward, setShowAddAward] = useState(false);

  const active = journal.activities.filter((a) => !a.archived);
  const archived = journal.activities.filter((a) => a.archived);
  const activeCount = active.length;
  const showRecall = canEdit && loaded && (recallOpen || (!activeCount && !recallDismissed));
  const classOf = journal.profile?.classOf;
  const gradeNow = currentGrade(classOf);
  const needle = query.trim().toLowerCase();
  const searched = needle
    ? active.filter((a) =>
        [a.name, a.organization, a.role].filter(Boolean).join(" ").toLowerCase().includes(needle),
      )
    : active;
  const rows = sortRecordActivities(searched);
  const awards = journal.awards.filter((a) => !a.archived);
  const activityById = useMemo(() => {
    const map = new Map<string, Activity>();
    for (const a of journal.activities) map.set(a.id, a);
    return map;
  }, [journal.activities]);

  function closeRecall(ids: string[]) {
    setRecallOpen(false);
    setRecallDismissed(true);
    if (ids.length) onHighlightIds([...new Set([...highlightIds, ...ids])]);
  }

  function spanComplete(state: RecallAnswerState): boolean {
    if (state.since == null) return false;
    return state.stillDoing || state.until != null;
  }

  function saveQuickSpan(id: string, next: RecallAnswerState) {
    if (classOf == null || !spanComplete(next)) return;
    onChange(
      applyRecallSpan(journal, id, classOf, {
        sinceGrade: next.since ?? undefined,
        untilGrade: next.until ?? undefined,
        stillDoing: next.stillDoing,
      }),
    );
    onHighlightIds([...new Set([...highlightIds, id])]);
    setQuickOpen(false);
    setQuickId(null);
    setQuickDraft("");
    setQuickDup("");
    setQuickState({
      editing: true,
      pickMode: "start",
      since: null,
      until: null,
      stillDoing: true,
    });
  }

  function addQuick(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const name = quickDraft.trim();
    if (!name) return;
    if (journal.activities.some((a) => !a.archived && namesMatch(a.name, name))) {
      setQuickDup(name);
      setQuickDraft("");
      return;
    }
    const year = classOf ?? 2028;
    const activity = activityFromRecall(
      { name, category: "other", stillDoing: true },
      year,
    );
    onChange(upsertActivity(journal, activity));
    setQuickId(activity.id);
    setQuickState({
      editing: true,
      pickMode: "start",
      since: null,
      until: null,
      stillDoing: true,
    });
    setQuickDraft("");
    setQuickDup("");
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

        {rows.map((activity) => {
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
          return (
            <div key={activity.id} className={isNew ? "rec-row rec-cols is-new" : "rec-row rec-cols"}>
              <div className="rec-name">
                <button type="button" onClick={() => onOpenActivity(activity.id)}>
                  {activity.name}
                </button>
                <span className="rec-meta">
                  {isNew ? <span className="rec-new-tag">New</span> : null}
                  <span>
                    {span}
                    {metaBits.length ? ` · ${metaBits.join(", ")}` : ""}
                  </span>
                </span>
              </div>
              <GradeStrip
                size="row"
                currentGrade={gradeNow}
                cells={cells}
                markers={markers}
                label={stripAriaLabel(activity.name, span)}
                onEmptyClick={
                  canEdit && years === 0 ? () => onOpenActivity(activity.id, "periods") : undefined
                }
              />
              <span className="rec-years">
                {years ? `${years} ${years === 1 ? "yr" : "yrs"}` : ""}
              </span>
              <span className="rec-act">
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
        })}

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
                      name={
                        journal.activities.find((a) => a.id === quickId)?.name ?? "Activity"
                      }
                      state={quickState}
                      currentGrade={gradeNow}
                      prompt="Then tap the grade you started."
                      onRemove={() => {
                        onChange(removeActivity(journal, quickId));
                        setQuickId(null);
                        setQuickState({
                          editing: true,
                          pickMode: "start",
                          since: null,
                          until: null,
                          stillDoing: true,
                        });
                      }}
                      onPick={(g) => {
                        let next: RecallAnswerState = quickState;
                        if (!quickState.stillDoing && quickState.pickMode === "end" && quickState.since != null) {
                          next =
                            g >= quickState.since
                              ? { ...quickState, until: g, editing: false }
                              : { ...quickState, since: g };
                        } else if (quickState.stillDoing) {
                          next = { ...quickState, since: g, until: null, editing: false };
                        } else {
                          next = { ...quickState, since: g, pickMode: "end" };
                        }
                        setQuickState(next);
                        saveQuickSpan(quickId, next);
                      }}
                      onStill={() => {
                        const next: RecallAnswerState = {
                          ...quickState,
                          stillDoing: true,
                          until: null,
                          pickMode: "start",
                        };
                        setQuickState(next);
                        saveQuickSpan(quickId, next);
                      }}
                      onStopped={() => {
                        const next: RecallAnswerState = {
                          ...quickState,
                          stillDoing: false,
                          pickMode: quickState.since == null ? "start" : "end",
                          editing: true,
                        };
                        setQuickState(next);
                        saveQuickSpan(quickId, next);
                      }}
                      onDone={() => setQuickState((s) => ({ ...s, editing: false }))}
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
                    <span>{activity.name}</span>
                    {canEdit ? (
                      <button
                        type="button"
                        className="aj-text-btn"
                        onClick={() => onChange(restoreActivity(journal, activity.id))}
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
              onChange(upsertAward(journal, award));
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
                linked?.name,
                award.recognitionLevel,
              ].filter(Boolean);
              return (
                <li key={award.id}>
                  <span className="rec-diamond" aria-hidden="true" />
                  <span>
                    <span className="rec-award-name">{award.title}</span>
                    {meta.length ? (
                      <>
                        <br />
                        <span className="rec-award-meta">{meta.join(" · ")}</span>
                      </>
                    ) : null}
                  </span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="aj-text-btn"
                      onClick={() => onChange(archiveAward(journal, award.id))}
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
    onChange(upsertActivity(journal, { ...activity, ...patch }));
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
          <h3 className="aj-title">{activity.name}</h3>
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

function PrepView({
  journal,
  canEdit,
  onChange,
}: {
  journal: Journal;
  canEdit: boolean;
  onChange: (next: Journal) => void;
}) {
  const [selectedListId, setSelectedListId] = useState<string | null>(
    journal.applicationLists[0]?.id ?? null,
  );
  const [newListName, setNewListName] = useState("");
  const [addActivityId, setAddActivityId] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  const list =
    journal.applicationLists.find((l) => l.id === selectedListId) ??
    journal.applicationLists[0] ??
    null;

  const ordered = list
    ? [...list.entries].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  const selectedDraft =
    ordered.find((d) => d.id === selectedDraftId) ?? ordered[0] ?? null;

  const sourceActivity = selectedDraft
    ? journal.activities.find((a) => a.id === selectedDraft.activityId)
    : null;

  const availableActivities = journal.activities.filter((a) => {
    if (a.archived) return false;
    if (!list) return true;
    return !list.entries.some((e) => e.activityId === a.id);
  });

  function moveDraft(draftId: string, direction: -1 | 1) {
    if (!list || !canEdit) return;
    const idx = ordered.findIndex((d) => d.id === draftId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swapIdx];
    let next = reorderDraft(journal, list.id, a.id, b.sortOrder);
    next = reorderDraft(next, list.id, b.id, a.sortOrder);
    onChange(next);
  }

  function patchDraft(patch: Partial<ApplicationDraft>) {
    if (!list || !selectedDraft || !canEdit) return;
    onChange(
      upsertDraft(journal, list.id, {
        ...selectedDraft,
        ...patch,
      }),
    );
  }

  return (
    <div className="aj-view">
      <header className="aj-head">
        <div>
          <h3 className="aj-title">Application Prep</h3>
          <p className="aj-support">
            Build named lists and draft Common App–style activity blurbs.
          </p>
        </div>
      </header>

      <p className="aj-reminder">Verify character limits for the application year.</p>

      <div className="aj-prep-lists">
        <label className="stack-field">
          <span className="label">Application list</span>
          <select
            className="field"
            value={list?.id ?? ""}
            onChange={(e) => {
              setSelectedListId(e.target.value || null);
              setSelectedDraftId(null);
            }}
          >
            {!journal.applicationLists.length ? (
              <option value="">No lists yet</option>
            ) : null}
            {journal.applicationLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        {canEdit ? (
          <form
            className="aj-prep-create"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newListName.trim()) return;
              const { journal: next, list: created } = createApplicationList(
                journal,
                newListName.trim(),
              );
              onChange(next);
              setSelectedListId(created.id);
              setNewListName("");
            }}
          >
            <label className="stack-field">
              <span className="label">New list</span>
              <input
                className="field"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Early Decision shortlist"
              />
            </label>
            <button type="submit" className="btn btn-primary">
              Create list
            </button>
          </form>
        ) : null}
        {list ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const md = exportListMarkdown(list, journal);
              const safe = list.name.replace(/[^\w.-]+/g, "-").toLowerCase() || "list";
              downloadMarkdown(`${safe}.md`, md);
            }}
          >
            Export .md
          </button>
        ) : null}
      </div>

      {!list ? (
        <p className="board-empty">Create an application list to start drafting.</p>
      ) : (
        <>
          {canEdit ? (
            <form
              className="aj-prep-add"
              onSubmit={(e) => {
                e.preventDefault();
                if (!addActivityId) return;
                const maxOrder = ordered.reduce((m, d) => Math.max(m, d.sortOrder), -1);
                const draft: ApplicationDraft = {
                  id: newId("draft"),
                  activityId: addActivityId,
                  sortOrder: maxOrder + 1,
                  reviewStatus: "draft",
                };
                const activity = journal.activities.find((a) => a.id === addActivityId);
                if (activity) {
                  draft.draftRole = activity.role;
                  draft.draftOrg = activity.organization;
                }
                onChange(upsertDraft(journal, list.id, draft));
                setAddActivityId("");
                setSelectedDraftId(draft.id);
              }}
            >
              <label className="stack-field aj-filter-grow">
                <span className="label">Add activity to list</span>
                <select
                  className="field"
                  value={addActivityId}
                  onChange={(e) => setAddActivityId(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {availableActivities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={!addActivityId}
              >
                Add
              </button>
            </form>
          ) : null}

          {!ordered.length ? (
            <p className="board-empty">No activities in this list yet.</p>
          ) : (
            <div className="aj-prep-layout">
              <ol className="aj-draft-order">
                {ordered.map((draft, index) => {
                  const act = journal.activities.find((a) => a.id === draft.activityId);
                  const selected = selectedDraft?.id === draft.id;
                  return (
                    <li key={draft.id} className={selected ? "is-selected" : ""}>
                      <button
                        type="button"
                        className="aj-draft-pick"
                        onClick={() => setSelectedDraftId(draft.id)}
                      >
                        <span className="aj-draft-num">{index + 1}</span>
                        <span>{act?.name ?? draft.activityId}</span>
                      </button>
                      {canEdit ? (
                        <div className="aj-draft-move">
                          <button
                            type="button"
                            className="btn btn-secondary compact"
                            disabled={index === 0}
                            onClick={() => moveDraft(draft.id, -1)}
                            aria-label="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary compact"
                            disabled={index === ordered.length - 1}
                            onClick={() => moveDraft(draft.id, 1)}
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary compact"
                            onClick={() => {
                              onChange(removeDraftFromList(journal, list.id, draft.id));
                              if (selectedDraftId === draft.id) setSelectedDraftId(null);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>

              {selectedDraft ? (
                <div className="aj-prep-editor">
                  <div className="aj-prep-split">
                    <aside className="aj-prep-source">
                      <h4 className="aj-subhead">Source notes</h4>
                      {sourceActivity ? (
                        <>
                          <p>
                            <strong>{sourceActivity.name}</strong>
                          </p>
                          <p className="aj-card-meta">
                            {categoryLabel(sourceActivity.category)}
                            {sourceActivity.organization
                              ? ` · ${sourceActivity.organization}`
                              : ""}
                            {sourceActivity.role ? ` · ${sourceActivity.role}` : ""}
                          </p>
                          {sourceActivity.responsibilities ? (
                            <p>{sourceActivity.responsibilities}</p>
                          ) : null}
                          {sourceActivity.reflections?.whyMatters ? (
                            <p>
                              <em>Why it matters:</em> {sourceActivity.reflections.whyMatters}
                            </p>
                          ) : null}
                          {latestUpdate(sourceActivity) ? (
                            <p>
                              <em>Latest update:</em>{" "}
                              {latestUpdate(sourceActivity)?.whatHappened}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="aj-muted">Activity not found.</p>
                      )}
                    </aside>
                    <div className="aj-prep-draft">
                      <h4 className="aj-subhead">Draft</h4>
                      <div className="aj-form-grid">
                        <label className="stack-field">
                          <span className="label">
                            Role <CharCounter value={selectedDraft.draftRole} limit={APP_DRAFT_LIMITS.role} />
                          </span>
                          <input
                            className="field"
                            value={selectedDraft.draftRole ?? ""}
                            disabled={!canEdit}
                            onChange={(e) => patchDraft({ draftRole: e.target.value })}
                          />
                        </label>
                        <label className="stack-field">
                          <span className="label">
                            Organization{" "}
                            <CharCounter value={selectedDraft.draftOrg} limit={APP_DRAFT_LIMITS.org} />
                          </span>
                          <input
                            className="field"
                            value={selectedDraft.draftOrg ?? ""}
                            disabled={!canEdit}
                            onChange={(e) => patchDraft({ draftOrg: e.target.value })}
                          />
                        </label>
                        <label className="stack-field aj-span-2">
                          <span className="label">
                            Short description{" "}
                            <CharCounter
                              value={selectedDraft.shortDescription}
                              limit={APP_DRAFT_LIMITS.short}
                            />
                          </span>
                          <textarea
                            className="field"
                            rows={3}
                            value={selectedDraft.shortDescription ?? ""}
                            disabled={!canEdit}
                            onChange={(e) => patchDraft({ shortDescription: e.target.value })}
                          />
                        </label>
                        <label className="stack-field aj-span-2">
                          <span className="label">
                            Long description{" "}
                            <CharCounter
                              value={selectedDraft.longDescription}
                              limit={APP_DRAFT_LIMITS.long}
                            />
                          </span>
                          <textarea
                            className="field"
                            rows={5}
                            value={selectedDraft.longDescription ?? ""}
                            disabled={!canEdit}
                            onChange={(e) => patchDraft({ longDescription: e.target.value })}
                          />
                        </label>
                        <label className="stack-field">
                          <span className="label">Grades reviewed</span>
                          <input
                            className="field"
                            value={selectedDraft.gradesReviewed ?? ""}
                            disabled={!canEdit}
                            onChange={(e) => patchDraft({ gradesReviewed: e.target.value })}
                          />
                          <span className="aj-field-hint">
                            The Common App only lists grades 9-12. Earlier years belong in your essays
                            and interviews.
                          </span>
                        </label>
                        <label className="stack-field">
                          <span className="label">Time commitment</span>
                          <input
                            className="field"
                            value={selectedDraft.timeCommitmentReviewed ?? ""}
                            disabled={!canEdit}
                            onChange={(e) =>
                              patchDraft({ timeCommitmentReviewed: e.target.value })
                            }
                          />
                        </label>
                        <label className="stack-field aj-span-2">
                          <span className="label">Continue in college?</span>
                          <input
                            className="field"
                            value={selectedDraft.continueInCollege ?? ""}
                            disabled={!canEdit}
                            onChange={(e) => patchDraft({ continueInCollege: e.target.value })}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
