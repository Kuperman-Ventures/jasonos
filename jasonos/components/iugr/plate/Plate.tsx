import type { ReactNode } from "react";

/**
 * Field-guide plate system — style rules for every plate in the entry:
 * - Stroke, not fill, except for flat accent shapes
 * - Ink base, cream strokes and text
 * - Chartreuse is reserved for the reader
 * - Coral is reserved for the copy machine and copies
 * - Violet is reserved for annotations and the Guide's own marks
 * - Original SVG only, no external assets
 */

export type PlateProps = {
  figureNumber?: number;
  label?: string;
  children?: ReactNode;
  className?: string;
};

function padPlateNumber(value: number): string {
  return String(value).padStart(2, "0");
}

export function Plate({ figureNumber, label, children, className }: PlateProps) {
  return (
    <figure
      className={["iugr-plate", className].filter(Boolean).join(" ")}
    >
      <div className="iugr-plate-frame" aria-hidden>
        <span className="iugr-plate-tick iugr-plate-tick-tl" />
        <span className="iugr-plate-tick iugr-plate-tick-tr" />
        <span className="iugr-plate-tick iugr-plate-tick-bl" />
        <span className="iugr-plate-tick iugr-plate-tick-br" />
        {figureNumber != null ? (
          <span className="iugr-plate-number">
            PLATE {padPlateNumber(figureNumber)}
          </span>
        ) : null}
      </div>
      <div className="iugr-plate-body">{children}</div>
      {label ? <figcaption className="iugr-plate-label">{label}</figcaption> : null}
    </figure>
  );
}
