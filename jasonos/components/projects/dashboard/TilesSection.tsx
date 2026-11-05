import type { Section } from "@/lib/dashboard/schema";
import { SectionHeading } from "./section-heading";
import styles from "./dashboard.module.css";

type Tiles = Extract<Section, { type: "tiles" }>;

export function TilesSection({ section }: { section: Tiles }) {
  return (
    <section id={section.id} className={styles.section}>
      {section.heading ? <SectionHeading>{section.heading}</SectionHeading> : null}
      <div className={styles.tiles}>
        {section.tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <div className={styles.tileLabel}>{tile.label}</div>
            <div className={tile.mono ? `${styles.tileValue} ${styles.tileValueMono}` : styles.tileValue}>
              {tile.value}
            </div>
            {tile.note ? <p className={styles.note}>{tile.note}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
