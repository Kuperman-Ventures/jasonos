"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LIST_COLUMNS,
  LIST_PHASES,
  advanceSchoolPatch,
  archiveSchoolPatch,
  currentListPhaseId,
  listFilterVisible,
  listPhaseBarProgress,
  listPhaseById,
  listPhaseDaySpan,
  listPhaseEyebrow,
  listSizeBar,
  listSortVisible,
  normalizeColumns,
  retreatSchoolPatch,
  schoolOnListPhase,
  selectivityPieSlices,
  type ListColumnId,
  type ListPhaseId,
  type MemberListPrefs,
} from "@/lib/list-phases";
import { SelectivityMixPie } from "./SelectivityMixPie";
import { CollegeRecord } from "./CollegeRecord";
import { InterestPicker } from "./InterestPicker";
import { SchoolMark } from "./SchoolMark";
import { adjacentInList, compareSchools, nextAction, primaryDeadline, type SortKey } from "@/lib/list";
import {
  SCHOOL_SIZES,
  SETTING_METRO_COMBOS,
  formatSchoolSizeLabel,
  getMetroTier,
  getSchoolSize,
  type SchoolSize,
} from "@/lib/campus-size";
import { formatTravelLabel } from "@/lib/drive-matrix";
import { canAdvanceListPhase } from "@/lib/permissions";
import { formatScoirPct, scoirNewJerseyPct } from "@/lib/scoir";
import {
  ACCENT_SUBMISSION_TYPES,
  extraSubmissionTypes,
  selfReportListLabel,
  SUBMISSION_TYPE_LABEL,
} from "@/lib/school-submissions";
import { CampusSettingBadge } from "./CampusSettingBadge";
import {
  INTEREST_LEVELS,
  SELECTIVITY_TIERS,
  VISIT_STATUSES,
  formatDate,
  statusLabel,
  tierLabel,
  trackLabel,
  type ContactPatch,
  type DeadlinePatch,
  type InterestLevel,
  type Owner,
  type School,
  type SelectivityTier,
  type VisitStatus,
} from "@/lib/types";
import { downloadSchoolsCsv } from "@/lib/college-export";
import { researchGroupsNeeded } from "@/lib/research";
import type { MemberProfile } from "@/lib/member-avatars";
import type { RoutedSchoolNotePayload } from "@/lib/school-project-notes";
import type { PersistedProjectStep } from "@/lib/ingest";
import type { RequirementProgressMap, RequirementStatus } from "@/lib/requirement-progress";
import type { TodoEditMap } from "@/lib/project-todos";
import type { RequirementKey } from "@/lib/school-requirements";
import { AddSchoolDialog } from "./AddSchoolDialog";
import { ArrowsDownUp, Columns } from "@phosphor-icons/react";

