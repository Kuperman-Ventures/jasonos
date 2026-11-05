import type { Section } from "@/lib/dashboard/schema";
import { timelineTag, todayFlagPosition } from "@/lib/dashboard/present";
import { SectionHeading } from "./section-heading";
import styles from "./dashboard.module.css";

type Timeline = Extract<Section, { type: "timeline" }>;

export function TimelineSection({ section }: { section: Timeline }) {
  const dated = section.items.every((item) => item.date);
  const flag = dated ? todayFlagPosition(section.items.map((item) => item.date ?? "")) : null;

  return (
    <>
      <SectionHeading>{section.heading}</SectionHeading>
      <div className={styles.timelineWrap}>
        {flag ? (
          <div className={styles.today} style={{ left: flag.left }}>
            <div className={styles.todayFlag}>Today / {flag.label}</div>
            <div className={styles.todayStem} />
          </div>
        ) : null}
        <ol className={styles.timeline}>
          {section.items.map((item, index) => {
            const tag = flag ? timelineTag(index, flag.nextIndex) : null;
            const past = tag === "Done";
            const dot = past
              ? "var(--pd-neutral-600)"
              : tag === "Next"
                ? "var(--pd-accent)"
                : "var(--pd-text)";
            return (
              <li key={`${item.date ?? item.when}-${item.what}`} className={styles.timelineItem} style={{ opacity: past ? 0.55 : 1 }}>
                <div className={styles.marker} style={{ background: dot }} />
                <div className={styles.when}>
                  {item.when}
                  {tag ? <span className={styles.tag}>{tag}</span> : null}
                </div>
                <div className={styles.what}>{item.what}</div>
                {item.why ? <p className={styles.why}>{item.why}</p> : null}
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
