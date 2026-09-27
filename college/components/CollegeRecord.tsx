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
import { LIST_PHASES, nextListPhaseId, previousListPhaseId, type ListPhaseId } from "@/lib/list-phases";
import { formatResearchRequest, researchGroupsNeeded } from "@/lib/research";
import { sourceLines } from "@/lib/school-research";
import { fetchSchoolPhotoUrl, websiteHostLabel, websiteHref } from "@/lib/school-photo";
import { shortSchoolName } from "@/lib/visit-planning";
import type { MemberProfile } from "@/lib/member-avatars";
import type { RoutedSchoolNotePayload } from "@/lib/school-project-notes";
import type { PersistedProjectStep } from "@/lib/ingest";
import type { CalendarEvent } from "@/lib/calendar-events";
import type { RequirementProgressMap, RequirementStatus } from "@/lib/requirement-progress";
import type { TodoEditMap } from "@/lib/project-todos";
import type { RequirementKey } from "@/lib/school-requirements";
import { SchoolFinancials } from "./SchoolFinancials";
import type { HouseholdFinances } from "@/lib/finances";
import { SchoolMark } from "./SchoolMark";
import { SchoolSnapshotSummary } from "./SchoolSnapshotSummary";
import { SchoolProjectManagement } from "./SchoolProjectManagement";
import { SchoolRequirements } from "./SchoolRequirements";
import { SchoolPhotos } from "./SchoolPhotos";
import { SchoolTripPlanning } from "./SchoolTripPlanning";

type SchoolModalTab =
  | "snapshot"
  | "settings"
  | "requirements"
  | "financials"
  | "projects"
  | "photos"
  | "visit";

export type { SchoolModalTab };

