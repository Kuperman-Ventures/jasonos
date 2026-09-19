"use client";

import { useMemo, useState } from "react";
import { CollegeRecord } from "./CollegeRecord";
import { compareSchools, nextAction, primaryDeadline, type SortKey } from "@/lib/list";
import {
  INTEREST_LEVELS,
  SELECTIVITY_TIERS,
  formatDate,
  schoolMark,
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
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<SelectivityTier | "any">("any");
  const [interest, setInterest] = useState<InterestLevel | "any">("any");
  const [sort, setSort] = useState<SortKey>("list");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = schools.filter((school) => {
      if (tier !== "any" && school.selectivityTier !== tier) return false;
      if (interest !== "any" && school.interestLevel !== interest) return false;
      if (!q) return true;
      return [school.name, school.location, school.notes, school.admissionsContext].join(" ").toLowerCase().includes(q);
    });
    const sorted = [...filtered].sort((a, b) => compareSchools(a, b, sort));
    return sortDir === 1 ? sorted : sorted.reverse();
  }, [schools, query, tier, interest, sort, sortDir]);

  const selected = schools.find((school) => school.id === selectedId) ?? null;

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

  return (
    <section>
      <div className="panel-toolbar">
        <div>
          <h2 className="section-title">College list</h2>
        </div>
      </div>
      <form
        className="add-row"
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
        <input className="field" value={name} placeholder="Add a school" disabled={adding} onChange={(event) => setName(event.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={adding}>
          {adding ? "Looking up" : "Add"}
        </button>
      </form>
      <div className="readouts">
        <div className="readout">
          <p className="readout-label">Showing</p>
          <p className="readout-figure">
            <span className="accent">{visible.length}</span>
          </p>
          <p className="readout-delta">of {schools.length} schools</p>
        </div>
      </div>
      <div className="filters">
        <input className="field" value={query} placeholder="Search" onChange={(event) => setQuery(event.target.value)} />
        <select className="field" value={tier} aria-label="Filter by selectivity" onChange={(event) => setTier(event.target.value as SelectivityTier | "any")}>
          <option value="any">All selectivity</option>
          {SELECTIVITY_TIERS.map((item) => (
            <option key={item.id || "unset"} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <select className="field" value={interest} aria-label="Filter by interest" onChange={(event) => setInterest(event.target.value as InterestLevel | "any")}>
          <option value="any">All interest</option>
          {INTEREST_LEVELS.map((item) => (
            <option key={item.id || "unset"} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          className="field"
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
      </div>

      <div className="table-wrap schools-wrap">
        <table className="schools">
          <thead>
            <tr>
              <th>
                <button type="button" className={sort === "name" ? "active" : ""} onClick={() => toggleSort("name")}>
                  School{arrow("name")}
                </button>
              </th>
              <th>
                <button type="button" className={sort === "status" ? "active" : ""} onClick={() => toggleSort("status")}>
                  Status{arrow("status")}
                </button>
              </th>
              <th>Track and deadline</th>
              <th>
                <button type="button" className={sort === "selectivity" ? "active" : ""} onClick={() => toggleSort("selectivity")}>
                  Selectivity{arrow("selectivity")}
                </button>
              </th>
              <th>
                <button type="button" className={sort === "interest" ? "active" : ""} onClick={() => toggleSort("interest")}>
                  Interest{arrow("interest")}
                </button>
              </th>
              <th>
                <button type="button" className={sort === "action" ? "active" : ""} onClick={() => toggleSort("action")}>
                  Next action{arrow("action")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((school) => {
              const deadline = primaryDeadline(school);
              const action = nextAction(school);
              const track = trackLabel(school.admissionTrack);
              return (
                <tr key={school.id} className={school.id === selectedId ? "selected" : undefined} onClick={() => onOpen(school.id)}>
                  <td className="school-name">
                    <div className="school-id">
                      <span className="school-mark" title="Initials, not the school logo">
                        {schoolMark(school.name)}
                      </span>
                      <span>{school.name}</span>
                    </div>
                  </td>
                  <td>{statusLabel(school.applicationStatus)}</td>
                  <td>
                    <div>{track || "Not chosen"}</div>
                    <div className="muted">{deadline.date ? formatDate(deadline.date) : "No date"}</div>
                  </td>
                  <td>{tierLabel(school.selectivityTier)}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <select
                      className="field compact"
                      value={school.interestLevel}
                      aria-label={`Interest for ${school.name}`}
                      onChange={(event) => onPatch(school.id, { interestLevel: event.target.value as School["interestLevel"] })}
                    >
                      {INTEREST_LEVELS.map((item) => (
                        <option key={item.id || "unset"} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div>{action.title || "—"}</div>
                    {action.dueDate ? <div className="muted">{formatDate(action.dueDate)}</div> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="school-cards">
        {visible.map((school) => {
          const action = nextAction(school);
          const deadline = primaryDeadline(school);
          return (
            <div key={school.id} className="school-card" onClick={() => onOpen(school.id)}>
              <h3>{school.name}</h3>
              <div className="card-meta">
                <span>{statusLabel(school.applicationStatus)}</span>
                <span>{tierLabel(school.selectivityTier)}</span>
                <span>{trackLabel(school.admissionTrack) || "Track not chosen"}</span>
                <span>{deadline.date ? formatDate(deadline.date) : "No deadline"}</span>
                <span>{action.title || "No next action"}</span>
              </div>
              <div onClick={(event) => event.stopPropagation()}>
                <select
                  className="field compact"
                  value={school.interestLevel}
                  aria-label={`Interest for ${school.name}`}
                  onChange={(event) => onPatch(school.id, { interestLevel: event.target.value as School["interestLevel"] })}
                >
                  {INTEREST_LEVELS.map((item) => (
                    <option key={item.id || "unset"} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {selected ? (
        <CollegeRecord
          key={selected.id}
          school={selected}
          onBack={onClose}
          onPatch={(patch) => onPatch(selected.id, patch)}
          onDelete={() => onDelete(selected.id)}
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
