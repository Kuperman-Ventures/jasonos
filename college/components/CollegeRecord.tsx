"use client";

import { useEffect, useRef, useState } from "react";
import {
  ADMISSION_TRACKS,
  APPLICATION_STATUSES,
  INTEREST_LEVELS,
  SELECTIVITY_TIERS,
  type ContactPatch,
  type DeadlinePatch,
  type Owner,
  type School,
} from "@/lib/types";
import { LIST_PHASES, nextListPhaseId, previousListPhaseId } from "@/lib/list-phases";
import { sourceLines } from "@/lib/school-research";
import { fetchSchoolPhotoUrl, websiteHostLabel, websiteHref } from "@/lib/school-photo";
import type { MemberProfile } from "@/lib/member-avatars";
import type { RoutedSchoolNotePayload } from "@/lib/school-project-notes";
import type { PersistedProjectStep } from "@/lib/ingest";
import type { RequirementProgressMap, RequirementStatus } from "@/lib/requirement-progress";
import type { TodoEditMap } from "@/lib/project-todos";
import type { RequirementKey } from "@/lib/school-requirements";
import { SchoolMark } from "./SchoolMark";
import { SchoolSnapshotSummary } from "./SchoolSnapshotSummary";
import { SchoolProjectManagement } from "./SchoolProjectManagement";
import { SchoolRequirements } from "./SchoolRequirements";

type SchoolModalTab = "snapshot" | "settings" | "requirements" | "financials" | "projects";

