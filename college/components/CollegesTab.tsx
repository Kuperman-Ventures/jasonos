"use client";

import { useMemo, useState } from "react";
import { CollegeRecord } from "./CollegeRecord";
import { compareSchools, nextDate, nextOpenStep, planShort, type SortKey } from "@/lib/list";
import {
  CHOICES,
  formatDate,
  selectivityRank,
  selectivityTone,
  type Choice,
  type Owner,
  type School,
  type SelectivityGuide,
} from "@/lib/types";

function selectivityTag(value: string) {
  const tone = selectivityTone(value);
  if (tone === "target") return "tag tag-neutral";
  return "tag tag-outline";
}

export function CollegesTab({
  schools,
  guide,
  selectedId,
  onOpen,
  onClose,
  onPatch,
  onCreate,
  onDelete,
  onAddStep,
  onPatchStep,
  onDeleteStep,
}: {
  schools: School[];
  guide: SelectivityGuide[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<School>) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onAddStep: (id: string, label: string, owner: Owner) => void;
  onPatchStep: (id: string, stepId: string, patch: { done?: boolean; owner?: Owner; label?: string }) => void;
  onDeleteStep: (id: string, stepId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<Choice | "">("");
  const [selectivity, setSelectivity] = useState("");
  const [materials, setMaterials] = useState("");
  const [visited, setVisited] = useState("");
  const [sort, setSort] = useState<SortKey>("list");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [name, setName] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  const selectivityOptions = useMemo(() => {
    const values = [...new Set(schools.map((school) => school.selectivity).filter(Boolean))];
    return values.sort((a, b) => selectivityRank(a) - selectivityRank(b));
  }, [schools]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = schools.filter((school) => {
      if (choice && school.choice !== choice) return false;
      if (selectivity && school.selectivity !== selectivity) return false;
      if (materials && school.materials !== materials) return false;
      if (visited === "yes" && !school.visited) return false;
      if (visited === "no" && school.visited) return false;
      if (!q) return true;
      return [school.name, school.location, school.notes, school.selectivity].join(" ").toLowerCase().includes(q);
    });
    const sorted = [...filtered].sort((a, b) => compareSchools(a, b, sort));
    return sortDir === 1 ? sorted : sorted.reverse();
  }, [schools, query, choice, selectivity, materials, visited, sort, sortDir]);

  const selected = schools.find((school) => school.id === selectedId);
  if (selected) {
    return (
      <CollegeRecord
        school={selected}
        guide={guide}
        onBack={onClose}
        onPatch={(patch) => onPatch(selected.id, patch)}
        onDelete={() => onDelete(selected.id)}
        onAddStep={(label, owner) => onAddStep(selected.id, label, owner)}
        onPatchStep={(stepId, patch) => onPatchStep(selected.id, stepId, patch)}
        onDeleteStep={(stepId) => onDeleteStep(selected.id, stepId)}
      />
    );
  }

  function toggleSort(next: SortKey) {
    if (sort === next) setSortDir((dir) => (dir === 1 ? -1 : 1));
    else {
      setSort(next);
      setSortDir(1);
    }
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
          if (!name.trim()) return;
          onCreate(name.trim());
          setName("");
        }}
      >
        <input className="field" value={name} placeholder="Add a school" onChange={(event) => setName(event.target.value)} />
        <button type="submit" className="btn btn-primary">
          Add
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
        <select className="field" value={choice} onChange={(event) => setChoice(event.target.value as Choice | "")}>
          <option value="">All choices</option>
          {CHOICES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <select className="field" value={selectivity} onChange={(event) => setSelectivity(event.target.value)}>
          <option value="">All preliminary selectivity</option>
          {selectivityOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select className="field" value={materials} onChange={(event) => setMaterials(event.target.value)}>
          <option value="">Materials: any</option>
          <option value="Yes">Materials: yes</option>
          <option value="No">Materials: no</option>
        </select>
        <select className="field" value={visited} onChange={(event) => setVisited(event.target.value)}>
          <option value="">Visited: any</option>
          <option value="yes">Visited</option>
          <option value="no">Not visited</option>
        </select>
        <select className="field" value={sort} onChange={(event) => { setSort(event.target.value as SortKey); setSortDir(1); }}>
          <option value="list">Sheet order</option>
          <option value="choice">Choice</option>
          <option value="name">School name</option>
          <option value="selectivity">Preliminary Selectivity</option>
          <option value="visited">Visited</option>
          <option value="date">Next date</option>
        </select>
      </div>

      <div className="table-wrap schools-wrap">
        <table className="schools">
          <thead>
            <tr>
              <th>
                <button type="button" className={sort === "name" ? "active" : ""} onClick={() => toggleSort("name")}>
                  School{sort === "name" ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </button>
              </th>
              <th>
                <button type="button" className={sort === "choice" ? "active" : ""} onClick={() => toggleSort("choice")}>
                  Choice{sort === "choice" ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </button>
              </th>
              <th>
                <button type="button" className={sort === "selectivity" ? "active" : ""} onClick={() => toggleSort("selectivity")}>
                  Preliminary Selectivity{sort === "selectivity" ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </button>
              </th>
              <th>Location</th>
              <th>
                <button type="button" className={sort === "visited" ? "active" : ""} onClick={() => toggleSort("visited")}>
                  Visited{sort === "visited" ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </button>
              </th>
              <th>
                <button type="button" className={sort === "date" ? "active" : ""} onClick={() => toggleSort("date")}>
                  Next date{sort === "date" ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </button>
              </th>
              <th>Materials</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((school) => {
              const date = nextDate(school);
              const step = nextOpenStep(school);
              const plan = planShort(school.plan);
              return (
                <tr key={school.id} onClick={() => onOpen(school.id)}>
                  <td className="school-name">
                    {school.name}
                    {plan ? <small>{plan}</small> : null}
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <select
                      className="field compact"
                      value={school.choice}
                      aria-label={`Choice for ${school.name}`}
                      onChange={(event) => onPatch(school.id, { choice: event.target.value as School["choice"] })}
                    >
                      {CHOICES.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {school.selectivity ? <span className={selectivityTag(school.selectivity)}>{school.selectivity}</span> : "—"}
                  </td>
                  <td>{school.location}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={school.visited}
                      aria-label={`Visited ${school.name}`}
                      onChange={(event) => onPatch(school.id, { visited: event.target.checked })}
                    />
                  </td>
                  <td>
                    <div className="datum">{date.date ? formatDate(date.date) : "—"}</div>
                    {date.label ? <div className="muted">{date.label}</div> : null}
                  </td>
                  <td>{school.materials || "—"}</td>
                  <td>{step || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="school-cards">
        {visible.map((school) => (
          <div key={school.id} className="school-card" onClick={() => onOpen(school.id)}>
            <h3>{school.name}</h3>
            <div className="card-meta">
              {school.selectivity ? <span className={selectivityTag(school.selectivity)}>{school.selectivity}</span> : null}
              <span>{school.location}</span>
              <span>{school.visited ? "Visited" : "Not visited"}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="guide">
        <div className={guideOpen ? "faq-item open" : "faq-item"}>
          <button type="button" className="faq-q" onClick={() => setGuideOpen((open) => !open)}>
            <span>Preliminary Selectivity</span>
            <span className="chev mono">›</span>
          </button>
          <div className="faq-a">
            {guide.map((item) => (
              <p key={item.term}>
                <b>{item.term}. </b>
                {item.meaning}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
