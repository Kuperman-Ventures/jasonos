"use client";

import { useEffect, useRef, useState } from "react";
import {
  ADMISSION_TRACKS,
  APPLICATION_STATUSES,
  INTEREST_LEVELS,
  OWNERS,
  SELECTIVITY_TIERS,
  STEP_PRESETS,
  ownerLabel,
  type ContactPatch,
  type DeadlinePatch,
  type Owner,
  type School,
} from "@/lib/types";
import { LIST_PHASES, nextListPhaseId } from "@/lib/list-phases";
import { sourceLines } from "@/lib/school-research";
import { SchoolMark } from "./SchoolMark";

function BlurInput({
  value,
  onCommit,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onCommit: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  return (
    <input
      className="field"
      aria-label={ariaLabel}
      placeholder={placeholder}
      defaultValue={value}
      key={value}
      onBlur={(event) => {
        if (event.target.value !== value) onCommit(event.target.value);
      }}
    />
  );
}

export function CollegeRecord({
  school,
  onBack,
  onPatch,
  onDelete,
  onAdvance,
  onArchive,
  onRestore,
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
  school: School;
  onBack: () => void;
  onPatch: (patch: Partial<School>) => void;
  onDelete: () => void;
  onAdvance: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onAddStep: (label: string, owner: Owner) => void;
  onPatchStep: (stepId: string, patch: { done?: boolean; owner?: Owner; label?: string }) => void;
  onDeleteStep: (stepId: string) => void;
  onAddDeadline: (title: string, dueDate: string | null) => void;
  onPatchDeadline: (deadlineId: string, patch: DeadlinePatch) => void;
  onDeleteDeadline: (deadlineId: string) => void;
  onAddContact: (contact: ContactPatch) => void;
  onPatchContact: (contactId: string, patch: ContactPatch) => void;
  onDeleteContact: (contactId: string) => void;
}) {
  const [stepLabel, setStepLabel] = useState("");
  const [stepOwner, setStepOwner] = useState<Owner>("kyle");
  const [deadlineTitle, setDeadlineTitle] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onBackRef.current();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const deadlines = [...school.deadlines].sort((a, b) => {
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return a.sortOrder - b.sortOrder;
  });

  const program: [string, string][] = [
    ["Location", school.location],
    ["Campus / size", school.campusSize],
    ["Mechanical engineering", school.mechanicalEngineering],
    ["Materials", school.materials],
    ["Materials offering", school.materialsOffering],
    ["SAT context", school.satContext],
    ["Admissions context", school.admissionsContext],
  ];

  const phaseLabel =
    LIST_PHASES.find((phase) => phase.id === school.listPhase)?.label ?? school.listPhase;
  const nextPhase = nextListPhaseId(school.listPhase);
  const nextPhaseLabel = nextPhase
    ? LIST_PHASES.find((phase) => phase.id === nextPhase)?.label
    : null;
  const participated = school.phasesParticipated
    .map((id) => LIST_PHASES.find((phase) => phase.id === id)?.label ?? id)
    .join(" → ");

  return (
    <div className="drawer-root">
      <button type="button" className="drawer-backdrop" aria-label="Close school" onClick={onBack} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={school.name}>
        <button type="button" className="back-link" onClick={onBack}>
          Close
        </button>
        <div className="detail-head">
          <div className="school-id">
            <SchoolMark name={school.name} website={school.website} />
            <div>
              <h2>{school.name}</h2>
              <p className="section-sub">{school.location}</p>
            </div>
          </div>
        </div>

        <section className="drawer-section">
          <h3>List phase</h3>
          <p className="section-sub">
            {school.archived ? "Archived" : phaseLabel}
            {participated ? ` · participated: ${participated}` : ""}
          </p>
          <div className="phase-actions">
            {!school.archived && nextPhaseLabel ? (
              <button type="button" className="btn btn-primary" onClick={onAdvance}>
                Advance to {nextPhaseLabel}
              </button>
            ) : null}
            {school.archived ? (
              <button type="button" className="btn btn-primary" onClick={onRestore}>
                Restore to list
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (
                    window.confirm(
                      `Archive ${school.name}? It stays on file with the phases it was in.`,
                    )
                  ) {
                    onArchive();
                  }
                }}
              >
                Archive from list
              </button>
            )}
          </div>
        </section>

        <section className="drawer-section">
          <h3>Admissions and academics</h3>
          <div className="drawer-grid">
            <label className="stack-field">
              <span className="label">Selectivity tier</span>
              <select
                className="field"
                value={school.selectivityTier}
                onChange={(event) => onPatch({ selectivityTier: event.target.value as School["selectivityTier"] })}
              >
                {SELECTIVITY_TIERS.map((item) => (
                  <option key={item.id || "unset"} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-field">
              <span className="label">Application status</span>
              <select
                className="field"
                value={school.applicationStatus}
                onChange={(event) => onPatch({ applicationStatus: event.target.value as School["applicationStatus"] })}
              >
                {APPLICATION_STATUSES.map((item) => (
                  <option key={item.id || "unset"} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-field">
              <span className="label">Admission track</span>
              <select
                className="field"
                value={school.admissionTrack}
                onChange={(event) => onPatch({ admissionTrack: event.target.value as School["admissionTrack"] })}
              >
                {ADMISSION_TRACKS.map((item) => (
                  <option key={item.id || "unset"} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-field">
              <span className="label">Interest</span>
              <select
                className="field"
                value={school.interestLevel}
                onChange={(event) => onPatch({ interestLevel: event.target.value as School["interestLevel"] })}
              >
                {INTEREST_LEVELS.map((item) => (
                  <option key={item.id || "unset"} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-field">
              <span className="label">Test policy</span>
              <BlurInput
                value={school.testPolicy}
                ariaLabel="Test policy"
                placeholder="Not entered"
                onCommit={(value) => onPatch({ testPolicy: value })}
              />
            </label>
            <label className="stack-field">
              <span className="label">Middle 50%</span>
              <BlurInput
                value={school.middle50}
                ariaLabel="Middle 50 percent"
                placeholder="Not entered"
                onCommit={(value) => onPatch({ middle50: value })}
              />
            </label>
            <label className="stack-field">
              <span className="label">Application platform</span>
              <BlurInput
                value={school.applicationPlatform}
                ariaLabel="Application platform"
                placeholder="Not entered"
                onCommit={(value) => onPatch({ applicationPlatform: value })}
              />
            </label>
            <label className="stack-field">
              <span className="label">Teacher recommendations</span>
              <BlurInput
                value={school.teacherRecs}
                ariaLabel="Teacher recommendation count"
                placeholder="Not entered"
                onCommit={(value) => onPatch({ teacherRecs: value })}
              />
            </label>
          </div>
          <label className="stack-field" style={{ marginTop: 16 }}>
            <span className="label">Required essays</span>
            <textarea
              className="field"
              defaultValue={school.requiredEssays}
              key={school.requiredEssays}
              placeholder="Not entered"
              onBlur={(event) => {
                if (event.target.value !== school.requiredEssays) onPatch({ requiredEssays: event.target.value });
              }}
            />
          </label>
          <div className="fact-grid" style={{ marginTop: 24 }}>
            {program.map(([label, value]) => (
              <div key={label} className="fact">
                <div className="label">{label}</div>
                <p>{value || "—"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="drawer-section">
          <h3>Financials</h3>
          <div className="drawer-grid">
            <label className="stack-field">
              <span className="label">Sticker price</span>
              <BlurInput
                value={school.costOfAttendance}
                ariaLabel="Cost of attendance"
                placeholder="Not entered"
                onCommit={(value) => onPatch({ costOfAttendance: value })}
              />
            </label>
            <label className="stack-field">
              <span className="label">Net price estimate</span>
              <BlurInput
                value={school.netPriceEstimate}
                ariaLabel="Net price estimate"
                placeholder="Not entered"
                onCommit={(value) => onPatch({ netPriceEstimate: value })}
              />
            </label>
          </div>
          <label className="stack-field" style={{ marginTop: 16 }}>
            <span className="label">Merit aid notes</span>
            <textarea
              className="field"
              defaultValue={school.meritAidNotes}
              key={school.meritAidNotes}
              placeholder="Not entered"
              onBlur={(event) => {
                if (event.target.value !== school.meritAidNotes) onPatch({ meritAidNotes: event.target.value });
              }}
            />
          </label>
        </section>

        <section className="drawer-section">
          <h3>Engagement and contacts</h3>
          {school.contacts.length === 0 ? <p className="muted">No contacts yet.</p> : null}
          {school.contacts.length > 0 ? (
            <table className="child-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {school.contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      <BlurInput
                        value={contact.name}
                        ariaLabel={`Name for ${contact.name || "contact"}`}
                        onCommit={(value) => onPatchContact(contact.id, { name: value })}
                      />
                    </td>
                    <td>
                      <BlurInput
                        value={contact.role}
                        ariaLabel="Contact role"
                        placeholder="Regional rep"
                        onCommit={(value) => onPatchContact(contact.id, { role: value })}
                      />
                    </td>
                    <td>
                      <BlurInput
                        value={contact.email}
                        ariaLabel="Contact email"
                        onCommit={(value) => onPatchContact(contact.id, { email: value })}
                      />
                    </td>
                    <td>
                      <BlurInput
                        value={contact.phone}
                        ariaLabel="Contact phone"
                        onCommit={(value) => onPatchContact(contact.id, { phone: value })}
                      />
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => onDeleteContact(contact.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <form
            className="add-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (!contactName.trim()) return;
              onAddContact({
                name: contactName.trim(),
                role: contactRole.trim(),
                email: contactEmail.trim(),
                phone: contactPhone.trim(),
              });
              setContactName("");
              setContactRole("");
              setContactEmail("");
              setContactPhone("");
            }}
          >
            <input className="field" value={contactName} placeholder="Name" onChange={(event) => setContactName(event.target.value)} />
            <input className="field" value={contactRole} placeholder="Role" onChange={(event) => setContactRole(event.target.value)} />
            <input className="field" value={contactEmail} placeholder="Email" onChange={(event) => setContactEmail(event.target.value)} />
            <input className="field" value={contactPhone} placeholder="Phone" onChange={(event) => setContactPhone(event.target.value)} />
            <button type="submit" className="btn btn-primary">
              Add contact
            </button>
          </form>

          <div className="filters">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={school.visited} onChange={(event) => onPatch({ visited: event.target.checked })} />
              Visited
            </label>
            <label className="stack-field">
              <span className="label">Visit date</span>
              <input
                className="field"
                type="date"
                value={school.visitDate ?? ""}
                onChange={(event) => onPatch({ visitDate: event.target.value || null })}
              />
            </label>
          </div>
          <label className="stack-field">
            <span className="label">Visit notes</span>
            <textarea
              className="field"
              defaultValue={school.visitNotes}
              key={school.visitNotes}
              onBlur={(event) => {
                if (event.target.value !== school.visitNotes) onPatch({ visitNotes: event.target.value });
              }}
            />
          </label>

          <h3 style={{ marginTop: 28 }}>Touchpoints</h3>
          {school.steps.length === 0 ? <p className="muted">No touchpoints yet.</p> : null}
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
              <button type="button" className="btn btn-ghost" onClick={() => onDeleteStep(step.id)}>
                Remove
              </button>
            </div>
          ))}
          <div className="add-row">
            <input
              className="field"
              list="step-presets"
              value={stepLabel}
              placeholder="Add a visit, call, or interview"
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
              className="btn btn-primary"
              onClick={() => {
                if (!stepLabel.trim()) return;
                onAddStep(stepLabel.trim(), stepOwner);
                setStepLabel("");
              }}
            >
              Add
            </button>
          </div>
        </section>

        <section className="drawer-section">
          <h3>Deadlines</h3>
          {deadlines.length === 0 ? <p className="muted">No deadlines yet.</p> : null}
          {deadlines.length > 0 ? (
            <table className="child-table">
              <thead>
                <tr>
                  <th>Done</th>
                  <th>Milestone</th>
                  <th>Due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {deadlines.map((deadline) => (
                  <tr key={deadline.id} className={deadline.completed ? "done" : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={deadline.completed}
                        aria-label={`Completed ${deadline.title}`}
                        onChange={(event) => onPatchDeadline(deadline.id, { completed: event.target.checked })}
                      />
                    </td>
                    <td>
                      <BlurInput
                        value={deadline.title}
                        ariaLabel="Deadline title"
                        onCommit={(value) => onPatchDeadline(deadline.id, { title: value })}
                      />
                    </td>
                    <td>
                      <input
                        className="field"
                        type="date"
                        aria-label="Due date"
                        value={deadline.dueDate ?? ""}
                        onChange={(event) => onPatchDeadline(deadline.id, { dueDate: event.target.value || null })}
                      />
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => onDeleteDeadline(deadline.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <form
            className="add-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (!deadlineTitle.trim()) return;
              onAddDeadline(deadlineTitle.trim(), deadlineDate || null);
              setDeadlineTitle("");
              setDeadlineDate("");
            }}
          >
            <input className="field" value={deadlineTitle} placeholder="Milestone" onChange={(event) => setDeadlineTitle(event.target.value)} />
            <input className="field" type="date" value={deadlineDate} aria-label="New deadline date" onChange={(event) => setDeadlineDate(event.target.value)} />
            <button type="submit" className="btn btn-primary">
              Add deadline
            </button>
          </form>
        </section>

        <section className="drawer-section">
          <h3>Notes for Kyle</h3>
          <textarea
            className="field"
            defaultValue={school.notes}
            key={school.notes}
            onBlur={(event) => {
              if (event.target.value !== school.notes) onPatch({ notes: event.target.value });
            }}
          />
        </section>

        {school.researchSources ? (
          <section className="drawer-section">
            <h3>Where this came from</h3>
            <ul className="source-list">
              {sourceLines(school.researchSources).map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <button
          type="button"
          className="btn btn-ghost no-print"
          style={{ marginTop: 28 }}
          onClick={() => {
            if (window.confirm(`Remove ${school.name} from the list?`)) onDelete();
          }}
        >
          Remove school
        </button>
      </aside>
    </div>
  );
}
