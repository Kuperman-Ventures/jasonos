"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  type AdmissionTrack,
  type ApplicationStatus,
  type InterestLevel,
  type School,
  ADMISSION_TRACKS,
  INTEREST_LEVELS,
  SNAPSHOT_APPLICATION_STATUSES,
  SNAPSHOT_PROGRAMS,
  TEST_POLICY_OPTIONS,
  programOfferStatus,
  programsOfferedHeadline,
  statusLabel,
  tierLabel,
  pathwayFromContext,
  type ProgramOfferStatus,
} from "@/lib/types";
import {
  formatUndergrads,
  formatUndergradsRounded,
  sizeGaugeModel,
  tierHeadlineVar,
} from "@/lib/campus-size";
import { admitResidencyDisplay } from "@/lib/residency-admit";
import { websiteHref, websiteHostLabel } from "@/lib/school-photo";
import {
  formatDriveDuration,
  formatTravelLabel,
  nearestSchoolsFrom,
} from "@/lib/drive-matrix";
import { CampusSettingBadge } from "./CampusSettingBadge";
import { SchoolLocationMap, SelectivityGauge } from "./SchoolSnapshotViz";
import { SchoolScoirStudentBody } from "./SchoolScoirStudentBody";
import { formatScoirPct, scoirRecordForSchool } from "@/lib/scoir";
import type { AdditionalProgram } from "@/lib/additional-programs";
import { UsersThree } from "@phosphor-icons/react";

const SchoolCampusSatelliteMap = dynamic(
  () => import("./SchoolCampusSatelliteMap").then((mod) => mod.SchoolCampusSatelliteMap),
  {
    ssr: false,
    loading: () => <section className="snapshot-satellite" aria-hidden="true" />,
  },
);

type SnapshotPatch = Partial<
  Pick<
    School,
    | "interestLevel"
    | "applicationStatus"
    | "admissionTrack"
    | "testPolicy"
    | "familyTestPolicy"
    | "additionalPrograms"
    | "programOptions"
    | "programOptionsCheckedDate"
  >
>;

function formatProgramCheckedDate(iso: string): string {
  const trimmed = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "";
  const date = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PlainFact({ label, value, href }: { label: string; value: string; href?: string }) {
  const empty = !value.trim() || value === "Not set";
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>
        {href && !empty ? (
          <a href={href} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          value || "Not set"
        )}
      </dd>
    </div>
  );
}

function SetSelect({
  label,
  note,
  value,
  options,
  onChange,
}: {
  label: string;
  note?: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (next: string) => void;
}) {
  const unset = !value;
  return (
    <div className="fact">
      <dt>
        {label}
        {note ? <small>{note}</small> : null}
      </dt>
      <dd>
        <span className={`set${unset ? " unset" : ""}`}>
          <select
            aria-label={label}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">{unset ? "Set" : "Clear"}</option>
            {options
              .filter((item) => item.id !== "")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
          </select>
        </span>
      </dd>
    </div>
  );
}

function SetDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const unset = !value;
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>
        <span className={`set date${unset ? " unset" : ""}`}>
          <input
            type="date"
            aria-label={label}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </span>
      </dd>
    </div>
  );
}

function SizeGauge({
  undergrads,
  listUndergrads,
}: {
  undergrads: number;
  listUndergrads: number[];
}) {
  const model = sizeGaugeModel(undergrads, listUndergrads);
  if (!model) return null;
  return (
    <div className="size-gauge" role="img" aria-label={model.ariaLabel}>
      <div className="size-gauge-val">
        <span style={{ left: `${model.pct}%`, transform: `translateX(${model.labelShift})` }}>
          {formatUndergrads(undergrads)}
        </span>
      </div>
      <div className="size-gauge-bar">
        {model.bands.map((band) => (
          <b key={band.name} className={band.on ? "on" : undefined} style={{ width: `${band.widthPct}%` }} />
        ))}
        <em style={{ left: `${model.pct}%` }} />
      </div>
      <div className="size-gauge-cats" aria-hidden="true">
        {model.bands.map((band) => (
          <span
            key={band.name}
            className={band.on ? "is-current" : undefined}
            style={{ width: `${band.widthPct}%` }}
          >
            {band.name}
          </span>
        ))}
      </div>
      <div className="size-gauge-ends">
        <span>{formatUndergrads(model.lo)}</span>
        <span>{formatUndergrads(model.hi)}</span>
      </div>
    </div>
  );
}