export function CollegesTab({
  schools,
  selectedId,
  listPrefs,
  memberId,
  memberRole,
  memberName,
  memberProfiles,
  onListPrefsChange,
  onOpen,
  onClose,
  onNavigateSchool,
  onPatch,
  onAdded,
  onDelete,
  onAddStep,
  onPatchStep,
  onDeleteStep,
  onAddDeadline,
  onPatchDeadline,
  onDeleteDeadline,
  onAddContact,
  onPatchContact,
  onDeleteContact,
  onSendProjectNote,
  onRemoveProjectNote,
  requirementProgress,
  projectSteps,
  todoEdits,
  onCycleRequirementStatus,
  onAddRequirementTodo,
  processPhaseLabel,
  onSendVisitPlan,
  initialModalTab = "snapshot",
  householdFinances,
  onHouseholdFinancesChange,
  scholarshipTodoIds,
  onAddScholarshipTodo,
  canViewFinancesTab = true,
}: {
  schools: School[];
  selectedId: string | null;
  listPrefs: MemberListPrefs;
  memberId: string;
  memberRole: string;
  memberName: string;
  memberProfiles: MemberProfile[];
  onListPrefsChange: (prefs: MemberListPrefs) => void;
  onOpen: (id: string) => void;
  onClose: () => void;
  /** Change school in the open modal without resetting the active tab. */
  onNavigateSchool: (id: string) => void;
  onPatch: (id: string, patch: Partial<School>) => void;
  onAdded: (school: School) => void;
  onDelete: (id: string) => void;
  onAddStep: (id: string, label: string, owner: Owner) => void;
  onPatchStep: (id: string, stepId: string, patch: { done?: boolean; owner?: Owner; label?: string }) => void;
  onDeleteStep: (id: string, stepId: string) => void;
  onAddDeadline: (id: string, title: string, dueDate: string | null) => void;
  onPatchDeadline: (id: string, deadlineId: string, patch: DeadlinePatch) => void;
  onDeleteDeadline: (id: string, deadlineId: string) => void;
  onAddContact: (id: string, contact: ContactPatch) => void;
  onPatchContact: (id: string, contactId: string, patch: ContactPatch) => void;
  onDeleteContact: (id: string, contactId: string) => void;
  onSendProjectNote: (schoolId: string, payload: RoutedSchoolNotePayload) => void;
  onRemoveProjectNote: (schoolId: string, noteId: string) => void;
  requirementProgress: RequirementProgressMap;
  projectSteps: PersistedProjectStep[];
  todoEdits: TodoEditMap;
  onCycleRequirementStatus: (
    schoolId: string,
    key: RequirementKey,
    status: RequirementStatus,
  ) => void;
  onAddRequirementTodo: (schoolId: string, key: RequirementKey, title: string) => void;
  processPhaseLabel: string | null;
  onSendVisitPlan: (payload: {
    events: import("@/lib/calendar-events").CalendarEvent[];
    todos: PersistedProjectStep[];
  }) => void;
  initialModalTab?: import("./CollegeRecord").SchoolModalTab;
  householdFinances?: import("@/lib/finances").HouseholdFinances;
  onHouseholdFinancesChange?: (next: import("@/lib/finances").HouseholdFinances) => void;
  scholarshipTodoIds?: Record<string, string>;
  onAddScholarshipTodo?: (scholarshipKey: string, title: string) => void;
  canViewFinancesTab?: boolean;
}) {
  const canAdvance = canAdvanceListPhase({ id: memberId, role: memberRole });
  const [phaseId, setPhaseId] = useState<ListPhaseId>("exploration");
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<SelectivityTier | "any">("any");
  const [settingMetroFilters, setSettingMetroFilters] = useState<string[]>([]);
  const [schoolSizeFilters, setSchoolSizeFilters] = useState<SchoolSize[]>([]);
  const [interest, setInterest] = useState<InterestLevel | "any">("any");
  const [travelFilter, setTravelFilter] = useState<"any" | "Drive" | "Fly">("any");
  const [addOpen, setAddOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [dashOpen, setDashOpen] = useState(true);
  const columnsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPhaseId(currentListPhaseId());
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("track-list-dash-open");
      if (raw === "0") setDashOpen(false);
      if (raw === "1") setDashOpen(true);
    } catch {
      /* private mode */
    }
  }, []);

  function toggleDashOpen() {
    setDashOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("track-list-dash-open", next ? "1" : "0");
      } catch {
        /* private mode */
      }
      return next;
    });
  }

  const phase = listPhaseById(phaseId);
  const columns = normalizeColumns(listPrefs.columnsByPhase[phaseId], phase);
  const showArchived = listPrefs.showArchived;
  const preferredSort = listPrefs.sortKey;
  const preferredSortDir = listPrefs.sortDir;
  // Fall back for display when the preferred sort's column is hidden — keep the preference.
  const sort = listSortVisible(preferredSort, columns) ? preferredSort : "list";
  const sortDir = sort === preferredSort ? preferredSortDir : 1;
  const showSelectivityFilter = listFilterVisible("selectivity", columns);
  const showSettingFilter = listFilterVisible("setting", columns);
  const showSchoolSizeFilter = listFilterVisible("schoolSize", columns);
  const showInterestFilter = listFilterVisible("interest", columns);
  const showTravelFilter = listFilterVisible("travel", columns);

  // Drop filter state that no longer matches a visible column.
  useEffect(() => {
    if (!showSelectivityFilter && tier !== "any") setTier("any");
    if (!showSettingFilter && settingMetroFilters.length) setSettingMetroFilters([]);
    if (!showSchoolSizeFilter && schoolSizeFilters.length) setSchoolSizeFilters([]);
    if (!showInterestFilter && interest !== "any") setInterest("any");
    if (!showTravelFilter && travelFilter !== "any") setTravelFilter("any");
  }, [
    showSelectivityFilter,
    showSettingFilter,
    showSchoolSizeFilter,
    showInterestFilter,
    showTravelFilter,
    tier,
    settingMetroFilters.length,
    schoolSizeFilters.length,
    interest,
    travelFilter,
  ]);

  useEffect(() => {
    if (!columnsOpen) return;
    function onDoc(event: MouseEvent) {
      if (!columnsRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    }
    // Attach after this click finishes so the opening click does not immediately close.
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [columnsOpen]);

  const phaseSchools = useMemo(() => {
    return schools.filter((school) => {
      if (showArchived) {
        return school.archived && school.phasesParticipated.includes(phaseId);
      }
      return !school.archived && schoolOnListPhase(school, phaseId);
    });
  }, [schools, phaseId, showArchived]);

  const activeCount = useMemo(
    () => schools.filter((school) => !school.archived && schoolOnListPhase(school, phaseId)).length,
    [schools, phaseId],
  );

  const sizeBar = listSizeBar(activeCount, phase);
  const mixPie = useMemo(
    () =>
      selectivityPieSlices(
        schools.filter((school) => !school.archived && schoolOnListPhase(school, phaseId)),
        phase.target,
      ),
    [schools, phaseId, phase.target],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = phaseSchools.filter((school) => {
      if (tier !== "any" && school.selectivityTier !== tier) return false;
      if (interest !== "any" && school.interestLevel !== interest) return false;
      if (travelFilter !== "any" && school.travelMode !== travelFilter) return false;
      if (settingMetroFilters.length) {
        const metro = getMetroTier(school.metroPopulation);
        if (!metro) return false;
        const comboId = `${school.campusSetting}::${metro}`;
        if (!settingMetroFilters.includes(comboId)) return false;
      }
      if (schoolSizeFilters.length) {
        const size = getSchoolSize(school.undergradEnrollment);
        if (!size || !schoolSizeFilters.includes(size)) return false;
      }
      if (!q) return true;
      return [school.name, school.location, school.notes, school.admissionsContext]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    const sorted = [...filtered].sort((a, b) => compareSchools(a, b, sort));
    return sortDir === 1 ? sorted : sorted.reverse();
  }, [
    phaseSchools,
    query,
    tier,
    interest,
    travelFilter,
    settingMetroFilters,
    schoolSizeFilters,
    sort,
    sortDir,
  ]);

  const selected = schools.find((school) => school.id === selectedId) ?? null;
  const browseList = useMemo(() => {
    if (selected && visible.some((school) => school.id === selected.id)) return visible;
    const sorted = [...phaseSchools].sort((a, b) => compareSchools(a, b, sort));
    return sortDir === 1 ? sorted : sorted.reverse();
  }, [selected, visible, phaseSchools, sort, sortDir]);
  const listNav = useMemo(
    () => (selected ? adjacentInList(browseList, selected.id) : null),
    [browseList, selected],
  );
  const archivedInPhase = schools.filter(
    (school) => school.archived && school.phasesParticipated.includes(phaseId),
  ).length;

  function setSortPrefs(key: SortKey, dir: 1 | -1 = 1) {
    onListPrefsChange({ ...listPrefs, sortKey: key, sortDir: dir });
  }

  function toggleSort(next: SortKey) {
    if (preferredSort === next && listSortVisible(next, columns)) {
      setSortPrefs(next, preferredSortDir === 1 ? -1 : 1);
    } else {
      setSortPrefs(next, 1);
    }
  }

  function arrow(key: SortKey) {
    if (sort !== key) return "";
    return sortDir === 1 ? " ↑" : " ↓";
  }

  function setColumns(next: ListColumnId[]) {
    onListPrefsChange({
      ...listPrefs,
      columnsByPhase: {
        ...listPrefs.columnsByPhase,
        [phaseId]: normalizeColumns(next, phase),
      },
    });
  }

  function toggleColumn(id: ListColumnId) {
    if (id === "school") return;
    if (columns.includes(id)) setColumns(columns.filter((column) => column !== id));
    else setColumns([...columns, id]);
  }

  function resetColumns() {
    setColumns([...phase.defaultColumns]);
  }

  function advanceSchool(school: School) {
    if (!canAdvance) return;
    const patch = advanceSchoolPatch(school);
    if (!patch) return;
    onPatch(school.id, patch);
  }

  function retreatSchool(school: School) {
    const patch = retreatSchoolPatch(school);
    if (!patch) return;
    onPatch(school.id, patch);
  }

  function archiveSchool(school: School) {
    onPatch(school.id, archiveSchoolPatch(school));
  }

  function restoreSchool(school: School) {
    onPatch(school.id, { archived: false, archivedAt: null });
  }

  function renderCell(column: ListColumnId, school: School) {
    const deadline = primaryDeadline(school);
    const action = nextAction(school);
    const track = trackLabel(school.admissionTrack);

    switch (column) {
      case "school":
        return (
          <td key={column} className="school-name">
            <div className="school-id">
              <SchoolMark name={school.name} website={school.website} />
              <span>
                {school.name}
                {school.archived ? <small className="archived-tag">Archived</small> : null}
                <NeedsResearchLabels school={school} />
              </span>
              {school.archived ? (
                <button
                  type="button"
                  className="btn btn-secondary restore-inline"
                  onClick={(event) => {
                    event.stopPropagation();
                    restoreSchool(school);
                  }}
                >
                  Restore
                </button>
              ) : null}
            </div>
          </td>
        );
      case "location":
        return (
          <td key={column}>
            <div>{school.location || "—"}</div>
          </td>
        );
      case "setting":
        return (
          <td key={column}>
            {school.campusSetting ? (
              <CampusSettingBadge
                campusSetting={school.campusSetting}
                metroArea={school.metroArea}
                metroPopulation={school.metroPopulation}
                location={school.location}
              />
            ) : (
              "—"
            )}
          </td>
        );
      case "size":
        return (
          <td key={column} className="muted">
            {formatSchoolSizeLabel(school.undergradEnrollment) || "—"}
          </td>
        );
      case "travel":
        return (
          <td key={column}>
            <div
              className={
                school.travelMode === "Fly" ? "travel-cell travel-fly" : "travel-cell"
              }
            >
              {formatTravelLabel(school.driveMinutes, school.driveMiles, school.travelMode)}
            </div>
          </td>
        );
      case "status":
        return <td key={column}>{statusLabel(school.applicationStatus) || "—"}</td>;
      case "track":
        return (
          <td key={column}>
            <div>{track || "Not chosen"}</div>
            <div className="muted">{deadline.date ? formatDate(deadline.date) : "No date"}</div>
          </td>
        );
      case "selectivity":
        return <td key={column}>{tierLabel(school.selectivityTier) || "—"}</td>;
      case "testPolicy": {
        const policy = school.testPolicy.trim() || school.familyTestPolicy.trim();
        const notAnnounced =
          school.testPolicyFall2028Status.trim() === "Not yet announced for Fall 2028";
        return (
          <td key={column}>
            <div>{policy || "—"}</div>
            {notAnnounced ? (
              <div className="muted test-policy-fall2028-note">Fall 2028 not announced</div>
            ) : null}
          </td>
        );
      }
      case "interest":
        return (
          <td key={column} className="interest-cell" onClick={(event) => event.stopPropagation()}>
            <InterestPicker
              value={school.interestLevel}
              schoolName={school.name}
              onChange={(next) => onPatch(school.id, { interestLevel: next })}
              onArchive={school.archived ? undefined : () => archiveSchool(school)}
            />
          </td>
        );
      case "visit":
        return (
          <td key={column} className="visit-cell" onClick={(event) => event.stopPropagation()}>
            <select
              className="visit-select"
              aria-label={`Visit status for ${school.name}`}
              value={school.visitStatus}
              onChange={(event) =>
                onPatch(school.id, { visitStatus: event.target.value as VisitStatus })
              }
            >
              {VISIT_STATUSES.map((item) => (
                <option key={item.id || "unset"} value={item.id}>
                  {item.id ? item.label : "Set visit"}
                </option>
              ))}
            </select>
          </td>
        );
      case "action":
        return (
          <td key={column}>
            <div>{action.title || "—"}</div>
            {action.dueDate ? <div className="muted">{formatDate(action.dueDate)}</div> : null}
          </td>
        );
      case "mechanical":
        return <td key={column}>{school.mechanicalEngineering.trim() || "—"}</td>;
      case "materials":
        return <td key={column}>{school.materials.trim() || "—"}</td>;
      case "aerospace":
        return (
          <td key={column}>
            <div>{school.aerospaceEngineering.trim() || "—"}</div>
            {school.aerospaceProgram.trim() ? (
              <div className="muted">{school.aerospaceProgram}</div>
            ) : null}
          </td>
        );
      case "newJerseyPct": {
        const nj = scoirNewJerseyPct(school);
        return (
          <td key={column} className="num mono">
            {nj == null ? "—" : formatScoirPct(nj, 0)}
          </td>
        );
      }
      case "selfReport": {
        const label = selfReportListLabel(school.submissions);
        return <td key={column}>{label}</td>;
      }
      case "extras": {
        const types = extraSubmissionTypes(school.submissions);
        if (!types.length) return <td key={column} />;
        return (
          <td key={column}>
            <div className="school-sub-chips">
              {types.map((type) => (
                <span
                  key={type}
                  className={
                    ACCENT_SUBMISSION_TYPES.has(type) ? "school-sub-chip is-accent" : "school-sub-chip"
                  }
                >
                  {SUBMISSION_TYPE_LABEL[type]}
                </span>
              ))}
            </div>
          </td>
        );
      }
      default:
        return null;
    }
  }

  function sortKeyForColumn(column: ListColumnId): SortKey | null {
    if (column === "school") return "name";
    if (column === "location") return "location";
    if (column === "status") return "status";
    if (column === "selectivity") return "selectivity";
    if (column === "interest") return "interest";
    if (column === "action") return "action";
    if (column === "travel") return "drive";
    if (column === "setting") return "setting";
    if (column === "size") return "size";
    if (column === "newJerseyPct") return "newJerseyPct";
    return null;
  }

  function toggleMulti<T extends string>(current: T[], value: T): T[] {
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  }

  const calendarPhaseId = currentListPhaseId();
  const pct = (n: number) => `${(n / sizeBar.scaleMax) * 100}%`;
  const sizeFillTop = Math.min(sizeBar.count, sizeBar.hi);
  const stepperColumns = LIST_PHASES.map((item) => `${listPhaseDaySpan(item)}fr`).join(" ");
  const today = new Date();
  const todayLabel = `TODAY · ${today
    .toLocaleString("en", { month: "short" })
    .toUpperCase()} ${today.getDate()}`;

  function movePhaseView(delta: -1 | 1) {
    const index = LIST_PHASES.findIndex((item) => item.id === phaseId);
    const next = LIST_PHASES[index + delta];
    if (next) setPhaseId(next.id);
  }

  return (
    <section className="colleges-list" data-list-phase={phaseId}>
      <div className="list-dash-chrome">
        <header className="list-dash-head">
          <div className="list-dash-title">
            <span className="kicker">{listPhaseEyebrow(phaseId)}</span>
            <h1>College list</h1>
          </div>
          <div className="readout">
            <span className="label">{phase.label} list</span>
            <span className="readout-fig">{activeCount}</span>
            <span className="datum">
              of ~{phase.target} target ({phase.rangeLabel})
            </span>
          </div>
        </header>

        <ol
          className="list-dash-stepper"
          aria-label="College list phases"
          style={{ gridTemplateColumns: stepperColumns }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              movePhaseView(1);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              movePhaseView(-1);
            }
          }}
        >
          {LIST_PHASES.map((item, index) => {
            const count = schools.filter(
              (school) => !school.archived && schoolOnListPhase(school, item.id),
            ).length;
            const isCalendarCurrent = item.id === calendarPhaseId;
            const isViewing = phaseId === item.id;
            const progress = listPhaseBarProgress(item, today);
            return (
              <li key={item.id} className="list-dash-step" data-step={item.id}>
                <button
                  type="button"
                  className="list-dash-step-btn"
                  aria-current={isViewing ? "step" : undefined}
                  onClick={() => setPhaseId(item.id)}
                >
                  <div className="step-today-slot">
                    {isCalendarCurrent ? (
                      <div className="step-today" style={{ left: `${(progress * 100).toFixed(2)}%` }}>
                        <span>{todayLabel}</span>
                        <span />
                      </div>
                    ) : null}
                  </div>
                  <div className="step-bar-slot">
                    <div className="step-bar">
                      <i style={{ width: `${(progress * 100).toFixed(2)}%` }} />
                    </div>
                  </div>
                  <span className="step-num">
                    Step {index + 1}
                    {isCalendarCurrent ? <span className="step-now">NOW</span> : null}
                  </span>
                  <span className="step-name">{item.label}</span>
                  <span className="step-meta">
                    {item.window} · {count} / {item.target} schools
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="list-dash-body">
        <div className="list-dash">
          <div className={`list-dash-gauges${dashOpen ? "" : " is-collapsed"}`}>
            <button
              type="button"
              className="list-dash-gauges-toggle"
              aria-expanded={dashOpen}
              aria-controls="list-dash-gauges-body"
              onClick={toggleDashOpen}
            >
              <span className="list-dash-gauges-toggle-main">
                <span className="label">List size &amp; selectivity mix</span>
                {!dashOpen ? (
                  <span className="list-dash-gauges-summary">
                    {sizeBar.count} schools · {sizeBar.note}
                  </span>
                ) : null}
              </span>
              <span
                className={`list-dash-gauges-caret${dashOpen ? " is-open" : ""}`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 16 16">
                  <path
                    d="M6 3.5 10.5 8 6 12.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </span>
            </button>
            <div
              id="list-dash-gauges-body"
              className="list-dash-panels"
              hidden={!dashOpen}
            >
            <section className="list-dash-panel" aria-labelledby="list-size-h">
              <div className="panel-head">
                <span className="label" id="list-size-h">
                  List size
                </span>
                <span className={`over-note${sizeBar.overRange ? "" : sizeBar.underRange ? " is-under" : " is-in"}`}>
                  {sizeBar.note}
                </span>
              </div>
              <div className="sizebar" aria-hidden="true">
                <div
                  className="sizebar-range"
                  style={{ left: pct(sizeBar.lo), width: pct(sizeBar.hi - sizeBar.lo) }}
                />
                <div className="sizebar-track" />
                <div className="sizebar-fill" style={{ width: pct(sizeFillTop) }} />
                {sizeBar.count > sizeBar.hi ? (
                  <div
                    className="sizebar-over"
                    style={{
                      left: pct(sizeBar.hi),
                      width: pct(sizeBar.count - sizeBar.hi),
                    }}
                  />
                ) : null}
                <div className="sizebar-target" style={{ left: pct(sizeBar.target) }} />
                <span className="sizebar-tick" style={{ left: pct(sizeBar.lo) }}>
                  {sizeBar.lo}
                </span>
                <span className="sizebar-tick" style={{ left: pct(sizeBar.hi) }}>
                  {sizeBar.hi}
                </span>
                <span
                  className={`sizebar-tick${sizeBar.overRange ? " is-over" : ""}`}
                  style={{ left: pct(sizeBar.count) }}
                >
                  {sizeBar.count}
                </span>
              </div>
              <p className="prose">{sizeBar.prose}</p>
            </section>

            <section className="list-dash-panel" aria-labelledby="list-mix-h">
              <span className="label" id="list-mix-h">
                Selectivity mix vs ideal
              </span>
              <SelectivityMixPie
                slices={mixPie.slices}
                setCount={mixPie.setCount}
                unsetCount={mixPie.unsetCount}
              />
            </section>
            </div>
          </div>
        </div>

      <div className="toolbar">
        <input
          className="input grow"
          type="search"
          value={query}
          placeholder="Search schools"
          onChange={(event) => setQuery(event.target.value)}
        />
        {showSelectivityFilter ? (
          <select
            className="select"
            value={tier}
            aria-label="Filter by selectivity"
            onChange={(event) => setTier(event.target.value as SelectivityTier | "any")}
          >
            <option value="any">All selectivity</option>
            {SELECTIVITY_TIERS.map((item) => (
              <option key={item.id || "unset"} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        ) : null}
        {showSettingFilter ? (
          <details className="multi-filter">
            <summary>
              Setting{settingMetroFilters.length ? ` · ${settingMetroFilters.length}` : ""}
            </summary>
            <div
              className="multi-filter-menu multi-filter-menu--tall"
              role="group"
              aria-label="Filter by campus setting and metro size"
            >
              {SETTING_METRO_COMBOS.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={settingMetroFilters.includes(item.id)}
                    onChange={() =>
                      setSettingMetroFilters((current) => toggleMulti(current, item.id))
                    }
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </details>
        ) : null}
        {showSchoolSizeFilter ? (
          <details className="multi-filter">
            <summary>
              School size{schoolSizeFilters.length ? ` · ${schoolSizeFilters.length}` : ""}
            </summary>
            <div className="multi-filter-menu" role="group" aria-label="Filter by school size">
              {SCHOOL_SIZES.map((item) => (
                <label key={item}>
                  <input
                    type="checkbox"
                    checked={schoolSizeFilters.includes(item)}
                    onChange={() => setSchoolSizeFilters((current) => toggleMulti(current, item))}
                  />
                  {item}
                </label>
              ))}
            </div>
          </details>
        ) : null}
        {showInterestFilter ? (
          <select
            className="select"
            value={interest}
            aria-label="Filter by interest"
            onChange={(event) => setInterest(event.target.value as InterestLevel | "any")}
          >
            <option value="any">All interest</option>
            {INTEREST_LEVELS.map((item) => (
              <option key={item.id || "unset"} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        ) : null}
        {showTravelFilter ? (
          <select
            className="select"
            value={travelFilter}
            aria-label="Filter by travel mode"
            onChange={(event) => setTravelFilter(event.target.value as "any" | "Drive" | "Fly")}
          >
            <option value="any">Drive or fly</option>
            <option value="Drive">Drive</option>
            <option value="Fly">Fly</option>
          </select>
        ) : null}
        <div className="toolbar-sort">
          <ArrowsDownUp className="toolbar-sort-icon" size={16} weight="bold" aria-hidden />
          <select
            className="select"
            value={sort}
            aria-label="Sort schools"
            onChange={(event) => setSortPrefs(event.target.value as SortKey, 1)}
          >
            <option value="list">Sheet order</option>
            <option value="name">School name</option>
            {listSortVisible("location", columns) ? (
              <option value="location">State</option>
            ) : null}
            {listSortVisible("drive", columns) ? <option value="drive">Drive time</option> : null}
            {listSortVisible("setting", columns) ? (
              <option value="setting">Campus setting</option>
            ) : null}
            {listSortVisible("size", columns) ? <option value="size">School size</option> : null}
            {listSortVisible("newJerseyPct", columns) ? (
              <option value="newJerseyPct">From NJ</option>
            ) : null}
            {listSortVisible("selectivity", columns) ? (
              <option value="selectivity">Selectivity</option>
            ) : null}
            {listSortVisible("interest", columns) ? <option value="interest">Interest</option> : null}
            {listSortVisible("status", columns) ? (
              <option value="status">Application status</option>
            ) : null}
            {listSortVisible("action", columns) ? <option value="action">Next action</option> : null}
          </select>
        </div>
        <div className="columns-menu" ref={columnsRef}>
          <button
            type="button"
            className="btn btn-secondary columns-trigger"
            aria-expanded={columnsOpen}
            aria-label="Show or hide columns"
            onClick={() => setColumnsOpen((open) => !open)}
          >
            <Columns size={16} weight="bold" aria-hidden />
            Show columns
          </button>
          {columnsOpen ? (
            <div className="columns-panel" role="dialog" aria-label="Visible columns">
              <p className="columns-hint">Saved for your login on this phase.</p>
              {LIST_COLUMNS.map((column) => (
                <label key={column.id} className="columns-option">
                  <input
                    type="checkbox"
                    checked={columns.includes(column.id)}
                    disabled={column.required}
                    onChange={() => toggleColumn(column.id)}
                  />
                  <span>{column.label}</span>
                </label>
              ))}
              <button type="button" className="btn btn-ghost columns-reset" onClick={resetColumns}>
                Reset to {phase.label} defaults
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={`btn btn-secondary${showArchived ? " is-pressed" : ""}`}
          aria-pressed={showArchived}
          onClick={() =>
            onListPrefsChange({ ...listPrefs, showArchived: !showArchived })
          }
        >
          Archived{archivedInPhase ? ` (${archivedInPhase})` : ""}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            downloadSchoolsCsv(
              [...schools].sort((a, b) => a.listOrder - b.listOrder),
              "kyle-college-list.csv",
            )
          }
        >
          Download spreadsheet
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
          Add school
        </button>
      </div>

      {showArchived ? (
        <div className="archive-view-banner">
          <span>Archived schools — restore any you want back on the list.</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onListPrefsChange({ ...listPrefs, showArchived: false })}
          >
            Back to list
          </button>
        </div>
      ) : null}

      <div className="table-wrap schools-wrap">
        <table className="schools" style={{ minWidth: Math.max(520, columns.length * 140) }}>
          <thead>
            <tr>
              {columns.map((columnId) => {
                const meta = LIST_COLUMNS.find((column) => column.id === columnId);
                const sortKey = sortKeyForColumn(columnId);
                return (
                  <th key={columnId}>
                    {sortKey ? (
                      <button
                        type="button"
                        className={sort === sortKey ? "active" : ""}
                        onClick={() => toggleSort(sortKey)}
                      >
                        {meta?.label ?? columnId}
                        {arrow(sortKey)}
                      </button>
                    ) : (
                      meta?.label ?? columnId
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((school) => (
              <tr
                key={school.id}
                className={[
                  "row",
                  school.id === selectedId ? "selected" : "",
                  school.archived ? "archived-row" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-level={school.interestLevel || undefined}
                onClick={() => onOpen(school.id)}
              >
                {columns.map((column) => renderCell(column, school))}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="empty-list">
            {showArchived
              ? `No archived schools in ${phase.label}.`
              : `No schools in ${phase.label} yet.`}
          </p>
        ) : null}
      </div>

      <div className="school-cards">
        {visible.map((school) => {
          const action = nextAction(school);
          const deadline = primaryDeadline(school);
          return (
            <div key={school.id} className="school-card" onClick={() => onOpen(school.id)}>
              <h3 className="school-id">
                <SchoolMark name={school.name} website={school.website} />
                <span>
                  {school.name}
                  {school.archived ? <small className="archived-tag">Archived</small> : null}
                  <NeedsResearchLabels school={school} />
                </span>
                {school.archived ? (
                  <button
                    type="button"
                    className="btn btn-secondary restore-inline"
                    onClick={(event) => {
                      event.stopPropagation();
                      restoreSchool(school);
                    }}
                  >
                    Restore
                  </button>
                ) : null}
              </h3>
              <div className="card-meta">
                {columns.includes("status") ? <span>{statusLabel(school.applicationStatus) || "—"}</span> : null}
                {columns.includes("location") ? <span>{school.location || "—"}</span> : null}
                {columns.includes("setting") && school.campusSetting ? (
                  <span>
                    <CampusSettingBadge
                      campusSetting={school.campusSetting}
                      metroArea={school.metroArea}
                      metroPopulation={school.metroPopulation}
                      location={school.location}
                    />
                  </span>
                ) : null}
                {columns.includes("size") ? (
                  <span>{formatSchoolSizeLabel(school.undergradEnrollment) || "—"}</span>
                ) : null}
                {columns.includes("newJerseyPct") ? (
                  <span>
                    NJ{" "}
                    {(() => {
                      const nj = scoirNewJerseyPct(school);
                      return nj == null ? "—" : formatScoirPct(nj, 0);
                    })()}
                  </span>
                ) : null}
                {columns.includes("travel") ? (
                  <span>
                    {formatTravelLabel(school.driveMinutes, school.driveMiles, school.travelMode)}
                  </span>
                ) : null}
                {columns.includes("selectivity") ? <span>{tierLabel(school.selectivityTier) || "—"}</span> : null}
                {columns.includes("testPolicy") ? (
                  <span>
                    {school.testPolicy.trim() || school.familyTestPolicy.trim() || "—"}
                    {school.testPolicyFall2028Status.trim() === "Not yet announced for Fall 2028"
                      ? " · Fall 2028 not announced"
                      : ""}
                  </span>
                ) : null}
                {columns.includes("track") ? (
                  <span>
                    {trackLabel(school.admissionTrack) || "Track not chosen"}
                    {deadline.date ? ` · ${formatDate(deadline.date)}` : ""}
                  </span>
                ) : null}
                {columns.includes("action") ? <span>{action.title || "No next action"}</span> : null}
                {columns.includes("mechanical") ? (
                  <span>ME {school.mechanicalEngineering.trim() || "—"}</span>
                ) : null}
                {columns.includes("materials") ? (
                  <span>Mat {school.materials.trim() || "—"}</span>
                ) : null}
                {columns.includes("aerospace") ? (
                  <span>Aero {school.aerospaceEngineering.trim() || "—"}</span>
                ) : null}
                {columns.includes("selfReport") ? (
                  <span>{selfReportListLabel(school.submissions)}</span>
                ) : null}
                {columns.includes("extras") ? (
                  <span>
                    {extraSubmissionTypes(school.submissions)
                      .map((type) => SUBMISSION_TYPE_LABEL[type])
                      .join(", ")}
                  </span>
                ) : null}
                {columns.includes("visit") ? (
                  <span onClick={(event) => event.stopPropagation()}>
                    <select
                      className="visit-select"
                      aria-label={`Visit status for ${school.name}`}
                      value={school.visitStatus}
                      onChange={(event) =>
                        onPatch(school.id, { visitStatus: event.target.value as VisitStatus })
                      }
                    >
                      {VISIT_STATUSES.map((item) => (
                        <option key={item.id || "unset"} value={item.id}>
                          {item.id ? item.label : "Set visit"}
                        </option>
                      ))}
                    </select>
                  </span>
                ) : null}
              </div>
              {columns.includes("interest") ? (
                <div className="school-card-interest" data-level={school.interestLevel || undefined}>
                  <InterestPicker
                    value={school.interestLevel}
                    schoolName={school.name}
                    onChange={(next) => onPatch(school.id, { interestLevel: next })}
                    onArchive={school.archived ? undefined : () => archiveSchool(school)}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      </div>

      {selected ? (
        <CollegeRecord
          school={selected}
          listUndergrads={schools
            .filter((row) => !row.archived)
            .map((row) => row.undergradEnrollment)
            .filter((n): n is number => typeof n === "number" && Number.isFinite(n))}
          canAdvancePhase={canAdvance}
          memberId={memberId}
          memberName={memberName}
          memberProfiles={memberProfiles}
          onBack={onClose}
          onNavigate={onNavigateSchool}
          previousSchool={listNav?.previous ?? null}
          nextSchool={listNav?.next ?? null}
          listPosition={listNav && listNav.index >= 0 ? listNav.index + 1 : null}
          listTotal={listNav?.total ?? browseList.length}
          onPatch={(patch) => onPatch(selected.id, patch)}
          onDelete={() => onDelete(selected.id)}
          onAdvance={() => advanceSchool(selected)}
          onRetreat={() => retreatSchool(selected)}
          onArchive={() => archiveSchool(selected)}
          onRestore={() => restoreSchool(selected)}
          onAddStep={(label, owner) => onAddStep(selected.id, label, owner)}
          onPatchStep={(stepId, patch) => onPatchStep(selected.id, stepId, patch)}
          onDeleteStep={(stepId) => onDeleteStep(selected.id, stepId)}
          onAddDeadline={(title, dueDate) => onAddDeadline(selected.id, title, dueDate)}
          onPatchDeadline={(deadlineId, patch) => onPatchDeadline(selected.id, deadlineId, patch)}
          onDeleteDeadline={(deadlineId) => onDeleteDeadline(selected.id, deadlineId)}
          onAddContact={(contact) => onAddContact(selected.id, contact)}
          onPatchContact={(contactId, patch) => onPatchContact(selected.id, contactId, patch)}
          onDeleteContact={(contactId) => onDeleteContact(selected.id, contactId)}
          onSendProjectNote={(payload) => onSendProjectNote(selected.id, payload)}
          onRemoveProjectNote={(noteId) => onRemoveProjectNote(selected.id, noteId)}
          requirementProgress={requirementProgress}
          projectSteps={projectSteps}
          todoEdits={todoEdits}
          onCycleRequirementStatus={(key, status) =>
            onCycleRequirementStatus(selected.id, key, status)
          }
          onAddRequirementTodo={(key, title) => onAddRequirementTodo(selected.id, key, title)}
          listSchools={schools.filter((row) => !row.archived)}
          listPhaseId={phaseId}
          processPhaseLabel={processPhaseLabel}
          onSendVisitPlan={onSendVisitPlan}
          initialTab={initialModalTab}
          householdFinances={householdFinances}
          onHouseholdFinancesChange={onHouseholdFinancesChange}
          scholarshipTodoIds={scholarshipTodoIds}
          onAddScholarshipTodo={onAddScholarshipTodo}
          canViewFinancesTab={canViewFinancesTab}
        />
      ) : null}

      {addOpen ? (
        <AddSchoolDialog
          schools={schools}
          onClose={() => setAddOpen(false)}
          onOpen={onOpen}
          onAdded={(school) => {
            onAdded(school);
            setAddOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

function NeedsResearchLabels({ school }: { school: School }) {
  const needed = researchGroupsNeeded(school);
  if (!needed.length) return null;
  return (
    <span className="needs-research" aria-label={`Needs research: ${needed.join(", ")}`}>
      {needed.map((group) => (
        <small key={group} className="needs-research-tag">
          Needs {group}
        </small>
      ))}
    </span>
  );
}
