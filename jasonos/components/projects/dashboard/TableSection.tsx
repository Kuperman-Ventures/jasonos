import type { Likelihood, Section } from "@/lib/dashboard/schema";
import { LikelihoodPill } from "./LikelihoodPill";
import { SectionHeading } from "./section-heading";

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
    <section id={section.id} className="min-w-0 scroll-mt-6">
      <SectionHeading>{section.heading}</SectionHeading>
      <div className="min-w-0 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b">
              {section.columns.map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground [font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, index) => (
              <tr key={index} className="border-b last:border-b-0">
                {section.columns.map((column, cell) => (
                  <td key={column} className="px-3 py-3 align-top text-xs leading-relaxed">
                    <TableCell value={row[cell] ?? ""} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {section.legend ? (
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {section.legend}
        </p>
      ) : null}
    </section>
  );
}
