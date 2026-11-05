import type { Section } from "@/lib/dashboard/schema";
import { SectionHeading } from "./section-heading";
import styles from "./dashboard.module.css";

type Text = Extract<Section, { type: "text" }>;

export function TextSection({ section }: { section: Text }) {
  return (
    <>
      {section.heading ? <SectionHeading>{section.heading}</SectionHeading> : null}
      {section.paragraphs.map((paragraph) => (
        <p key={paragraph} className={styles.paragraph}>
          {paragraph}
        </p>
      ))}
    </>
  );
}
