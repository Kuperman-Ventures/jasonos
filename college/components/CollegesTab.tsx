"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CollegeRecord } from "./CollegeRecord";
import { SchoolMark } from "./SchoolMark";
import { ListPhaseIcon } from "./ListPhaseIcon";
import { SelectivityMixPie } from "./SelectivityMixPie";
import { compareSchools, nextAction, primaryDeadline, type SortKey } from "@/lib/list";
import {
  LIST_COLUMNS,
  LIST_PHASES,
  advanceSchoolPatch,
  archiveSchoolPatch,
  currentListPhaseId,
  listPhaseById,
  normalizeColumns,
  retreatSchoolPatch,
  phaseCountGauge,
  schoolOnListPhase,
  selectivityGauges,
  selectivityPieSlices,
  type ListColumnId,
  type ListPhaseId,
  type MemberListPrefs,
} from "@/lib/list-phases";
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
  dateline,
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
  dateline: string;
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

  const countGauge = phaseCountGauge(activeCount, phase);
  const mixPie = useMemo(
    () =>
      selectivityPieSlices(
        schools.filter((school) => !school.archived && schoolOnListPhase(school, phaseId)),
      ),
    [schools, phaseId],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = phaseSchools.filter((school) => {
      if (tier !== "any" && school.selectivityTier !== tier) return false;
      if (interest !== "any" && school.interestLevel !== interest) return false;
      if (!q) return true;
      return [school.name, school.location, school.notes, school.admissionsContext]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    const sorted = [...filtered].sort((a, b) => compareSchools(a, b, sort));
    return sortDir === 1 ? sorted : sorted.reverse();
  }, [phaseSchools, query, tier, interest, sort, sortDir]);

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
          <td key={column} onClick={(event) => event.stopPropagation()}>
            <select
              className="field compact"
              value={school.interestLevel}
              aria-label={`Interest for ${school.name}`}
              onChange={(event) =>
                onPatch(school.id, { interestLevel: event.target.value as School["interestLevel"] })
              }
            >
              {INTEREST_LEVELS.map((item) => (
                <option key={item.id || "unset"} value={item.id}>
                  {item.label}
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
  const gaugeFill = Math.min(countGauge.percent, 160);

  return (
    <section className="colleges-list" data-list-phase={phaseId}>
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>College list</h2>
        </div>
        <div className="readout">
          <span className="label">
            <ListPhaseIcon phaseId={phaseId} />
            {phase.label} list
          </span>
          <span className="figure">{activeCount}</span>
          <span className="unit">
            of ~{phase.target} target ({phase.rangeLabel})
          </span>
        </div>
      </header>

      <div className="list-phase-bar" role="tablist" aria-label="List phase">
        {LIST_PHASES.map((item) => {
          const count = schools.filter(
            (school) => !school.archived && schoolOnListPhase(school, item.id),
          ).length;
          const isCalendarCurrent = item.id === calendarPhaseId;
          const isViewing = phaseId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isViewing}
              aria-current={isCalendarCurrent ? "date" : undefined}
              className={[isViewing ? "active" : "", isCalendarCurrent ? "is-current" : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setPhaseId(item.id)}
            >
              <span className="phase-top">
                <span className="phase-name">
                  <ListPhaseIcon phaseId={item.id} />
                  {item.label}
                </span>
                {isCalendarCurrent ? <span className="phase-now">Current window</span> : null}
              </span>
              <span className="phase-window">{item.window}</span>
              <span className="phase-count">
                {count}/{item.target} schools
              </span>
            </button>
          );
        })}
      </div>

      <div className="list-gauges" aria-label="List gauges">
        <div className="list-gauge list-gauge-count">
          <div className="list-gauge-head">
            <span className="label">List size vs target</span>
            <span className="list-gauge-pct">{countGauge.percent}%</span>
          </div>
          <div className="list-gauge-track" aria-hidden="true">
            <span className="list-gauge-fill" style={{ width: `${Math.min(gaugeFill, 100)}%` }} />
            {gaugeFill > 100 ? (
              <span className="list-gauge-over" style={{ width: `${Math.min(gaugeFill - 100, 60)}%` }} />
            ) : null}
          </div>
          <div className="list-gauge-note">
            {activeCount} active · target ~{phase.target} ({phase.rangeLabel})
            {countGauge.percent > 100 ? " · over target" : null}
          </div>
        </div>

        <div className="list-gauge list-gauge-mix">
          <div className="list-gauge-head">
            <span className="label">Selectivity mix</span>
            <span className="list-gauge-pct">
              {mixPie.setCount ? "vs ideal" : activeCount ? "set tiers" : "no schools yet"}
            </span>
          </div>
          <SelectivityMixPie
            slices={mixPie.slices}
            setCount={mixPie.setCount}
            unsetCount={mixPie.unsetCount}
          />
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
                  school.id === selectedId ? "selected" : "",
                  school.archived ? "archived-row" : "",
                ]
                  .filter(Boolean)
                  .join(" ") || undefined}
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
              </div>
              {columns.includes("interest") ? (
                <div onClick={(event) => event.stopPropagation()}>
                  <select
                    className="field compact"
                    value={school.interestLevel}
                    aria-label={`Interest for ${school.name}`}
                    onChange={(event) =>
                      onPatch(school.id, { interestLevel: event.target.value as School["interestLevel"] })
                    }
                  >
                    {INTEREST_LEVELS.map((item) => (
                      <option key={item.id || "unset"} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          );
        })}
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
