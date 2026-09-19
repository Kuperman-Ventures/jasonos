"use client";

import { useState } from "react";
import {
  CHOICES,
  OWNERS,
  PLANS,
  STEP_PRESETS,
  formatDate,
  ownerLabel,
  selectivityTone,
  type Owner,
  type School,
  type SelectivityGuide,
} from "@/lib/types";

export function CollegeRecord({
  school,
  guide,
  onBack,
  onPatch,
  onDelete,
  onAddStep,
  onPatchStep,
  onDeleteStep,
}: {
  school: School;
  guide: SelectivityGuide[];
  onBack: () => void;
  onPatch: (patch: Partial<School>) => void;
  onDelete: () => void;
  onAddStep: (label: string, owner: Owner) => void;
  onPatchStep: (stepId: string, patch: { done?: boolean; owner?: Owner; label?: string }) => void;
  onDeleteStep: (stepId: string) => void;
}) {
  const [stepLabel, setStepLabel] = useState("");
  const [stepOwner, setStepOwner] = useState<Owner>("kyle");
  const meaning = guide.find((item) => item.term === school.selectivity)?.meaning;
  const facts: [string, string][] = [
    ["Location", school.location],
    ["Campus / Size", school.campusSize],
    ["Mechanical Engineering", school.mechanicalEngineering],
    ["Materials Science / Engineering", school.materials],
    ["Materials Offering Type", school.materialsOffering],
    ["Admissions Context", school.admissionsContext],
    ["SAT Context", school.satContext],
  ];

  return (
    <section>
      <button type="button" className="back-link" onClick={onBack}>
        ← All colleges
      </button>
      <div className="detail-head">
        <div>
          <h2>{school.name}</h2>
          <p className="section-sub" style={{ marginTop: 8 }}>
            {school.location}
          </p>
        </div>
        <span className={`pill ${selectivityTone(school.selectivity)}`}>{school.selectivity || "No selectivity yet"}</span>
      </div>
      {meaning ? <p className="section-sub">{meaning}</p> : null}

      <div className="fact-grid">
        {facts.map(([label, value]) => (
          <div key={label} className="fact">
            <div className="label">{label}</div>
            <p>{value || "—"}</p>
          </div>
        ))}
      </div>

      <div className="callprep" style={{ marginBottom: 18 }}>
        <h3>Notes for Kyle</h3>
        <textarea className="field" value={school.notes} onChange={(event) => onPatch({ notes: event.target.value })} />
      </div>

      <div className="callprep" style={{ marginBottom: 18 }}>
        <h3>Family tracking</h3>
        <div className="filters">
          <label>
            <span className="label mono" style={{ display: "block", marginBottom: 4 }}>
              Choice
            </span>
            <select className="field" value={school.choice} onChange={(event) => onPatch({ choice: event.target.value as School["choice"] })}>
              {CHOICES.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label mono" style={{ display: "block", marginBottom: 4 }}>
              Plan
            </span>
            <select className="field" value={school.plan} onChange={(event) => onPatch({ plan: event.target.value as School["plan"] })}>
              {PLANS.map((plan) => (
                <option key={plan.id || "unset"} value={plan.id}>
                  {plan.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "flex-end", gap: 8, paddingBottom: 8 }}>
            <input type="checkbox" checked={school.visited} onChange={(event) => onPatch({ visited: event.target.checked })} />
            Visited
          </label>
        </div>
        <div className="filters">
          <label>
            <span className="label mono" style={{ display: "block", marginBottom: 4 }}>
              Visit date
            </span>
            <input className="field" type="date" value={school.visitDate ?? ""} onChange={(event) => onPatch({ visitDate: event.target.value || null })} />
          </label>
          <label>
            <span className="label mono" style={{ display: "block", marginBottom: 4 }}>
              Key date
            </span>
            <input className="field" type="date" value={school.deadline ?? ""} onChange={(event) => onPatch({ deadline: event.target.value || null })} />
          </label>
          <label>
            <span className="label mono" style={{ display: "block", marginBottom: 4 }}>
              What that date is
            </span>
            <input
              className="field"
              value={school.deadlineLabel}
              placeholder="Early Action deadline"
              onChange={(event) => onPatch({ deadlineLabel: event.target.value })}
            />
          </label>
        </div>
        <label className="label mono" style={{ display: "block", margin: "8px 0 4px" }}>
          Visit notes
        </label>
        <textarea className="field" value={school.visitNotes} onChange={(event) => onPatch({ visitNotes: event.target.value })} />
        {school.deadline ? (
          <p className="muted" style={{ marginTop: 10 }}>
            Next date on the list: {formatDate(school.deadline)}
            {school.deadlineLabel ? ` · ${school.deadlineLabel}` : ""}
          </p>
        ) : null}
      </div>

      <div className="callprep" style={{ marginBottom: 18 }}>
        <h3>Steps for this school</h3>
        {school.steps.length === 0 ? <p className="muted">No steps yet. Add a visit, essay, or deadline task when it exists.</p> : null}
        {school.steps.map((step) => (
          <div key={step.id} className={step.done ? "step-row done" : "step-row"}>
            <input type="checkbox" checked={step.done} onChange={(event) => onPatchStep(step.id, { done: event.target.checked })} />
            <label>{step.label}</label>
            <select className="field compact" value={step.owner} onChange={(event) => onPatchStep(step.id, { owner: event.target.value as Owner })}>
              {OWNERS.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.label}
                </option>
              ))}
            </select>
            <button type="button" className="print-btn" onClick={() => onDeleteStep(step.id)}>
              Remove
            </button>
          </div>
        ))}
        <div className="add-row" style={{ marginTop: 12 }}>
          <input
            className="field"
            list="step-presets"
            value={stepLabel}
            placeholder="Add a step"
            onChange={(event) => setStepLabel(event.target.value)}
          />
          <datalist id="step-presets">
            {STEP_PRESETS.map((preset) => (
              <option key={preset} value={preset} />
            ))}
          </datalist>
          <select className="field" value={stepOwner} onChange={(event) => setStepOwner(event.target.value as Owner)}>
            {OWNERS.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {ownerLabel(owner.id)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="print-btn"
            onClick={() => {
              if (!stepLabel.trim()) return;
              onAddStep(stepLabel.trim(), stepOwner);
              setStepLabel("");
            }}
          >
            Add
          </button>
        </div>
      </div>

      <button
        type="button"
        className="print-btn danger no-print"
        onClick={() => {
          if (window.confirm(`Remove ${school.name} from the list?`)) onDelete();
        }}
      >
        Remove school
      </button>
    </section>
  );
}
