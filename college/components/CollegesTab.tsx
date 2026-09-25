"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LIST_COLUMNS,
  LIST_PHASES,
  advanceSchoolPatch,
  archiveSchoolPatch,
  currentListPhaseId,
  listPhaseBarProgress,
  listPhaseById,
  listPhaseDaySpan,
  listPhaseEyebrow,
  listSizeBar,
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
import { compareSchools, nextAction, primaryDeadline, type SortKey } from "@/lib/list";
import { canAdvanceListPhase } from "@/lib/permissions";
import {
  INTEREST_LEVELS,
  SELECTIVITY_TIERS,
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
} from "@/lib/types";

export function CollegesTab({
  schools,
  selectedId,
  listPrefs,
  memberId,
  memberRole,
  onListPrefsChange,
  onOpen,
  onClose,
  onPatch,
  onCreate,
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
}: {
  schools: School[];
  selectedId: string | null;
  listPrefs: MemberListPrefs;
  memberId: string;
  memberRole: string;
  onListPrefsChange: (prefs: MemberListPrefs) => void;
  onOpen: (id: string) => void;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<School>) => void;
  onCreate: (name: string) => Promise<void>;
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
}) {
  const canAdvance = canAdvanceListPhase({ id: memberId, role: memberRole });
  const [phaseId, setPhaseId] = useState<ListPhaseId>("exploration");
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<SelectivityTier | "any">("any");
  const [interest, setInterest] = useState<InterestLevel | "any">("any");
  const [aerospaceFilter, setAerospaceFilter] = useState<"any" | "Yes" | "Partial" | "No">("any");
  const [sort, setSort] = useState<SortKey>("list");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPhaseId(currentListPhaseId());
  }, []);

  const phase = listPhaseById(phaseId);
  const columns = normalizeColumns(listPrefs.columnsByPhase[phaseId], phase);
  const showArchived = listPrefs.showArchived;

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
      if (school.archived) return showArchived && school.phasesParticipated.includes(phaseId);
      return schoolOnListPhase(school, phaseId);
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
      if (
        aerospaceFilter !== "any" &&
        school.aerospaceEngineering.trim().toLowerCase() !== aerospaceFilter.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return [school.name, school.location, school.notes, school.admissionsContext, school.aerospaceProgram]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    const sorted = [...filtered].sort((a, b) => compareSchools(a, b, sort));
    return sortDir === 1 ? sorted : sorted.reverse();
  }, [phaseSchools, query, tier, interest, aerospaceFilter, sort, sortDir]);

  const selected = schools.find((school) => school.id === selectedId) ?? null;
  const archivedInPhase = schools.filter(
    (school) => school.archived && school.phasesParticipated.includes(phaseId),
  ).length;

  function toggleSort(next: SortKey) {
    if (sort === next) setSortDir((dir) => (dir === 1 ? -1 : 1));
    else {
      setSort(next);
      setSortDir(1);
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
              </span>
            </div>
          </td>
        );
      case "location":
        return (
          <td key={column}>
            <div>{school.location || "—"}</div>
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
      default:
        return null;
    }
  }

  function sortKeyForColumn(column: ListColumnId): SortKey | null {
    if (column === "school") return "name";
    if (column === "status") return "status";
    if (column === "selectivity") return "selectivity";
    if (column === "interest") return "interest";
    if (column === "action") return "action";
    return null;
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
          <div className="list-dash-panels">
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

      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || adding) return;
          const nextName = name.trim();
          setAdding(true);
          void onCreate(nextName)
            .then(() => setName(""))
            .finally(() => setAdding(false));
        }}
      >
        <input
          className="input grow"
          type="search"
          value={query}
          placeholder="Search schools"
          onChange={(event) => setQuery(event.target.value)}
        />
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
        <select
          className="select"
          value={aerospaceFilter}
          aria-label="Filter by aerospace engineering"
          onChange={(event) =>
            setAerospaceFilter(event.target.value as "any" | "Yes" | "Partial" | "No")
          }
        >
          <option value="any">All aerospace</option>
          <option value="Yes">Aerospace Yes</option>
          <option value="Partial">Aerospace Partial</option>
          <option value="No">Aerospace No</option>
        </select>
        <select
          className="select"
          value={sort}
          aria-label="Sort schools"
          onChange={(event) => {
            setSort(event.target.value as SortKey);
            setSortDir(1);
          }}
        >
          <option value="list">Sheet order</option>
          <option value="name">School name</option>
          <option value="selectivity">Selectivity</option>
          <option value="interest">Interest</option>
          <option value="status">Application status</option>
          <option value="action">Next action</option>
        </select>
        <div className="columns-menu" ref={columnsRef}>
          <button
            type="button"
            className="btn btn-ghost"
            aria-expanded={columnsOpen}
            onClick={() => setColumnsOpen((open) => !open)}
          >
            Columns
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
        <label className="archive-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) =>
              onListPrefsChange({ ...listPrefs, showArchived: event.target.checked })
            }
          />
          <span>
            Archived{archivedInPhase ? ` (${archivedInPhase})` : ""}
          </span>
        </label>
        <input
          className="input"
          value={name}
          placeholder="Add a school"
          disabled={adding}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={adding}>
          {adding ? "Looking up" : "Add"}
        </button>
      </form>

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
          <p className="empty-list">No schools in {phase.label} yet.</p>
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
                </span>
              </h3>
              <div className="card-meta">
                {columns.includes("status") ? <span>{statusLabel(school.applicationStatus) || "—"}</span> : null}
                {columns.includes("location") ? <span>{school.location || "—"}</span> : null}
                {columns.includes("selectivity") ? <span>{tierLabel(school.selectivityTier) || "—"}</span> : null}
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
          key={selected.id}
          school={selected}
          canAdvancePhase={canAdvance}
          onBack={onClose}
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
        />
      ) : null}
    </section>
  );
}
