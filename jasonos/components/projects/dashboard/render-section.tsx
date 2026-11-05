import type { Section } from "@/lib/dashboard/schema";
import { NewsSection } from "./NewsSection";
import { SourcesSection } from "./SourcesSection";
import { TableSection } from "./TableSection";
import { TextSection } from "./TextSection";
import { TilesSection } from "./TilesSection";
import { TimelineSection } from "./TimelineSection";

/** Standalone sections. Cards are rendered by ProjectDashboard so they can take an appendix. */
export function renderDashboardSection(section: Section, updatedOn: string) {
  switch (section.type) {
    case "tiles":
      return <TilesSection section={section} />;
    case "timeline":
      return <TimelineSection section={section} />;
    case "table":
      return <TableSection section={section} />;
    case "text":
      return <TextSection section={section} />;
    case "sources":
      return <SourcesSection section={section} />;
    case "news":
      return <NewsSection section={section} updatedOn={updatedOn} />;
    case "cards":
      return null;
    default:
      return null;
  }
}