export function SchoolSnapshotSummary({
  school,
  listUndergrads,
  listSchools,
  nextDeadline,
  onPatch,
  onChangeDeadlineDate,
}: {
  school: School;
  /** Undergrad counts for every school on the family's current (non-archived) list. */
  listUndergrads: number[];
  /** Live list schools (for nearest-drive neighbors). */
  listSchools: School[];
  nextDeadline: { id: string; title: string; dueDate: string } | null;
  onPatch: (patch: SnapshotPatch) => void;
  onChangeDeadlineDate: (iso: string) => void;
}) {
  const [addingProgram, setAddingProgram] = useState(false);
  const [programName, setProgramName] = useState("");
  const [programUrl, setProgramUrl] = useState("");
  const [programError, setProgramError] = useState("");
  const [checkedOptionIds, setCheckedOptionIds] = useState<string[]>([]);
  const [lookingUpPrograms, setLookingUpPrograms] = useState(false);

  const tierName = tierLabel(school.selectivityTier);
  const tierHead = tierName || "Tier not set";
  const tierColor = `var(${tierHeadlineVar(school.selectivityTier)})`;
  const statusHead = school.applicationStatus
    ? statusLabel(school.applicationStatus)
    : "Not started";
  const pathway = pathwayFromContext(school.admissionsContext);
  const siteHref = websiteHref(school.website);
  const siteLabel = websiteHostLabel(school.website);
  const nearest = nearestSchoolsFrom(
    school.id,
    listSchools.filter((row) => !row.archived).map((row) => ({ id: row.id, name: row.name })),
  );
  const travelLabel = formatTravelLabel(
    school.driveMinutes,
    school.driveMiles,
    school.travelMode,
  );

  const recordTestPolicy = school.testPolicy.trim();
  const testPolicyValue = recordTestPolicy || school.familyTestPolicy.trim();
  const testPolicyMissing = !recordTestPolicy;
  const fall2028NotAnnounced =
    school.testPolicyFall2028Status.trim() === "Not yet announced for Fall 2028";

  const undergrads = school.undergradEnrollment;
  const gauge =
    undergrads != null && Number.isFinite(undergrads)
      ? sizeGaugeModel(undergrads, listUndergrads)
      : null;
  const setting = school.campusSetting.trim();

  const offeredMap: Record<string, ProgramOfferStatus> = {};
  for (const program of SNAPSHOT_PROGRAMS) {
    offeredMap[program.label] = programOfferStatus(school[program.offeredField]);
  }
  const coreLabels = SNAPSHOT_PROGRAMS.map((row) => row.label);
  const additionalPrograms = school.additionalPrograms;
  const programOptions = [...school.programOptions].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  const optionsSource = programOptions[0]?.source ?? null;
  const checkedDateLabel = formatProgramCheckedDate(school.programOptionsCheckedDate);

  function openAddProgram() {
    setCheckedOptionIds(
      additionalPrograms
        .filter((row) => programOptions.some((option) => option.id === row.id))
        .map((row) => row.id),
    );
    setProgramName("");
    setProgramUrl("");
    setProgramError("");
    setAddingProgram(true);
  }

  function closeAddProgram() {
    setAddingProgram(false);
    setProgramName("");
    setProgramUrl("");
    setProgramError("");
    setCheckedOptionIds([]);
    setLookingUpPrograms(false);
  }

  function toggleOption(optionId: string) {
    setCheckedOptionIds((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    );
  }

  async function lookupPrograms() {
    setLookingUpPrograms(true);
    setProgramError("");
    try {
      const response = await fetch(`/api/schools/${school.id}/program-options`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as {
        school?: School;
        error?: string;
      };
      if (!response.ok || !body.school) {
        setProgramError(body.error || "Could not look up programs.");
        return;
      }
      onPatch({
        programOptions: body.school.programOptions,
        programOptionsCheckedDate: body.school.programOptionsCheckedDate,
        additionalPrograms: body.school.additionalPrograms,
      });
      setCheckedOptionIds(
        body.school.additionalPrograms
          .filter((row) =>
            body.school!.programOptions.some((option) => option.id === row.id),
          )
          .map((row) => row.id),
      );
    } catch {
      setProgramError("Could not look up programs.");
    } finally {
      setLookingUpPrograms(false);
    }
  }

  function saveAdditionalProgram() {
    const name = programName.trim();
    const sourceUrl = programUrl.trim();
    if (name) {
      const lowered = name.toLowerCase();
      if (coreLabels.some((label) => label.toLowerCase() === lowered)) {
        setProgramError("That’s one of the three core programs already listed.");
        return;
      }
      if (
        additionalPrograms.some((row) => row.name.toLowerCase() === lowered) ||
        programOptions.some((row) => row.name.toLowerCase() === lowered)
      ) {
        setProgramError("That program is already on this school.");
        return;
      }
    }

    const checkedOptions: AdditionalProgram[] = programOptions
      .filter((option) => checkedOptionIds.includes(option.id))
      .map((option) => ({
        id: option.id,
        name: option.name,
        sourceUrl: option.sourceUrl,
        category: option.category,
        source: option.source,
      }));
    const manuals = additionalPrograms.filter((row) => row.source === "manual");
    const next: AdditionalProgram[] = [...checkedOptions, ...manuals];
    if (name) {
      next.push({
        id: crypto.randomUUID(),
        name,
        sourceUrl,
        category: "",
        source: "manual",
      });
    }
    onPatch({ additionalPrograms: next });
    closeAddProgram();
  }

  const missingBits: string[] = [];
  if (!school.middle50.trim()) missingBits.push("Middle 50%");
  if (!school.applicationPlatform.trim()) missingBits.push("application platform");
  if (!school.teacherRecs.trim()) missingBits.push("teacher recommendations");

  const residency = admitResidencyDisplay(school);
  const scoir = scoirRecordForSchool(school);
  const engineeringShare =
    scoir?.engineeringShareOfDegreesPct != null
      ? formatScoirPct(scoir.engineeringShareOfDegreesPct)
      : null;

  return (
    <div className="snapshot">
      <div className="intro">
        <h1>School snapshot</h1>
        <p className="lede">Key facts at a glance.</p>
      </div>

      <div className="areas">
        <section className="area" aria-labelledby="snap-loc-h">
          <span className="area-label" id="snap-loc-h">
            Location
          </span>
          <SchoolLocationMap location={school.location} />
          <span>{school.location.trim() || "Add a city and state in Settings"}</span>
          {travelLabel !== "—" ? (
            <span className="snapshot-drive">
              Drive from home: {travelLabel}
            </span>
          ) : null}
          {nearest.length ? (
            <div className="snapshot-nearest">
              <span className="snapshot-nearest-label">Nearest schools on the list</span>
              <ul>
                {nearest.map((hit) => (
                  <li key={hit.schoolId}>
                    {hit.name} · {formatDriveDuration(hit.minutes)} ({hit.miles} mi)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="area" aria-labelledby="snap-sel-h">
          <span className="area-label" id="snap-sel-h">
            Selectivity
          </span>
          <SelectivityGauge tier={school.selectivityTier} />
        </section>

        <section className="area" aria-labelledby="snap-adm-h">
          <span className="area-label" id="snap-adm-h">
            Admissions
          </span>
          <span className="area-head" style={{ color: tierColor }}>
            {tierHead}
          </span>
          <dl className="facts">
            {testPolicyMissing ? (
              <SetSelect
                label="Test policy"
                note="Missing from record"
                value={school.familyTestPolicy}
                options={[
                  { id: "", label: "Set" },
                  ...TEST_POLICY_OPTIONS.map((value) => ({ id: value, label: value })),
                ]}
                onChange={(next) => onPatch({ familyTestPolicy: next })}
              />
            ) : (
              <div className="fact">
                <dt>Test policy</dt>
                <dd>
                  {testPolicyValue}
                  {fall2028NotAnnounced ? (
                    <span className="test-policy-fall2028-badge">Fall 2028 not announced</span>
                  ) : null}
                </dd>
              </div>
            )}
            {recordTestPolicy ? (
              <>
                {school.testPolicyDetail.trim() ? (
                  <PlainFact label="Detail" value={school.testPolicyDetail.trim()} />
                ) : null}
                {school.testPolicyTerm.trim() ? (
                  <PlainFact label="Term covered" value={school.testPolicyTerm.trim()} />
                ) : null}
                {school.testPolicyChange?.trim() ? (
                  <PlainFact label="Recent change" value={school.testPolicyChange.trim()} />
                ) : null}
                {school.testPolicySourceUrl.trim() ? (
                  <PlainFact
                    label="Source"
                    value="Official policy page"
                    href={school.testPolicySourceUrl.trim()}
                  />
                ) : null}
                {school.testPolicyCheckedDate.trim() ? (
                  <PlainFact
                    label="Checked"
                    value={school.testPolicyCheckedDate.trim()}
                  />
                ) : null}
              </>
            ) : null}
            <PlainFact label="SAT" value={school.satContext.trim() || "Not set"} />
            <PlainFact
              label="Pathway"
              value={(pathway || school.admissionsContext).trim() || "Not set"}
            />
            {residency.kind === "private" ? (
              <PlainFact label="Residency" value="Residency does not affect admission" />
            ) : null}
            {residency.kind === "public" ? (
              <>
                <div className="fact">
                  <dt>Overall admit rate</dt>
                  <dd>
                    {residency.overall || "Not set"}
                    {residency.year ? <span className="admit-year">{residency.year}</span> : null}
                    {residency.showStatusBadge ? (
                      <span className="admit-status-badge">{residency.status}</span>
                    ) : null}
                  </dd>
                </div>
                <div className="fact">
                  <dt>{residency.kyleLabel || "Kyle's rate"}</dt>
                  <dd>
                    {residency.kyleRate || "Not published"}
                    {residency.showStatusBadge && !residency.overall ? (
                      <span className="admit-status-badge">{residency.status}</span>
                    ) : null}
                  </dd>
                </div>
                {residency.engineeringNote ? (
                  <PlainFact label="Engineering note" value={residency.engineeringNote} />
                ) : null}
                {residency.policy ? (
                  <PlainFact label="Out-of-state policy" value={residency.policy} />
                ) : null}
              </>
            ) : null}
          </dl>
        </section>

        <section className="area" aria-labelledby="snap-stand-h">
          <span className="area-label" id="snap-stand-h">
            Project Management
          </span>
          <span className="area-head is-status">{statusHead}</span>
          <dl className="facts">
            <SetSelect
              label="Interest"
              value={school.interestLevel}
              options={INTEREST_LEVELS}
              onChange={(next) => onPatch({ interestLevel: next as InterestLevel })}
            />
            <SetSelect
              label="Application status"
              value={school.applicationStatus}
              options={SNAPSHOT_APPLICATION_STATUSES}
              onChange={(next) => onPatch({ applicationStatus: next as ApplicationStatus })}
            />
            <SetSelect
              label="Admission track"
              value={school.admissionTrack}
              options={ADMISSION_TRACKS}
              onChange={(next) => onPatch({ admissionTrack: next as AdmissionTrack })}
            />
            <SetDate
              label="Next deadline"
              value={nextDeadline?.dueDate ?? ""}
              onChange={onChangeDeadlineDate}
            />
          </dl>
        </section>

        <section className="area" aria-labelledby="snap-prog-h">
          <span className="area-label" id="snap-prog-h">
            Programs
          </span>
          <span className="area-head">{programsOfferedHeadline(coreLabels, offeredMap)}</span>
          <dl className="facts">
            {SNAPSHOT_PROGRAMS.map((program) => {
              const label = program.label;
              const status = offeredMap[label];
              const programMeta =
                label === "Aerospace engineering"
                  ? school.aerospaceProgram.trim() || school.aerospaceNotes.trim()
                  : label === "Material sciences"
                    ? school.materialsProgram.trim() || school.materialsOffering.trim()
                    : "";
              const offerClass =
                status === "yes"
                  ? "offer"
                  : status === "partial"
                    ? "offer partial"
                    : status === "no"
                      ? "offer no"
                      : "offer unknown";
              const offerLabel =
                status === "yes"
                  ? "Offered"
                  : status === "partial"
                    ? "Partial"
                    : status === "no"
                      ? "Not offered"
                      : "Not checked";
              const offerIcon =
                status === "yes" ? "✓" : status === "partial" ? "·" : status === "no" ? "–" : null;
              return (
                <div className="fact" key={label}>
                  <dt>{label}</dt>
                  <dd>
                    <div className="offer-stack">
                      <span className={offerClass}>
                        {offerIcon ? <i aria-hidden="true">{offerIcon}</i> : null}
                        {offerLabel}
                      </span>
                      {programMeta ? <span className="offer-meta">{programMeta}</span> : null}
                    </div>
                  </dd>
                </div>
              );
            })}
            <div className="fact">
              <dt>Additional engineering programs</dt>
              <dd>
                <div className="add-program-list">
                  {additionalPrograms.length === 0 ? (
                    <span className="offer-meta">None added</span>
                  ) : (
                    additionalPrograms.map((row) => (
                      <div className="add-program-row" key={row.id}>
                        {row.sourceUrl ? (
                          <a href={row.sourceUrl} target="_blank" rel="noreferrer">
                            {row.name}
                          </a>
                        ) : (
                          <span>{row.name}</span>
                        )}
                        <button
                          type="button"
                          className="remove"
                          aria-label={`Remove ${row.name}`}
                          onClick={() =>
                            onPatch({
                              additionalPrograms: additionalPrograms.filter(
                                (item) => item.id !== row.id,
                              ),
                            })
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                  {addingProgram ? (
                    <div className="add-program-panel">
                      <div className="add-program-panel-header">
                        <strong>Engineering majors at {school.name}</strong>
                        {programOptions.length > 0 && optionsSource === "catalog" && checkedDateLabel ? (
                          <span className="offer-meta">
                            From the official catalog, checked {checkedDateLabel}
                          </span>
                        ) : null}
                        {programOptions.length > 0 && optionsSource === "scorecard" && checkedDateLabel ? (
                          <span className="offer-meta">
                            From College Scorecard degree data, checked {checkedDateLabel}.
                            Program names are federal category names, not the school&apos;s own.
                          </span>
                        ) : null}
                      </div>

                      {programOptions.length > 0 ? (
                        <div className="add-program-checklist">
                          {programOptions.map((option) => (
                            <label className="add-program-check-row" key={option.id}>
                              <input
                                type="checkbox"
                                checked={checkedOptionIds.includes(option.id)}
                                onChange={() => toggleOption(option.id)}
                              />
                              <span className="add-program-check-body">
                                <span className="add-program-check-name">
                                  {option.name}
                                  {option.sourceUrl ? (
                                    <>
                                      {" "}
                                      <a
                                        href={option.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        Source
                                      </a>
                                    </>
                                  ) : null}
                                </span>
                                {option.notes.trim() ? (
                                  <span className="offer-meta">{option.notes}</span>
                                ) : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : school.programOptionsCheckedDate.trim() ? (
                        <p className="offer-meta">
                          No engineering majors found
                          {checkedDateLabel ? ` (checked ${checkedDateLabel}).` : "."}
                        </p>
                      ) : (
                        <div className="add-program-empty">
                          <p className="offer-meta">No program list for this school yet.</p>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={lookingUpPrograms}
                            onClick={() => void lookupPrograms()}
                          >
                            {lookingUpPrograms ? "Looking up…" : "Look up programs"}
                          </button>
                        </div>
                      )}

                      <div className="add-program-form">
                        <p className="add-program-manual-label">Program not listed?</p>
                        <label>
                          Program name
                          <input
                            value={programName}
                            placeholder="e.g. Robotics Engineering (BS)"
                            onChange={(event) => {
                              setProgramName(event.target.value);
                              setProgramError("");
                            }}
                          />
                        </label>
                        <label>
                          Source link
                          <input
                            value={programUrl}
                            placeholder="https://"
                            onChange={(event) => setProgramUrl(event.target.value)}
                          />
                        </label>
                        {programError ? (
                          <p className="add-program-error" role="alert">
                            {programError}
                          </p>
                        ) : null}
                        <div className="add-program-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={saveAdditionalProgram}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={closeAddProgram}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="add">
                      <button
                        type="button"
                        className="add-program-btn"
                        onClick={openAddProgram}
                      >
                        ＋ Add program
                      </button>
                    </div>
                  )}
                </div>
              </dd>
            </div>
            <PlainFact
              label="Degree shape"
              value={school.materialsOffering.trim() || "Not set"}
            />
            {engineeringShare ? (
              <PlainFact
                label="Engineering share of bachelor's degrees"
                value={engineeringShare}
              />
            ) : null}
          </dl>
        </section>

        <section className="area" aria-labelledby="snap-camp-h">
          <span className="area-label" id="snap-camp-h">
            Campus
          </span>
          <span className="area-head">
            {setting || undergrads != null ? (
              <>
                {setting ? (
                  <span className="campus-setting-word">
                    <CampusSettingBadge
                      campusSetting={setting}
                      metroArea={school.metroArea}
                      metroPopulation={school.metroPopulation}
                      location={school.location}
                    />
                  </span>
                ) : (
                  <span>Setting not set</span>
                )}
                {undergrads != null && Number.isFinite(undergrads) ? (
                  <span className="campus-size-word">
                    <UsersThree
                      className="campus-setting-icon"
                      size={16}
                      weight="duotone"
                      aria-hidden="true"
                    />
                    <span>
                      {formatUndergradsRounded(undergrads)} Undergrads
                    </span>
                  </span>
                ) : (
                  <span>Size not set</span>
                )}
              </>
            ) : (
              "Campus not set"
            )}
          </span>
          <dl className="facts">
            <PlainFact label="City" value={school.location.trim() || "Not set"} />
            <div className="fact">
              <dt>Campus Setting</dt>
              <dd className="campus-setting-detail">
                {setting ? (
                  <CampusSettingBadge
                    campusSetting={setting}
                    metroArea={school.metroArea}
                    metroPopulation={school.metroPopulation}
                    location={school.location}
                    showTooltip={false}
                  />
                ) : (
                  "Not set"
                )}
              </dd>
            </div>
            <div className="fact">
              <dt>School Size</dt>
              <dd className="size">
                {gauge && undergrads != null ? (
                  <SizeGauge undergrads={undergrads} listUndergrads={listUndergrads} />
                ) : undergrads != null && Number.isFinite(undergrads) ? (
                  <span className="size-word">{formatUndergrads(undergrads)}</span>
                ) : (
                  <span className="size-word">Not set</span>
                )}
              </dd>
            </div>
            <PlainFact
              label="Site"
              value={siteLabel || "Not set"}
              href={siteHref || undefined}
            />
          </dl>
        </section>
      </div>

      <SchoolScoirStudentBody school={school} />

      <SchoolCampusSatelliteMap school={school} />

      <p className="foot">
        Tuition, aid and net price live in the Financials tab.
        {missingBits.length
          ? ` ${missingBits.join(", ").replace(/^./, (c) => c.toUpperCase())} ${
              missingBits.length === 1 ? "is" : "are"
            } not in the record yet.`
          : null}
      </p>
    </div>
  );
}