const SCHOOL_MODAL_TABS: { id: SchoolModalTab; label: string }[] = [
  { id: "snapshot", label: "Snapshot" },
  { id: "requirements", label: "Requirements" },
  { id: "financials", label: "Financials" },
  { id: "projects", label: "Project Management" },
  { id: "photos", label: "Photos" },
  { id: "visit", label: "Trip planning" },
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
  onNavigate,
  previousSchool,
  nextSchool,
  listPosition,
  listTotal,
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
  listSchools,
  listPhaseId,
  processPhaseLabel,
  onSendVisitPlan,
  initialTab = "snapshot",
  householdFinances,
  onHouseholdFinancesChange,
  scholarshipTodoIds = {},
  onAddScholarshipTodo,
  canViewFinancesTab = true,
}: {
  school: School;
  /** Undergrad counts for non-archived schools on the family's list (size gauge ends). */
  listUndergrads: number[];
  canAdvancePhase: boolean;
  memberId: string;
  memberName: string;
  memberProfiles: MemberProfile[];
  onBack: () => void;
  /** Step to another school in the current list without closing the modal. */
  onNavigate?: (id: string) => void;
  previousSchool?: School | null;
  nextSchool?: School | null;
  /** 1-based index in the browsable list, or null when the school is not in that list. */
  listPosition?: number | null;
  listTotal?: number;
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
  listSchools: School[];
  listPhaseId: ListPhaseId;
  processPhaseLabel: string | null;
  onSendVisitPlan: (payload: {
    events: CalendarEvent[];
    todos: PersistedProjectStep[];
  }) => void;
  initialTab?: SchoolModalTab;
  householdFinances?: HouseholdFinances;
  onHouseholdFinancesChange?: (next: HouseholdFinances) => void;
  scholarshipTodoIds?: Record<string, string>;
  onAddScholarshipTodo?: (scholarshipKey: string, title: string) => void;
  canViewFinancesTab?: boolean;
}) {
  const [tab, setTab] = useState<SchoolModalTab>(initialTab);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [researchCopied, setResearchCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const onBackRef = useRef(onBack);
  const onNavigateRef = useRef(onNavigate);
  const previousIdRef = useRef(previousSchool?.id ?? null);
  const nextIdRef = useRef(nextSchool?.id ?? null);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);
  useEffect(() => {
    previousIdRef.current = previousSchool?.id ?? null;
    nextIdRef.current = nextSchool?.id ?? null;
  }, [previousSchool?.id, nextSchool?.id]);

  useEffect(() => {
    modalRef.current?.scrollTo({ top: 0 });
  }, [school.id]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return target.isContentEditable;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onBackRef.current();
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === "ArrowLeft" && previousIdRef.current) {
        event.preventDefault();
        onNavigateRef.current?.(previousIdRef.current);
      } else if (event.key === "ArrowRight" && nextIdRef.current) {
        event.preventDefault();
        onNavigateRef.current?.(nextIdRef.current);
      }
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

  useEffect(() => {
    setTab(initialTab === "financials" && !canViewFinancesTab ? "snapshot" : initialTab);
  }, [initialTab, canViewFinancesTab]);

  useEffect(() => {
    if (tab === "financials" && !canViewFinancesTab) setTab("snapshot");
  }, [tab, canViewFinancesTab]);

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
  const stageBreadcrumb = school.archived
    ? "Archived"
    : school.phasesParticipated.length > 1
      ? `${phaseLabel} · ${participated}`
      : phaseLabel;

  const siteHref = websiteHref(school.website);
  const siteLabel = websiteHostLabel(school.website) || "School website";
  const showPhoto = Boolean(photoUrl) && !photoFailed;
  const nextOpenDeadline = deadlines.find((item) => !item.completed && item.dueDate) ?? null;
  const researchNeeded = researchGroupsNeeded(school);

  async function copyResearchRequest() {
    const text = formatResearchRequest(school);
    try {
      await navigator.clipboard.writeText(text);
      setResearchCopied(true);
      window.setTimeout(() => setResearchCopied(false), 2000);
    } catch {
      setResearchCopied(false);
    }
  }

  return (
    <div className="school-modal-root">
      <button type="button" className="school-modal-backdrop" aria-label="Close school" onClick={onBack} />
      <div
        ref={modalRef}
        className="school-modal"
        role="dialog"
        aria-modal="true"
        aria-label={school.name}
      >
        <header className="school-modal-chrome">
          <div className="school-modal-chrome-row">
            <button type="button" className="back-link" onClick={onBack}>
              Close
            </button>
            {listTotal && listTotal > 0 ? (
              <nav className="school-modal-nav" aria-label="Schools on your list">
                <button
                  type="button"
                  className="school-modal-nav-btn school-modal-nav-prev"
                  disabled={!previousSchool || !onNavigate}
                  aria-label={
                    previousSchool
                      ? `Previous school: ${shortSchoolName(previousSchool.name)}`
                      : "No previous school"
                  }
                  onClick={() => previousSchool && onNavigate?.(previousSchool.id)}
                >
                  <span className="school-modal-nav-caret" aria-hidden="true">
                    ‹
                  </span>
                  {previousSchool ? shortSchoolName(previousSchool.name) : "Previous"}
                </button>
                <div className="school-modal-nav-current" aria-current="page">
                  <span className="school-modal-nav-mark">
                    <SchoolMark name={school.name} website={school.website} />
                  </span>
                  <span className="school-modal-nav-name">{school.name}</span>
                  <span className="school-modal-nav-pos" aria-live="polite">
                    {listPosition != null && listPosition > 0
                      ? `${listPosition} of ${listTotal}`
                      : `— of ${listTotal}`}
                  </span>
                </div>
                <button
                  type="button"
                  className="school-modal-nav-btn school-modal-nav-next"
                  disabled={!nextSchool || !onNavigate}
                  aria-label={
                    nextSchool
                      ? `Next school: ${shortSchoolName(nextSchool.name)}`
                      : "No next school"
                  }
                  onClick={() => nextSchool && onNavigate?.(nextSchool.id)}
                >
                  {nextSchool ? shortSchoolName(nextSchool.name) : "Next"}
                  <span className="school-modal-nav-caret" aria-hidden="true">
                    ›
                  </span>
                </button>
              </nav>
            ) : (
              <span className="school-modal-nav-spacer" aria-hidden="true" />
            )}
            <span className="school-modal-chrome-end" aria-hidden="true" />
          </div>
          <p className="school-modal-phase">{stageBreadcrumb}</p>
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
                {researchNeeded.length ? (
                  <p className="needs-research school-hero-research">
                    {researchNeeded.map((group) => (
                      <small key={group} className="needs-research-tag">
                        Needs {group}
                      </small>
                    ))}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="school-hero-actions">
              {siteHref ? (
                <a className="school-hero-link" href={siteHref} target="_blank" rel="noreferrer">
                  Visit {siteLabel}
                </a>
              ) : (
                <span className="school-hero-link school-hero-link-missing">No website on file</span>
              )}
              {school.unitId != null && researchNeeded.length ? (
                <button
                  type="button"
                  className="btn btn-secondary school-research-btn"
                  onClick={() => void copyResearchRequest()}
                >
                  {researchCopied ? "Copied" : "Research this school"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="school-modal-tabs" role="tablist" aria-label="School detail sections">
          {SCHOOL_MODAL_TABS.filter((item) => item.id !== "financials" || canViewFinancesTab).map(
            (item) => (
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
          ),
          )}
        </div>

        <div className="school-modal-panel" role="tabpanel">
          {tab === "snapshot" ? (
            <SchoolSnapshotSummary
              school={school}
              listUndergrads={listUndergrads}
              listSchools={listSchools}
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
                  <span className="label">Campus setting</span>
                  <select
                    className="field"
                    aria-label="Campus setting"
                    value={school.campusSetting}
                    onChange={(event) => onPatch({ campusSetting: event.target.value })}
                  >
                    <option value="">Not set</option>
                    <option value="Urban">Urban</option>
                    <option value="Suburban">Suburban</option>
                    <option value="Small city">Small city</option>
                    <option value="College town">College town</option>
                    <option value="Small town">Small town</option>
                  </select>
                </label>
                <label className="stack-field">
                  <span className="label">Metro area</span>
                  <BlurInput
                    value={school.metroArea ?? ""}
                    ariaLabel="Metro area"
                    placeholder="Census metro name"
                    onCommit={(value) =>
                      onPatch({ metroArea: value.trim() ? value.trim() : null })
                    }
                  />
                </label>
                <label className="stack-field">
                  <span className="label">Metro population</span>
                  <BlurInput
                    value={
                      school.metroPopulation == null ? "" : String(school.metroPopulation)
                    }
                    ariaLabel="Metro population"
                    placeholder="Whole number"
                    onCommit={(value) => {
                      const trimmed = value.trim();
                      if (!trimmed) {
                        onPatch({ metroPopulation: null });
                        return;
                      }
                      const n = Number(trimmed.replace(/,/g, ""));
                      if (Number.isFinite(n) && n >= 0) {
                        onPatch({ metroPopulation: Math.round(n) });
                      }
                    }}
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
            householdFinances && onHouseholdFinancesChange && onAddScholarshipTodo ? (
              <SchoolFinancials
                school={school}
                listSchools={listSchools}
                household={householdFinances}
                onHouseholdChange={onHouseholdFinancesChange}
                scholarshipTodoIds={scholarshipTodoIds}
                onAddScholarshipTodo={onAddScholarshipTodo}
              />
            ) : (
              <section className="school-modal-section">
                <div className="school-overview-head">
                  <h3>Financials</h3>
                  <p className="section-sub">Finance details are available on the Finances page.</p>
                </div>
              </section>
            )
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

          {tab === "photos" ? (
            <SchoolPhotos school={school} memberProfiles={memberProfiles} />
          ) : null}

          {tab === "visit" ? (
            <SchoolTripPlanning
              school={school}
              listSchools={listSchools}
              memberId={memberId}
              onSendVisitPlan={onSendVisitPlan}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
