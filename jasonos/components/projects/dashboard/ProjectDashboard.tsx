import type { DashboardDocument, Section } from "@/lib/dashboard/schema";
import { CardsSection } from "./CardsSection";
import { SourcesSection } from "./SourcesSection";
import { TableSection } from "./TableSection";
import { TextSection } from "./TextSection";
import { TilesSection } from "./TilesSection";
import { TimelineSection } from "./TimelineSection";

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

export function ProjectDashboard({ document }: { document: DashboardDocument }) {
  return (
    <div className="mx-auto min-w-0 max-w-[1200px] space-y-8 overflow-x-clip px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{document.title}</h1>
        {document.subtitle ? (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {document.subtitle}
          </p>
        ) : null}
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Updated {document.updatedOn}
        </p>
      </header>
      {document.sections.map((section) => {
        if (!KNOWN_SECTIONS.has(section.type)) {
          console.warn(`[project-dashboard] skipped section ${section.id} (${section.type})`);
          return null;
        }
        return <div key={section.id}>{renderSection(section)}</div>;
      })}
    </div>
  );
}
