import type { ReactNode } from "react";
import type { DashboardDocument, Section } from "@/lib/dashboard/schema";
import { CardsSection } from "./CardsSection";
import { DashboardFilterProvider } from "./DashboardFilterContext";
import { DashboardHeader } from "./DashboardHeader";
import { renderDashboardSection } from "./render-section";
import styles from "./dashboard.module.css";

const KNOWN_SECTIONS = new Set(["tiles", "timeline", "cards", "table", "text", "sources", "news"]);

/**
 * Pull tiles/table that follow a cards section into that cards render.
 * Those blocks sit inside the last card (for Oversight, the number 7 box).
 */
function takeCardAppendix(sections: Section[], start: number) {
  const appendix: Section[] = [];
  let index = start;
  while (index < sections.length && (sections[index].type === "tiles" || sections[index].type === "table")) {
    appendix.push(sections[index]);
    index += 1;
  }
  return { appendix, next: index };
}

export function ProjectDashboard({ document }: { document: DashboardDocument }) {
  const blocks: { key: string; className: string; node: ReactNode }[] = [];
  for (let index = 0; index < document.sections.length; ) {
    const section = document.sections[index];
    if (!KNOWN_SECTIONS.has(section.type)) {
      console.warn(`[project-dashboard] skipped section ${section.id} (${section.type})`);
      index += 1;
      continue;
    }
    if (section.type === "cards") {
      const { appendix, next } = takeCardAppendix(document.sections, index + 1);
      blocks.push({
        key: section.id,
        className: styles.section,
        node: (
          <CardsSection
            section={section}
            appendix={appendix as Extract<Section, { type: "tiles" | "table" }>[]}
          />
        ),
      });
      index = next;
      continue;
    }
    blocks.push({
      key: section.id,
      className: section.type === "news" ? styles.sectionNews : styles.section,
      node: renderDashboardSection(section, document.updatedOn),
    });
    index += 1;
  }
  if (blocks.length) {
    const last = blocks[blocks.length - 1];
    if (last.className !== styles.sectionNews) last.className = styles.sectionLast;
  }

  return (
    <DashboardFilterProvider sectionId={document.header?.counter?.sectionId}>
      <div className={`${styles.page} project-dashboard`}>
        <div className={styles.inner}>
          <DashboardHeader document={document} />
          {blocks.map((block) => (
            <section key={block.key} id={block.key} className={block.className}>
              {block.node}
            </section>
          ))}
        </div>
      </div>
    </DashboardFilterProvider>
  );
}
