"use client";

import { useEffect, useRef, useState } from "react";
import {
  ADMISSION_TRACKS,
  APPLICATION_STATUSES,
  INTEREST_LEVELS,
  OWNERS,
  SELECTIVITY_TIERS,
  STEP_PRESETS,
  formatDate,
  ownerLabel,
  statusLabel,
  tierLabel,
  trackLabel,
  type ContactPatch,
  type DeadlinePatch,
  type Owner,
  type School,
} from "@/lib/types";
import { LIST_PHASES, nextListPhaseId, previousListPhaseId } from "@/lib/list-phases";
import { sourceLines } from "@/lib/school-research";
import { fetchSchoolPhotoUrl, websiteHostLabel, websiteHref } from "@/lib/school-photo";
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

function Fact({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: "accent" | "mono" | "default";
}) {
  const trimmed = value.trim();
  const yes = /^yes$/i.test(trimmed);
  const no = /^no$/i.test(trimmed);
  const empty = !trimmed;
  const tone = emphasize ?? (looksLikeDatum(trimmed) ? "mono" : "default");

  return (
    <div className={`fact${yes ? " fact-yes" : ""}${no ? " fact-no" : ""}${empty ? " fact-empty" : ""}`}>
      <div className="label">{label}</div>
      {yes ? (
        <p className="fact-value fact-check" aria-label="Yes">
          <span className="fact-check-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="22" height="22" fill="none">
              <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M5.8 10.2 8.6 13l5.6-6.2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </p>
      ) : no ? (
        <p className="fact-value fact-cross" aria-label="No">
          <span className="fact-cross-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none">
              <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
        </p>
      ) : (
        <p className={`fact-value fact-tone-${tone}`}>{empty ? "—" : trimmed}</p>
      )}
    </div>
  );
}

function looksLikeDatum(value: string): boolean {
  if (!value) return false;
  return /[$€£]|^\d|%|\b\d{3,4}\b/.test(value);
}

