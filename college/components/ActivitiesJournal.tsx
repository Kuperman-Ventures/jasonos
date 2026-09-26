"use client";

import { useMemo, useState } from "react";
import { ACTIVITIES_VIEWS, type ActivitiesViewId } from "@/lib/apps-materials";
import {
  ACTIVITY_CATEGORIES,
  APP_DRAFT_LIMITS,
  activityStatusLabel,
  addPeriod,
  addUpdate,
  archiveActivity,
  archiveAward,
  charCount,
  createActivity,
  createApplicationList,
  estimatedHours,
  exportListMarkdown,
  filterActivities,
  latestPeriod,
  latestUpdate,
  newId,
  removeDraftFromList,
  reorderDraft,
  upsertActivity,
  upsertAward,
  upsertDraft,
  type ActivitiesJournal as Journal,
  type Activity,
  type ActivityCategoryId,
  type ActivityStatusFilter,
  type ActivityUpdate,
  type ApplicationDraft,
  type Award,
  type GradeLevel,
  type ParticipationPeriod,
  type PeriodKind,
  type PeriodStatus,
} from "@/lib/activities-journal";

const GRADE_OPTIONS: { id: GradeLevel; label: string }[] = [
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

function snippet(text: string | undefined, max = 120): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function activityGrades(activity: Activity): string {
  const grades = [...new Set(activity.periods.map((p) => p.grade))];
  if (!grades.length) return "—";
  return grades.map(gradeLabel).join(", ");
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
  view,
  onViewChange,
  onChange,
  openActivityId,
  onOpenActivity,
}: {
  journal: Journal;
  canEdit: boolean;
  view: ActivitiesViewId;
  onViewChange: (view: ActivitiesViewId) => void;
  onChange: (next: Journal) => void;
  openActivityId: string | null;
  onOpenActivity: (id: string | null) => void;
}) {
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [updatePrefillId, setUpdatePrefillId] = useState<string | undefined>(undefined);

  const openActivity = openActivityId
    ? journal.activities.find((a) => a.id === openActivityId) ?? null
    : null;

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
            journal={journal}
            activity={openActivity}
            canEdit={canEdit}
            onChange={onChange}
            onBack={() => onOpenActivity(null)}
          />
        ) : (
          <MyActivitiesView
            journal={journal}
            canEdit={canEdit}
            showAddActivity={showAddActivity}
            showAddUpdate={showAddUpdate}
            updatePrefillId={updatePrefillId}
            onShowAddActivity={setShowAddActivity}
            onShowAddUpdate={(open, activityId) => {
              setUpdatePrefillId(activityId);
              setShowAddUpdate(open);
            }}
            onChange={onChange}
            onOpenActivity={onOpenActivity}
          />
        )
      ) : null}

      {view === "awards" ? (
        <AwardsView journal={journal} canEdit={canEdit} onChange={onChange} />
      ) : null}

      {view === "prep" ? (
        <PrepView journal={journal} canEdit={canEdit} onChange={onChange} />
      ) : null}
    </div>
  );
}

