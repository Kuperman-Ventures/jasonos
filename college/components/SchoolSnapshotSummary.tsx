import {
  type School,
  formatDate,
  statusLabel,
  tierLabel,
  trackLabel,
  INTEREST_LEVELS,
  pathwayFromContext,
} from "@/lib/types";
import { websiteHref, websiteHostLabel } from "@/lib/school-photo";
import { SchoolLocationMap, SelectivityGauge } from "./SchoolSnapshotViz";

function displayOrUnset(value: string): string {
  const trimmed = value.trim();
  return trimmed || "Not set";
}

function offeredLabel(value: string): { text: string; tone: "offered" | "unset" | "plain" } {
  const trimmed = value.trim();
  if (/^yes$/i.test(trimmed)) return { text: "Offered", tone: "offered" };
  if (/^no$/i.test(trimmed)) return { text: "Not offered", tone: "unset" };
  if (!trimmed) return { text: "Not set", tone: "unset" };
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
  return { title: "Not started", accent: false };
}

function Fact({
  label,
  value,
  tone = "plain",
  href,
}: {
  label: string;
  value: string;
  tone?: "plain" | "offered" | "unset" | "link";
  href?: string;
}) {
  const empty = !value.trim() || value === "Not set";
  const className = empty || tone === "unset" ? "unset" : tone === "offered" ? "offered" : undefined;
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd className={className}>
        {href && !empty ? (
          <a href={href} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
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
    <div className="snapshot">
      <div className="intro">
        <h1>School snapshot</h1>
        <p className="lede">
          Key facts at a glance. Use the other tabs to edit settings, requirements, money, or
          school-level project work.
        </p>
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
          <span className="area-head">{tier}</span>
          <dl className="facts">
            <Fact label="Test policy" value={displayOrUnset(school.testPolicy)} />
            <Fact label="SAT" value={displayOrUnset(school.satContext)} />
            <Fact
              label="Pathway"
              value={displayOrUnset(pathway || school.admissionsContext)}
            />
          </dl>
        </section>

        <section className="area" aria-labelledby="snap-stand-h">
          <span className="area-label" id="snap-stand-h">
            Where you stand
          </span>
          <span className={`area-head${stand.accent ? " is-status" : ""}`}>{stand.title}</span>
          <dl className="facts">
            <Fact
              label="Interest"
              value={interest}
              tone={interest === "Not set" ? "unset" : "plain"}
            />
            <Fact
              label="Application status"
              value={school.applicationStatus ? statusLabel(school.applicationStatus) : "Not set"}
              tone={school.applicationStatus ? "plain" : "unset"}
            />
            <Fact
              label="Admission track"
              value={school.admissionTrack ? trackLabel(school.admissionTrack) : "Not set"}
              tone={school.admissionTrack ? "plain" : "unset"}
            />
            <Fact
              label="Next deadline"
              value={
                nextDeadline
                  ? `${nextDeadline.title} · ${formatDate(nextDeadline.dueDate)}`
                  : "Not set"
              }
              tone={nextDeadline ? "plain" : "unset"}
            />
          </dl>
          {standIncomplete ? (
            <button type="button" className="action" onClick={onSetStand}>
              Set these
            </button>
          ) : null}
        </section>

        <section className="area" aria-labelledby="snap-prog-h">
          <span className="area-label" id="snap-prog-h">
            Programs
          </span>
          <span className="area-head">
            {programsHeadline(school.mechanicalEngineering, school.materials)}
          </span>
          <dl className="facts">
            <Fact label="Mechanical engineering" value={me.text} tone={me.tone} />
            <Fact label="Material sciences" value={mat.text} tone={mat.tone} />
            <Fact label="Degree shape" value={displayOrUnset(school.materialsOffering)} />
          </dl>
        </section>

        <section className="area" aria-labelledby="snap-camp-h">
          <span className="area-label" id="snap-camp-h">
            Campus
          </span>
          <span className="area-head">{campusHeadline(school.campusSize)}</span>
          <dl className="facts">
            <Fact label="City" value={displayOrUnset(school.location)} />
            <Fact
              label="Site"
              value={siteLabel || "Not set"}
              tone={siteHref ? "link" : "unset"}
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