const SCHOOL_MODAL_TABS: { id: SchoolModalTab; label: string }[] = [
  { id: "snapshot", label: "Snapshot" },
  { id: "requirements", label: "Requirements" },
  { id: "financials", label: "Financials" },
  { id: "projects", label: "Project Management" },
  { id: "settings", label: "Settings" },
];

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
  listUndergrads,
  canAdvancePhase,
  memberId,
  memberName,
  memberProfiles,
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
  onSendProjectNote,
  onRemoveProjectNote,
  requirementProgress,
  projectSteps,
  todoEdits,
  onCycleRequirementStatus,
  onAddRequirementTodo,
}: {
  school: School;
  /** Undergrad counts for non-archived schools on the family's list (size gauge ends). */
  listUndergrads: number[];
  canAdvancePhase: boolean;
  memberId: string;
  memberName: string;
  memberProfiles: MemberProfile[];
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
  onSendProjectNote: (payload: RoutedSchoolNotePayload) => void;
  onRemoveProjectNote: (noteId: string) => void;
  requirementProgress: RequirementProgressMap;
  projectSteps: PersistedProjectStep[];
  todoEdits: TodoEditMap;
  onCycleRequirementStatus: (key: RequirementKey, status: RequirementStatus) => void;
  onAddRequirementTodo: (key: RequirementKey, title: string) => void;
}) {
  const [tab, setTab] = useState<SchoolModalTab>("snapshot");
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
    setTab("snapshot");
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

        <div className="school-modal-tabs" role="tablist" aria-label="School detail sections">
          {SCHOOL_MODAL_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={[
                tab === item.id ? "active" : undefined,
                item.id === "settings" ? "school-modal-tab-settings" : undefined,
              ]
                .filter(Boolean)
                .join(" ") || undefined}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="school-modal-panel" role="tabpanel">
          {tab === "snapshot" ? (
            <SchoolSnapshotSummary
              school={school}
              listUndergrads={listUndergrads}
              nextDeadline={
                nextOpenDeadline?.dueDate
                  ? {
                      id: nextOpenDeadline.id,
                      title: nextOpenDeadline.title,
                      dueDate: nextOpenDeadline.dueDate,
                    }
                  : null
              }
              onPatch={onPatch}
              onChangeDeadlineDate={(iso) => {
                if (nextOpenDeadline) {
                  onPatchDeadline(nextOpenDeadline.id, { dueDate: iso || null });
                  return;
                }
                if (iso) onAddDeadline("Next deadline", iso);
              }}
            />
          ) : null}

          {tab === "settings" ? (
            <section className="school-modal-section">
              <div className="school-overview-head">
                <h3>Settings</h3>
                <p className="section-sub">Adjust list phase, identity, programs, and how this school sits on the list.</p>
              </div>

              <h4 className="school-edit-label">List phase</h4>
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
                    Only the Student can move schools into {nextPhaseLabel}.
                  </p>
                ) : null}
                {school.archived ? (
                  <button type="button" className="btn btn-primary" onClick={onRestore}>
                    Restore to list
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary school-archive-btn"
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

              <h4 className="school-edit-label">School profile</h4>
              <div className="school-edit-grid">
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
                  <span className="label">Website</span>
                  <BlurInput
                    value={school.website}
                    ariaLabel="School website"
                    placeholder="https://"
                    onCommit={(value) => onPatch({ website: value })}
                  />
                </label>
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
                  <span className="label">Application status</span>
                  <select
                    className="field"
                    value={school.applicationStatus}
                    onChange={(event) =>
                      onPatch({ applicationStatus: event.target.value as School["applicationStatus"] })
                    }
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
                  <span className="label">Mechanical Engineering</span>
                  <BlurInput
                    value={school.mechanicalEngineering}
                    ariaLabel="Mechanical Engineering"
                    placeholder="Yes / Partial / No"
                    onCommit={(value) => onPatch({ mechanicalEngineering: value })}
                  />
                </label>
                <label className="stack-field">
                  <span className="label">Material Sciences</span>
                  <BlurInput
                    value={school.materials}
                    ariaLabel="Material Sciences"
                    placeholder="Yes / Partial / No"
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
                  <span className="label">Materials program</span>
                  <BlurInput
                    value={school.materialsProgram}
                    ariaLabel="Materials program"
                    placeholder="Program name"
                    onCommit={(value) => onPatch({ materialsProgram: value })}
                  />
                </label>
                <label className="stack-field">
                  <span className="label">Aerospace Engineering</span>
                  <BlurInput
                    value={school.aerospaceEngineering}
                    ariaLabel="Aerospace Engineering"
                    placeholder="Yes / Partial / No"
                    onCommit={(value) => onPatch({ aerospaceEngineering: value })}
                  />
                </label>
                <label className="stack-field">
                  <span className="label">Aerospace program</span>
                  <BlurInput
                    value={school.aerospaceProgram}
                    ariaLabel="Aerospace program"
                    placeholder="Program name"
                    onCommit={(value) => onPatch({ aerospaceProgram: value })}
                  />
                </label>
                <label className="stack-field">
                  <span className="label">Aerospace notes</span>
                  <BlurInput
                    value={school.aerospaceNotes}
                    ariaLabel="Aerospace notes"
                    placeholder="One sentence"
                    onCommit={(value) => onPatch({ aerospaceNotes: value })}
                  />
                </label>
                <label className="stack-field">
                  <span className="label">Aerospace source</span>
                  <BlurInput
                    value={school.aerospaceSourceUrl}
                    ariaLabel="Aerospace source URL"
                    placeholder="https://"
                    onCommit={(value) => onPatch({ aerospaceSourceUrl: value })}
                  />
                </label>
                <label className="stack-field">
                  <span className="label">Materials source</span>
                  <BlurInput
                    value={school.materialsSourceUrl}
                    ariaLabel="Materials source URL"
                    placeholder="https://"
                    onCommit={(value) => onPatch({ materialsSourceUrl: value })}
                  />
                </label>
              </div>

              <h4 className="school-edit-label">Notes for Kyle</h4>
              <textarea
                className="field"
                defaultValue={school.notes}
                key={school.notes}
                onBlur={(event) => {
                  if (event.target.value !== school.notes) onPatch({ notes: event.target.value });
                }}
              />

              {school.researchSources ? (
                <>
                  <h4 className="school-edit-label">Where this came from</h4>
                  <ul className="source-list">
                    {sourceLines(school.researchSources).map((source) => (
                      <li key={source.url}>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
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
            </section>
          ) : null}

          {tab === "requirements" ? (
            <SchoolRequirements
              school={school}
              memberId={memberId}
              memberName={memberName}
              requirementProgress={requirementProgress}
              projectSteps={projectSteps}
              todoEdits={todoEdits}
              onPatch={onPatch}
              onCycleStatus={onCycleRequirementStatus}
              onAddRequirementTodo={onAddRequirementTodo}
            />
          ) : null}

          {tab === "financials" ? (
            <section className="school-modal-section">
              <div className="school-overview-head">
                <h3>Financials</h3>
                <p className="section-sub">Sticker price, net price, and merit aid notes for this school.</p>
              </div>
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
          ) : null}

          {tab === "projects" ? (
            <SchoolProjectManagement
              school={school}
              memberId={memberId}
              memberName={memberName}
              memberProfiles={memberProfiles}
              onPatch={onPatch}
              onAddStep={onAddStep}
              onPatchStep={onPatchStep}
              onDeleteStep={onDeleteStep}
              onAddDeadline={onAddDeadline}
              onPatchDeadline={onPatchDeadline}
              onDeleteDeadline={onDeleteDeadline}
              onAddContact={onAddContact}
              onPatchContact={onPatchContact}
              onDeleteContact={onDeleteContact}
              onSendNote={onSendProjectNote}
              onRemoveNote={onRemoveProjectNote}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