export function CollegeRecord({
  school,
  canAdvancePhase,
  onBack,
  onPatch,
  onDelete,
  onAdvance,
  onRetreat,
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
  canAdvancePhase: boolean;
  onBack: () => void;
  onPatch: (patch: Partial<School>) => void;
  onDelete: () => void;
  onAdvance: () => void;
  onRetreat: () => void;
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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setPhotoUrl(null);
    setPhotoFailed(false);
    void fetchSchoolPhotoUrl(school.id, school.name).then((url) => {
      if (!cancelled) setPhotoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [school.id, school.name]);

  const deadlines = [...school.deadlines].sort((a, b) => {
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return a.sortOrder - b.sortOrder;
  });

  const phaseLabel =
    LIST_PHASES.find((phase) => phase.id === school.listPhase)?.label ?? school.listPhase;
  const nextPhase = nextListPhaseId(school.listPhase);
  const nextPhaseLabel = nextPhase
    ? LIST_PHASES.find((phase) => phase.id === nextPhase)?.label
    : null;
  const previousPhase = previousListPhaseId(school.listPhase);
  const previousPhaseLabel = previousPhase
    ? LIST_PHASES.find((phase) => phase.id === previousPhase)?.label
    : null;
  const participated = school.phasesParticipated
    .map((id) => LIST_PHASES.find((phase) => phase.id === id)?.label ?? id)
    .join(" → ");

  const siteHref = websiteHref(school.website);
  const siteLabel = websiteHostLabel(school.website) || "School website";
  const showPhoto = Boolean(photoUrl) && !photoFailed;

  const nextOpenDeadline = deadlines.find((item) => !item.completed && item.dueDate) ?? null;

  const overviewFacts: { label: string; value: string; emphasize?: "accent" | "mono" | "default" }[] = [
    { label: "Location", value: school.location },
    { label: "Campus / size", value: school.campusSize },
    {
      label: "Selectivity",
      value: tierLabel(school.selectivityTier) || school.selectivity,
      emphasize: "accent",
    },
    { label: "Test policy", value: school.testPolicy },
    { label: "Middle 50%", value: school.middle50, emphasize: "mono" },
    { label: "Mechanical Engineering", value: school.mechanicalEngineering },
    { label: "Material Sciences", value: school.materials },
    { label: "Material sciences offering", value: school.materialsOffering },
    { label: "Application platform", value: school.applicationPlatform },
    { label: "Teacher recommendations", value: school.teacherRecs, emphasize: "mono" },
    { label: "Sticker price", value: school.costOfAttendance, emphasize: "mono" },
    { label: "Net price estimate", value: school.netPriceEstimate, emphasize: "mono" },
  ];

  return (
    <div className="school-modal-root">
      <button type="button" className="school-modal-backdrop" aria-label="Close school" onClick={onBack} />
      <div className="school-modal" role="dialog" aria-modal="true" aria-label={school.name}>
        <header className="school-modal-chrome">
          <button type="button" className="back-link" onClick={onBack}>
            Close
          </button>
          <span className="school-modal-phase">
            {school.archived ? "Archived" : phaseLabel}
            {school.phasesParticipated.length > 1 ? ` · ${participated}` : ""}
          </span>
        </header>

        <div className={`school-hero${showPhoto ? "" : " school-hero-empty"}`}>
          {showPhoto ? (
            <img
              className="school-hero-photo"
              src={photoUrl!}
              alt=""
              onError={() => setPhotoFailed(true)}
            />
          ) : null}
          <div className="school-hero-scrim" aria-hidden="true" />
          <div className="school-hero-copy">
            <div className="school-hero-identity">
              <SchoolMark name={school.name} website={school.website} />
              <div>
                <h2>{school.name}</h2>
                <p className="school-hero-location">{school.location || "Location not set"}</p>
              </div>
            </div>
            {siteHref ? (
              <a className="school-hero-link" href={siteHref} target="_blank" rel="noreferrer">
                Visit {siteLabel}
              </a>
            ) : (
              <span className="school-hero-link school-hero-link-missing">No website on file</span>
            )}
          </div>
        </div>

        <section className="school-overview">
          <div className="school-overview-head">
            <h3>At a glance</h3>
            <p className="section-sub">
              Snapshot facts for this school. Editing lives further down so this view stays readable.
            </p>
          </div>
          <div className="fact-grid school-overview-facts">
            {overviewFacts.map((fact) => (
              <Fact key={fact.label} label={fact.label} value={fact.value} emphasize={fact.emphasize} />
            ))}
          </div>
          {school.admissionsContext || school.satContext || school.requiredEssays || school.meritAidNotes ? (
            <div className="school-overview-prose">
              {school.admissionsContext ? (
                <div className="fact fact-wide">
                  <div className="label">Admissions context</div>
                  <p>{school.admissionsContext}</p>
                </div>
              ) : null}
              {school.satContext ? (
                <div className="fact fact-wide">
                  <div className="label">SAT context</div>
                  <p>{school.satContext}</p>
                </div>
              ) : null}
              {school.requiredEssays ? (
                <div className="fact fact-wide">
                  <div className="label">Required essays</div>
                  <p>{school.requiredEssays}</p>
                </div>
              ) : null}
              {school.meritAidNotes ? (
                <div className="fact fact-wide">
                  <div className="label">Merit aid</div>
                  <p>{school.meritAidNotes}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="school-overview-status">
            <Fact
              label="Interest"
              value={INTEREST_LEVELS.find((item) => item.id === school.interestLevel)?.label ?? ""}
              emphasize="accent"
            />
            <Fact label="Application status" value={statusLabel(school.applicationStatus)} emphasize="accent" />
            <Fact label="Admission track" value={trackLabel(school.admissionTrack)} />
            <Fact
              label="Next deadline"
              value={
                nextOpenDeadline
                  ? `${nextOpenDeadline.title} · ${formatDate(nextOpenDeadline.dueDate)}`
                  : ""
              }
              emphasize="mono"
            />
          </div>
        </section>

        <section className="school-modal-section school-edit-block">
          <h3>List phase</h3>
          <p className="section-sub">
            {school.archived ? "Archived" : phaseLabel}
            {participated ? ` · been in: ${participated}` : ""}
          </p>
          <div className="phase-actions">
            {!school.archived && previousPhaseLabel ? (
              <button type="button" className="btn btn-secondary" onClick={onRetreat}>
                Move back to {previousPhaseLabel}
              </button>
            ) : null}
            {!school.archived && nextPhaseLabel && canAdvancePhase ? (
              <button type="button" className="btn btn-primary" onClick={onAdvance}>
                Move to {nextPhaseLabel}
              </button>
            ) : null}
            {!school.archived && nextPhaseLabel && !canAdvancePhase ? (
              <p className="section-sub phase-advance-lock">
                Only Kyle can move schools into {nextPhaseLabel}.
              </p>
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

        <section className="school-modal-section school-edit-block">
          <div className="school-overview-head">
            <h3>Update record</h3>
            <p className="section-sub">Change fields here. The snapshot above updates after you save.</p>
          </div>
          <h4 className="school-edit-label">Admissions and academics</h4>
          <div className="school-edit-grid">
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
            <label className="stack-field">
              <span className="label">Location</span>
              <BlurInput
                value={school.location}
                ariaLabel="Location"
                placeholder="Not entered"
                onCommit={(value) => onPatch({ location: value })}
              />
            </label>
            <label className="stack-field">
              <span className="label">Campus / size</span>
              <BlurInput
                value={school.campusSize}
                ariaLabel="Campus size"
                placeholder="Not entered"
                onCommit={(value) => onPatch({ campusSize: value })}
              />
            </label>
            <label className="stack-field">
              <span className="label">Mechanical Engineering</span>
              <BlurInput
                value={school.mechanicalEngineering}
                ariaLabel="Mechanical Engineering"
                placeholder="Yes / No"
                onCommit={(value) => onPatch({ mechanicalEngineering: value })}
              />
            </label>
            <label className="stack-field">
              <span className="label">Material Sciences</span>
              <BlurInput
                value={school.materials}
                ariaLabel="Material Sciences"
                placeholder="Yes / No"
                onCommit={(value) => onPatch({ materials: value })}
              />
            </label>
            <label className="stack-field">
              <span className="label">Material sciences offering</span>
              <BlurInput
                value={school.materialsOffering}
                ariaLabel="Material sciences offering"
                placeholder="Not entered"
                onCommit={(value) => onPatch({ materialsOffering: value })}
              />
            </label>
            <label className="stack-field">
              <span className="label">Website</span>
              <BlurInput
                value={school.website}
                ariaLabel="School website"
                placeholder="https://"
                onCommit={(value) => onPatch({ website: value })}
              />
            </label>
          </div>
          <label className="stack-field school-edit-full">
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
          <label className="stack-field school-edit-full">
            <span className="label">Admissions context</span>
            <textarea
              className="field"
              defaultValue={school.admissionsContext}
              key={school.admissionsContext}
              placeholder="Not entered"
              onBlur={(event) => {
                if (event.target.value !== school.admissionsContext) {
                  onPatch({ admissionsContext: event.target.value });
                }
              }}
            />
          </label>
          <label className="stack-field school-edit-full">
            <span className="label">SAT context</span>
            <textarea
              className="field"
              defaultValue={school.satContext}
              key={school.satContext}
              placeholder="Not entered"
              onBlur={(event) => {
                if (event.target.value !== school.satContext) onPatch({ satContext: event.target.value });
              }}
            />
          </label>

          <h4 className="school-edit-label">Financials</h4>
          <div className="school-edit-grid">
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
          <label className="stack-field school-edit-full">
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

        <section className="school-modal-section school-edit-block">
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

          <h4 className="school-edit-label">Touchpoints</h4>
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

        <section className="school-modal-section school-edit-block">
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

        <section className="school-modal-section school-edit-block">
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
          <section className="school-modal-section">
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
      </div>
    </div>
  );
}
