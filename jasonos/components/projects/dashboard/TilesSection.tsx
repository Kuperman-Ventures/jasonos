import type { Section } from "@/lib/dashboard/schema";
import { SectionHeading } from "./section-heading";
import styles from "./dashboard.module.css";

type Tiles = Extract<Section, { type: "tiles" }>;

export function TilesSection({ section }: { section: Tiles }) {
  return (
    <>
      {section.heading ? <SectionHeading>{section.heading}</SectionHeading> : null}
      <div className={styles.tiles}>
        {section.tiles.map((tile) => {
          const large = tile.size === "large" || /^\d+$/.test(tile.value);
          return (
            <div key={tile.label} className={styles.tile}>
              <div className={styles.tileLabel}>{tile.label}</div>
              <div className={`${styles.tileValue} ${large ? styles.tileLarge : styles.tileSmall}`}>{tile.value}</div>
              {tile.note ? <p className={styles.note}>{tile.note}</p> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
