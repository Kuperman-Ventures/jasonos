import type { Section } from "@/lib/dashboard/schema";
import { SectionHeading } from "./section-heading";
import styles from "./dashboard.module.css";

type Sources = Extract<Section, { type: "sources" }>;

function safeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function SourcesSection({ section }: { section: Sources }) {
  return (
    <section id={section.id} className={styles.section}>
      <SectionHeading>{section.heading}</SectionHeading>
      <ol className={styles.sources}>
        {section.items.map((item) => {
          const href = item.url ? safeHttpUrl(item.url) : null;
          return (
            <li key={`${item.title}-${item.url ?? ""}`}>
              {href ? (
                <a href={href} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              ) : (
                item.title
              )}
              {item.note ? <span className={styles.note}>{item.note}</span> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