function MyActivitiesView({
  journal,
  canEdit,
  showAddActivity,
  showAddUpdate,
  updatePrefillId,
  onShowAddActivity,
  onShowAddUpdate,
  onChange,
  onOpenActivity,
}: {
  journal: Journal;
  canEdit: boolean;
  showAddActivity: boolean;
  showAddUpdate: boolean;
  updatePrefillId?: string;
  onShowAddActivity: (v: boolean) => void;
  onShowAddUpdate: (open: boolean, activityId?: string) => void;
  onChange: (next: Journal) => void;
  onOpenActivity: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [grade, setGrade] = useState("");
  const [status, setStatus] = useState<ActivityStatusFilter>("all");

  const filtered = useMemo(
    () =>
      filterActivities(journal.activities, {
        query,
        category: category || undefined,
        grade: grade || undefined,
        status,
      }),
    [journal.activities, query, category, grade, status],
  );

  const activeCount = journal.activities.filter((a) => !a.archived).length;

  return (
    <div className="aj-view">
      <header className="aj-head">
        <div>
          <h3 className="aj-title">My Activities</h3>
        </div>
        <div className="aj-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canEdit}
            onClick={() => onShowAddActivity(true)}
          >
            Add activity
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!canEdit || !activeCount}
            onClick={() => onShowAddUpdate(true)}
          >
            Add update
          </button>
        </div>
      </header>

      <div className="aj-filters">
        <label className="stack-field aj-filter-grow">
          <span className="label">Search</span>
          <input
            className="field"
            type="search"
            value={query}
            placeholder="Name, org, role…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="stack-field">
          <span className="label">Category</span>
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All</option>
            {ACTIVITY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="stack-field">
          <span className="label">Grade</span>
          <select className="field" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">All</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="stack-field">
          <span className="label">Status</span>
          <select
            className="field"
            value={status}
            onChange={(e) => setStatus(e.target.value as ActivityStatusFilter)}
          >
            <option value="all">All</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>

      {showAddActivity && canEdit ? (
        <AddActivityForm
          onCancel={() => onShowAddActivity(false)}
          onSave={(input) => {
            const activity = createActivity(input);
            onChange(upsertActivity(journal, activity));
            onShowAddActivity(false);
            onOpenActivity(activity.id);
          }}
        />
      ) : null}

      {showAddUpdate && canEdit ? (
        <AddUpdateForm
          key={updatePrefillId ?? "global-update"}
          activities={journal.activities.filter((a) => !a.archived)}
          initialActivityId={updatePrefillId}
          onCancel={() => onShowAddUpdate(false)}
          onSave={(activityId, fields) => {
            onChange(addUpdate(journal, activityId, fields));
            onShowAddUpdate(false);
          }}
        />
      ) : null}

      {!activeCount ? (
        <div className="aj-empty board-empty">
          <p>No activities yet.</p>
          {canEdit ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onShowAddActivity(true)}
            >
              Add your first activity
            </button>
          ) : null}
        </div>
      ) : !filtered.length ? (
        <p className="board-empty">No activities match these filters.</p>
      ) : (
        <ul className="aj-card-list">
          {filtered.map((activity) => {
            const period = latestPeriod(activity);
            const update = latestUpdate(activity);
            const hours = periodHoursLabel(period);
            return (
              <li key={activity.id} className="aj-card">
                <div className="aj-card-main">
                  <div className="aj-card-top">
                    <h4 className="aj-card-name">{activity.name}</h4>
                    <span className="aj-pill">{activityStatusLabel(activity)}</span>
                  </div>
                  <p className="aj-card-meta">
                    <span>{categoryLabel(activity.category)}</span>
                    {activity.organization ? <span>· {activity.organization}</span> : null}
                    {activity.role ? <span>· {activity.role}</span> : null}
                  </p>
                  <p className="aj-card-meta">
                    <span>Grades: {activityGrades(activity)}</span>
                    {hours ? <span>· {hours}</span> : null}
                  </p>
                  {update ? (
                    <p className="aj-card-update">
                      <span className="aj-card-update-date">{formatShortDate(update.date)}</span>
                      {snippet(update.whatHappened)}
                    </p>
                  ) : (
                    <p className="aj-card-update aj-muted">No updates yet</p>
                  )}
                </div>
                <div className="aj-card-actions">
                  {canEdit ? (
                    <button
                      type="button"
                      className="btn btn-secondary compact"
                      onClick={() => onShowAddUpdate(true, activity.id)}
                    >
                      Add update
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-secondary compact"
                    onClick={() => onOpenActivity(activity.id)}
                  >
                    Edit activity
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddActivityForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (input: {
    name: string;
    category: ActivityCategoryId;
    organization?: string;
    startMonth?: number;
    startYear?: number;
    endMonth?: number;
    endYear?: number;
    ongoing?: boolean;
    role?: string;
    responsibilities?: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ActivityCategoryId>("school-club");
  const [organization, setOrganization] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [endYear, setEndYear] = useState("");
  const [ongoing, setOngoing] = useState(true);
  const [role, setRole] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="aj-panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setError("Name is required.");
          return;
        }
        onSave({
          name: name.trim(),
          category,
          organization: organization.trim() || undefined,
          startMonth: startMonth ? Number(startMonth) : undefined,
          startYear: startYear ? Number(startYear) : undefined,
          endMonth: !ongoing && endMonth ? Number(endMonth) : undefined,
          endYear: !ongoing && endYear ? Number(endYear) : undefined,
          ongoing,
          role: role.trim() || undefined,
          responsibilities: responsibilities.trim() || undefined,
        });
      }}
    >
      <h4>Add activity</h4>
      <div className="aj-form-grid">
        <label className="stack-field">
          <span className="label">Name *</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="stack-field">
          <span className="label">Category *</span>
          <select
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value as ActivityCategoryId)}
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
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
          />
        </label>
        <label className="stack-field">
          <span className="label">Role</span>
          <input className="field" value={role} onChange={(e) => setRole(e.target.value)} />
        </label>
        <label className="stack-field">
          <span className="label">Start month</span>
          <select className="field" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}>
            <option value="">—</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="stack-field">
          <span className="label">Start year</span>
          <input
            className="field"
            type="number"
            inputMode="numeric"
            placeholder="2024"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
          />
        </label>
        <label className="stack-field aj-check">
          <span className="label">Ongoing</span>
          <input
            type="checkbox"
            checked={ongoing}
            onChange={(e) => setOngoing(e.target.checked)}
          />
        </label>
        {!ongoing ? (
          <>
            <label className="stack-field">
              <span className="label">End month</span>
              <select className="field" value={endMonth} onChange={(e) => setEndMonth(e.target.value)}>
                <option value="">—</option>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-field">
              <span className="label">End year</span>
              <input
                className="field"
                type="number"
                inputMode="numeric"
                value={endYear}
                onChange={(e) => setEndYear(e.target.value)}
              />
            </label>
          </>
        ) : null}
        <label className="stack-field aj-span-2">
          <span className="label">What do you do?</span>
          <textarea
            className="field"
            rows={3}
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
          />
        </label>
      </div>
      {error ? <p className="aj-error">{error}</p> : null}
      <div className="aj-actions">
        <button type="submit" className="btn btn-primary">
          Save activity
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
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
  onChange,
  onBack,
}: {
  journal: Journal;
  activity: Activity;
  canEdit: boolean;
  onChange: (next: Journal) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");
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
            {GRADE_OPTIONS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
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

function AwardsView({
  journal,
  canEdit,
  onChange,
}: {
  journal: Journal;
  canEdit: boolean;
  onChange: (next: Journal) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const awards = journal.awards.filter((a) => !a.archived);
  const activityById = useMemo(() => {
    const map = new Map<string, Activity>();
    for (const a of journal.activities) map.set(a.id, a);
    return map;
  }, [journal.activities]);

  const milestones = useMemo(() => {
    const rows: { activity: Activity; update: ActivityUpdate }[] = [];
    for (const activity of journal.activities) {
      if (activity.archived) continue;
      for (const update of activity.updates) {
        if (update.recognition?.trim()) {
          rows.push({ activity, update });
        }
      }
    }
    rows.sort((a, b) => (b.update.date || "").localeCompare(a.update.date || ""));
    return rows;
  }, [journal.activities]);

  return (
    <div className="aj-view">
      <header className="aj-head">
        <div>
          <h3 className="aj-title">Awards &amp; Milestones</h3>
          <p className="aj-support">Honors, awards, and recognition from activity updates.</p>
        </div>
        {canEdit ? (
          <div className="aj-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAdd((v) => !v)}
            >
              {showAdd ? "Close form" : "Add award"}
            </button>
          </div>
        ) : null}
      </header>

      {showAdd && canEdit ? (
        <AddAwardForm
          activities={journal.activities.filter((a) => !a.archived)}
          onCancel={() => setShowAdd(false)}
          onSave={(award) => {
            onChange(upsertAward(journal, award));
            setShowAdd(false);
          }}
        />
      ) : null}

      <h4 className="aj-subhead">Awards</h4>
      {!awards.length ? (
        <p className="board-empty">No awards yet.</p>
      ) : (
        <ul className="aj-card-list">
          {awards.map((award) => {
            const linked = award.activityId ? activityById.get(award.activityId) : null;
            return (
              <li key={award.id} className="aj-card">
                <div className="aj-card-main">
                  <div className="aj-card-top">
                    <h4 className="aj-card-name">{award.title}</h4>
                    {award.academic ? <span className="aj-pill">Academic</span> : null}
                  </div>
                  <p className="aj-card-meta">
                    {award.organization ? <span>{award.organization}</span> : null}
                    {award.date ? <span>· {formatShortDate(award.date)}</span> : null}
                    {award.grade ? <span>· {gradeLabel(award.grade)}</span> : null}
                    {award.recognitionLevel ? <span>· {award.recognitionLevel}</span> : null}
                  </p>
                  {linked ? (
                    <p className="aj-card-meta">Linked activity: {linked.name}</p>
                  ) : null}
                  {award.whatDid ? <p className="aj-card-update">{award.whatDid}</p> : null}
                  {award.linkUrl ? (
                    <p className="aj-card-meta">
                      <a href={award.linkUrl} target="_blank" rel="noreferrer">
                        Link
                      </a>
                    </p>
                  ) : null}
                </div>
                {canEdit ? (
                  <div className="aj-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary compact"
                      onClick={() => onChange(archiveAward(journal, award.id))}
                    >
                      Archive
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <h4 className="aj-subhead">Milestones from updates</h4>
      <p className="aj-muted">
        Recent activity updates with recognition — not duplicated as awards.
      </p>
      {!milestones.length ? (
        <p className="board-empty">No recognition notes in updates yet.</p>
      ) : (
        <ul className="aj-card-list">
          {milestones.map(({ activity, update }) => (
            <li key={update.id} className="aj-card aj-card-compact">
              <div className="aj-card-main">
                <div className="aj-card-top">
                  <strong>{activity.name}</strong>
                  <span className="aj-muted">{formatShortDate(update.date)}</span>
                </div>
                <p className="aj-card-update">{update.recognition}</p>
                <p className="aj-card-meta">{snippet(update.whatHappened, 100)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
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
            <option value="">—</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
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
