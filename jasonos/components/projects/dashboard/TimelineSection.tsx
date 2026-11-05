import type { Section } from "@/lib/dashboard/schema";
import { SectionHeading } from "./section-heading";
import styles from "./dashboard.module.css";

type Timeline = Extract<Section, { type: "timeline" }>;

export function TimelineSection({ section }: { section: Timeline }) {
  return (
    <section id={section.id} className={styles.section}>
      <SectionHeading>{section.heading}</SectionHeading>
      <div className={styles.timeline}>
        {section.items.map((item) => (
          <div key={`${item.when}-${item.what}`} className={styles.timelineItem}>
            <div className={styles.when}>{item.when}</div>
            <div className={styles.what}>{item.what}</div>
            {item.why ? <p className={styles.why}>{item.why}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
