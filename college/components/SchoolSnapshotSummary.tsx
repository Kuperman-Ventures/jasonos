import {
  type School,
  formatDate,
  statusLabel,
  tierLabel,
  trackLabel,
  INTEREST_LEVELS,
  pathwayFromContext,
} from "@/lib/types";
import { SELECTIVITY_SPECTRUM } from "@/lib/dashboard";
import { websiteHref, websiteHostLabel } from "@/lib/school-photo";

function displayOrUnset(value: string): string {
  const trimmed = value.trim();
  return trimmed || "Not set";
}

function offeredLabel(value: string): { text: string; tone: "offered" | "muted" | "plain" } {
  const trimmed = value.trim();
  if (/^yes$/i.test(trimmed)) return { text: "Offered", tone: "offered" };
  if (/^no$/i.test(trimmed)) return { text: "Not offered", tone: "muted" };
  if (!trimmed) return { text: "Not set", tone: "muted" };
  return { text: trimmed, tone: "plain" };
}

function programsHeadline(mechanical: string, materials: string): string {
  const me = /^yes$/i.test(mechanical.trim());
  const mat = /^yes$/i.test(materials.trim());
  if (me && mat) return "Both offered";
  if (me) return "Mechanical engineering";
  if (mat) return "Material sciences";
  if (!mechanical.trim() && !materials.trim()) return "Programs not set";
  return "Mixed";
}

function campusHeadline(campusSize: string): string {
  const trimmed = campusSize.trim();
  if (!trimmed) return "Campus not set";
  return trimmed.replace(/\s*\/\s*/g, " · ");
}

function standHeadline(school: School): { title: string; accent: boolean } {
  if (school.applicationStatus) {
    return { title: statusLabel(school.applicationStatus), accent: false };
  }
  if (school.interestLevel || school.admissionTrack) {
    return { title: "In progress", accent: true };
  }
  return { title: "Not started", accent: true };
}

function SnapshotRow({
  label,
  value,
  tone = "plain",
  href,
}: {
  label: string;
  value: string;
  tone?: "plain" | "offered" | "muted" | "link";
  href?: string;
}) {
  const empty = !value.trim() || value === "Not set";
  return (
    <div className={`snapshot-card-row${empty ? " is-empty" : ""}`}>
      <span className="snapshot-card-row-label">{label}</span>
      {href && !empty ? (
        <a className="snapshot-card-row-value is-link" href={href} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <span className={`snapshot-card-row-value tone-${tone}`}>{value}</span>
      )}
    </div>
  );
}

function SelectivitySegments({ tier }: { tier: School["selectivityTier"] }) {
  // Left → right matches the arch meter: less competitive → extremely selective.
  const segments = [...SELECTIVITY_SPECTRUM].reverse();
  return (
    <div
      className="snapshot-seg-meter"
      role="img"
      aria-label={tierLabel(tier) || "Selectivity not set"}
    >
      {segments.map((item) => (
        <span
          key={item.id}
          className={`snapshot-seg${item.id === tier ? " is-active" : ""}`}
        />
      ))}
    </div>
  );
}

export function SchoolSnapshotSummary({
  school,
  nextDeadline,
  onSetStand,
}: {
  school: School;
  nextDeadline: { title: string; dueDate: string } | null;
  onSetStand: () => void;
}) {
  const tier = tierLabel(school.selectivityTier) || "Selectivity not set";
  const stand = standHeadline(school);
  const interest =
    INTEREST_LEVELS.find((item) => item.id === school.interestLevel)?.label || "Not set";
  const me = offeredLabel(school.mechanicalEngineering);
  const mat = offeredLabel(school.materials);
  const pathway = pathwayFromContext(school.admissionsContext);
  const siteHref = websiteHref(school.website);
  const siteLabel = websiteHostLabel(school.website);
  const standIncomplete =
    !school.interestLevel || !school.applicationStatus || !school.admissionTrack;

  const missingBits: string[] = [];
  if (!school.middle50.trim()) missingBits.push("Middle 50%");
  if (!school.applicationPlatform.trim()) missingBits.push("application platform");
  if (!school.teacherRecs.trim()) missingBits.push("teacher recommendations");

  return (
    <div className="school-snapshot-summary">
      <div className="snapshot-card-grid">
        <section className="snapshot-card">
          <div className="label">Admissions</div>
          <h4 className="snapshot-card-title">{tier}</h4>
          <SelectivitySegments tier={school.selectivityTier} />
          <div className="snapshot-card-rows">
            <SnapshotRow label="Test policy" value={displayOrUnset(school.testPolicy)} />
            <SnapshotRow label="SAT" value={displayOrUnset(school.satContext)} />
            <SnapshotRow label="Pathway" value={displayOrUnset(pathway || school.admissionsContext)} />
          </div>
        </section>

        <section className="snapshot-card">
          <div className="label">Where you stand</div>
          <h4 className={`snapshot-card-title${stand.accent ? " is-accent" : ""}`}>{stand.title}</h4>
          <div className="snapshot-card-rows">
            <SnapshotRow label="Interest" value={interest} tone={interest === "Not set" ? "muted" : "plain"} />
            <SnapshotRow
              label="Application status"
              value={school.applicationStatus ? statusLabel(school.applicationStatus) : "Not set"}
              tone={school.applicationStatus ? "plain" : "muted"}
            />
            <SnapshotRow
              label="Admission track"
              value={school.admissionTrack ? trackLabel(school.admissionTrack) : "Not set"}
              tone={school.admissionTrack ? "plain" : "muted"}
            />
            <SnapshotRow
              label="Next deadline"
              value={
                nextDeadline
                  ? `${nextDeadline.title} · ${formatDate(nextDeadline.dueDate)}`
                  : "Not set"
              }
              tone={nextDeadline ? "plain" : "muted"}
            />
          </div>
          {standIncomplete ? (
            <button type="button" className="snapshot-set-these" onClick={onSetStand}>
              Set these
            </button>
          ) : null}
        </section>

        <section className="snapshot-card">
          <div className="label">Programs</div>
          <h4 className="snapshot-card-title">
            {programsHeadline(school.mechanicalEngineering, school.materials)}
          </h4>
          <div className="snapshot-card-rows">
            <SnapshotRow label="Mechanical engineering" value={me.text} tone={me.tone} />
            <SnapshotRow label="Material sciences" value={mat.text} tone={mat.tone} />
            <SnapshotRow label="Degree shape" value={displayOrUnset(school.materialsOffering)} />
          </div>
        </section>

        <section className="snapshot-card">
          <div className="label">Campus</div>
          <h4 className="snapshot-card-title">{campusHeadline(school.campusSize)}</h4>
          <div className="snapshot-card-rows">
            <SnapshotRow label="City" value={displayOrUnset(school.location)} />
            <SnapshotRow
              label="Site"
              value={siteLabel || "Not set"}
              tone={siteHref ? "link" : "muted"}
              href={siteHref || undefined}
            />
          </div>
        </section>
      </div>

      <p className="snapshot-summary-note">
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
