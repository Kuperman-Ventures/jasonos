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
  /**
   * Caption body after "PLATE NN — ". Renders below the frame in the
   * reserved caption zone. Never overlaps the drawing.
   */
  caption?: string;
  /** Optional extra caption-zone lines (e.g. temporary tap hint). */
  captionExtra?: ReactNode;
  children?: ReactNode;
  className?: string;
};

function padPlateNumber(value: number): string {
  return String(value).padStart(2, "0");
}

export function Plate({
  figureNumber,
  caption,
  captionExtra,
  children,
  className,
}: PlateProps) {
  const showCaption = figureNumber != null || caption || captionExtra;

  return (
    <figure
      className={["iugr-plate", className].filter(Boolean).join(" ")}
    >
      <div className="iugr-plate-surface">
        <div className="iugr-plate-frame" aria-hidden>
          <span className="iugr-plate-tick iugr-plate-tick-tl" />
          <span className="iugr-plate-tick iugr-plate-tick-tr" />
          <span className="iugr-plate-tick iugr-plate-tick-bl" />
          <span className="iugr-plate-tick iugr-plate-tick-br" />
        </div>
        <div className="iugr-plate-body">{children}</div>
      </div>
      {showCaption ? (
        <figcaption className="iugr-plate-caption">
          {figureNumber != null || caption ? (
            <p className="iugr-plate-caption-line">
              {figureNumber != null ? (
                <span className="iugr-plate-caption-id">
                  PLATE {padPlateNumber(figureNumber)}
                </span>
              ) : null}
              {figureNumber != null && caption ? (
                <span className="iugr-plate-caption-sep" aria-hidden>
                  {" "}
                  -{" "}
                </span>
              ) : null}
              {caption ? (
                <span className="iugr-plate-caption-body">{caption}</span>
              ) : null}
            </p>
          ) : null}
          {captionExtra}
        </figcaption>
      ) : null}
    </figure>
  );
}
