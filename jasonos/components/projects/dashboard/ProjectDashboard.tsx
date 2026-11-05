import type { DashboardDocument, Section } from "@/lib/dashboard/schema";
import { CardsSection } from "./CardsSection";
import { DashboardFilterProvider } from "./DashboardFilterContext";
import { DashboardHeader } from "./DashboardHeader";
import { NewsSection } from "./NewsSection";
import { SourcesSection } from "./SourcesSection";
import { TableSection } from "./TableSection";
import { TextSection } from "./TextSection";
import { TilesSection } from "./TilesSection";
import { TimelineSection } from "./TimelineSection";
import styles from "./dashboard.module.css";

const KNOWN_SECTIONS = new Set(["tiles", "timeline", "cards", "table", "text", "sources", "news"]);

function renderSection(section: Section, updatedOn: string) {
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
    case "news":
      return <NewsSection section={section} updatedOn={updatedOn} />;
    default:
      return null;
  }
}

export function ProjectDashboard({ document }: { document: DashboardDocument }) {
  const last = document.sections.length - 1;
  return (
    <DashboardFilterProvider sectionId={document.header?.counter?.sectionId}>
      <div className={`${styles.page} project-dashboard`}>
        <div className={styles.inner}>
          <DashboardHeader document={document} />
          {document.sections.map((section, index) => {
            if (!KNOWN_SECTIONS.has(section.type)) {
              console.warn(`[project-dashboard] skipped section ${section.id} (${section.type})`);
              return null;
            }
            const className =
              index === last ? styles.sectionLast : section.type === "news" ? styles.sectionNews : styles.section;
            return (
              <section key={section.id} id={section.id} className={className}>
                {renderSection(section, document.updatedOn)}
              </section>
            );
          })}
        </div>
      </div>
    </DashboardFilterProvider>
  );
}
