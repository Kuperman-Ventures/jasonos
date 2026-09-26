"use client";

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
  parseCampusSize,
  sizeGaugeModel,
  sizeOf,
  tierHeadlineVar,
  type CampusSetting,
} from "@/lib/campus-size";
import { websiteHref, websiteHostLabel } from "@/lib/school-photo";
import { SchoolLocationMap, SelectivityGauge } from "./SchoolSnapshotViz";

type SnapshotPatch = Partial<
  Pick<
    School,
    | "interestLevel"
    | "applicationStatus"
    | "admissionTrack"
    | "testPolicy"
    | "familyTestPolicy"
    | "trackedPrograms"
  >
>;

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

function SettingChip({ setting }: { setting: CampusSetting }) {
  return (
    <span className={`setting setting-${setting.toLowerCase()}`}>
      <i aria-hidden="true" />
      {setting}
    </span>
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
  nextDeadline,
  onPatch,
  onChangeDeadlineDate,
}: {
  school: School;
  /** Undergrad counts for every school on the family's current (non-archived) list. */
  listUndergrads: number[];
  nextDeadline: { id: string; title: string; dueDate: string } | null;
  onPatch: (patch: SnapshotPatch) => void;
  onChangeDeadlineDate: (iso: string) => void;
}) {
  const tierName = tierLabel(school.selectivityTier);
  const tierHead = tierName || "Tier not set";
  const tierColor = `var(${tierHeadlineVar(school.selectivityTier)})`;
  const statusHead = school.applicationStatus
    ? statusLabel(school.applicationStatus)
    : "Not started";
  const pathway = pathwayFromContext(school.admissionsContext);
  const siteHref = websiteHref(school.website);
  const siteLabel = websiteHostLabel(school.website);

  const recordTestPolicy = school.testPolicy.trim();
  const testPolicyValue = recordTestPolicy || school.familyTestPolicy.trim();
  const testPolicyMissing = !recordTestPolicy;

  const { setting, size: sizeFromRecord } = parseCampusSize(school.campusSize);
  const undergrads = school.undergradEnrollment;
  const sizeWord =
    undergrads != null && Number.isFinite(undergrads)
      ? sizeOf(undergrads)
      : sizeFromRecord;
  const gauge =
    undergrads != null && Number.isFinite(undergrads)
      ? sizeGaugeModel(undergrads, listUndergrads)
      : null;

  const offeredMap: Record<string, ProgramOfferStatus> = {};
  for (const program of SNAPSHOT_PROGRAMS) {
    offeredMap[program.label] = programOfferStatus(school[program.offeredField]);
  }
  const tracked = school.trackedPrograms.filter((label) =>
    SNAPSHOT_PROGRAMS.some((row) => row.label === label),
  );
  const addable = SNAPSHOT_PROGRAMS.map((row) => row.label).filter(
    (label) => !tracked.includes(label),
  );

  const missingBits: string[] = [];
  if (!school.middle50.trim()) missingBits.push("Middle 50%");
  if (!school.applicationPlatform.trim()) missingBits.push("application platform");
  if (!school.teacherRecs.trim()) missingBits.push("teacher recommendations");

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
              <PlainFact label="Test policy" value={testPolicyValue} />
            )}
            <PlainFact label="SAT" value={school.satContext.trim() || "Not set"} />
            <PlainFact
              label="Pathway"
              value={(pathway || school.admissionsContext).trim() || "Not set"}
            />
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
          <span className="area-head">{programsOfferedHeadline(tracked, offeredMap)}</span>
          <dl className="facts">
            {tracked.map((label) => {
              const status = offeredMap[label];
              const offered = status === "yes";
              const partial = status === "partial";
              const programMeta =
                label === "Aerospace engineering"
                  ? school.aerospaceProgram.trim() || school.aerospaceNotes.trim()
                  : label === "Material sciences"
                    ? school.materialsProgram.trim() || school.materialsOffering.trim()
                    : "";
              return (
                <div className="fact" key={label}>
                  <dt>{label}</dt>
                  <dd>
                    <div className="offer-stack">
                      <span className={`offer${offered ? "" : partial ? " partial" : " no"}`}>
                        <i aria-hidden="true">{offered ? "✓" : partial ? "·" : "–"}</i>
                        {offered ? "Offered" : partial ? "Partial" : "Not offered"}
                      </span>
                      {programMeta ? <span className="offer-meta">{programMeta}</span> : null}
                    </div>
                    <button
                      type="button"
                      className="remove"
                      aria-label={`Stop tracking ${label}`}
                      onClick={() =>
                        onPatch({
                          trackedPrograms: tracked.filter((item) => item !== label),
                        })
                      }
                    >
                      ×
                    </button>
                  </dd>
                </div>
              );
            })}
            <PlainFact
              label="Degree shape"
              value={school.materialsOffering.trim() || "Not set"}
            />
            {addable.length ? (
              <div className="add">
                <select
                  aria-label="Track another program"
                  value=""
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!next) return;
                    onPatch({ trackedPrograms: [...tracked, next] });
                  }}
                >
                  <option value="">＋ Track another program</option>
                  {addable.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="area" aria-labelledby="snap-camp-h">
          <span className="area-label" id="snap-camp-h">
            Campus
          </span>
          <span className="area-head">
            {setting || sizeWord ? (
              <>
                {setting ? (
                  <span className={`campus-setting-word setting-ink-${setting.toLowerCase()}`}>
                    {setting}
                  </span>
                ) : (
                  <span>Setting not set</span>
                )}
                <span className="sep"> · </span>
                <span>{sizeWord || "Size not set"}</span>
              </>
            ) : (
              "Campus not set"
            )}
          </span>
          <dl className="facts">
            <PlainFact label="City" value={school.location.trim() || "Not set"} />
            <div className="fact">
              <dt>Setting</dt>
              <dd>{setting ? <SettingChip setting={setting} /> : "Not set"}</dd>
            </div>
            <div className="fact">
              <dt>Size</dt>
              <dd className="size">
                <span className="size-word">{sizeWord || "Not set"}</span>
                {gauge && undergrads != null ? (
                  <SizeGauge undergrads={undergrads} listUndergrads={listUndergrads} />
                ) : null}
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
