import type { DashboardDocument, Section } from "@/lib/dashboard/schema";
import { CardsSection } from "./CardsSection";
import { DashboardMark } from "./DashboardMark";
import { SourcesSection } from "./SourcesSection";
import { TableSection } from "./TableSection";
import { TextSection } from "./TextSection";
import { TilesSection } from "./TilesSection";
import { TimelineSection } from "./TimelineSection";
import styles from "./dashboard.module.css";

const KNOWN_SECTIONS = new Set(["tiles", "timeline", "cards", "table", "text", "sources"]);

function renderSection(section: Section) {
  switch (section.type) {
    case "tiles":
      return <TilesSection section={section} />;
    case "timeline":
      return <TimelineSection section={section} />;
    case "cards":
      return <CardsSection section={section} />;
    case "table":
      return <TableSection section={section} />;
    case "text":
      return <TextSection section={section} />;
    case "sources":
      return <SourcesSection section={section} />;
    default:
      return null;
  }
}

/** A subtitle with its own first line uses that line as the small header label. */
function headerCopy(subtitle?: string): { kicker?: string; subtitle?: string } {
  if (!subtitle?.trim()) return {};
  const [first, ...rest] = subtitle.split("\n");
  const more = rest.join("\n").trim();
  if (first?.trim() && more) return { kicker: first.trim(), subtitle: more };
  return { subtitle: subtitle.trim() };
}

export function ProjectDashboard({
  document,
  slug,
}: {
  document: DashboardDocument;
  slug?: string;
}) {
  const header = headerCopy(document.subtitle);
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          {slug === "oversight-agenda" ? <DashboardMark /> : null}
          <div className={styles.headerCopy}>
            {header.kicker ? <p className={styles.kicker}>{header.kicker}</p> : null}
            <h1 className={styles.title}>{document.title}</h1>
            {header.subtitle ? <p className={styles.subtitle}>{header.subtitle}</p> : null}
            <p className={styles.updated}>Updated {document.updatedOn}</p>
          </div>
        </header>
        {document.sections.map((section) => {
          if (!KNOWN_SECTIONS.has(section.type)) {
            console.warn(`[project-dashboard] skipped section ${section.id} (${section.type})`);
            return null;
          }
          return <div key={section.id}>{renderSection(section)}</div>;
        })}
      </div>
    </div>
  );
}
