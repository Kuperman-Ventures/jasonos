import type { Likelihood, Section } from "@/lib/dashboard/schema";
import { LikelihoodPill } from "./LikelihoodPill";
import { SectionHeading } from "./section-heading";
import styles from "./dashboard.module.css";

type Table = Extract<Section, { type: "table" }>;
type Cell = Table["rows"][number][number];

const PILL_TEXT: Record<Likelihood, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function TableCell({ value }: { value: Cell }) {
  if (typeof value === "string") return value;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <LikelihoodPill likelihood={value.pill} />
      {value.text && value.text !== PILL_TEXT[value.pill] ? <span>{value.text}</span> : null}
    </span>
  );
}

export function TableSection({ section }: { section: Table }) {
  return (
    <section id={section.id} className={styles.section}>
      <SectionHeading>{section.heading}</SectionHeading>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {section.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, index) => (
              <tr key={index}>
                {section.columns.map((column, cell) => (
                  <td key={column}>
                    <TableCell value={row[cell] ?? ""} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {section.legend ? <p className={styles.legend}>{section.legend}</p> : null}
    </section>
  );
}
