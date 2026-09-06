export type PlateAnnotationPoint = {
  x: number;
  y: number;
};

export type PlateAnnotationProps = {
  text: string;
  anchor: PlateAnnotationPoint;
  label: PlateAnnotationPoint;
  className?: string;
};

/**
 * Field-guide labelling convention: hairline leader, anchor dot, real text.
 * Coordinates are percentages of the positioned parent (0–100).
 */
export function PlateAnnotation({
  text,
  anchor,
  label,
  className,
}: PlateAnnotationProps) {
  return (
    <div
      className={["iugr-plate-annotation", className].filter(Boolean).join(" ")}
    >
      <svg
        className="iugr-plate-annotation-lead"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <line
          x1={anchor.x}
          y1={anchor.y}
          x2={label.x}
          y2={label.y}
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={anchor.x} cy={anchor.y} r="1" />
      </svg>
      <p
        className="iugr-plate-annotation-text"
        style={{ left: `${label.x}%`, top: `${label.y}%` }}
      >
        {text}
      </p>
    </div>
  );
}
