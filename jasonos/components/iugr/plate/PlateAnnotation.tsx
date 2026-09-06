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

const MAX_LEADER_PCT = 25;
const EDGE_PAD_PCT = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Field-guide labelling convention: short hairline leader, cream anchor
 * dot, real text. Coordinates are percentages of the positioned parent
 * (0–100). Leaders are capped at 25% of the plate width so they stay local.
 */
export function PlateAnnotation({
  text,
  anchor,
  label,
  className,
}: PlateAnnotationProps) {
  const dx = label.x - anchor.x;
  const dy = label.y - anchor.y;
  const distance = Math.hypot(dx, dy);
  const scale = distance > MAX_LEADER_PCT ? MAX_LEADER_PCT / distance : 1;
  const endX = anchor.x + dx * scale;
  const endY = anchor.y + dy * scale;
  const textX = clamp(endX, EDGE_PAD_PCT, 100 - EDGE_PAD_PCT);
  const textY = clamp(endY, EDGE_PAD_PCT, 100 - EDGE_PAD_PCT);
  const align =
    textX < 35 ? "left" : textX > 65 ? "right" : "center";

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
          x2={endX}
          y2={endY}
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={anchor.x} cy={anchor.y} r="1.1" />
      </svg>
      <p
        className="iugr-plate-annotation-text"
        data-align={align}
        style={{ left: `${textX}%`, top: `${textY}%` }}
      >
        {text}
      </p>
    </div>
  );
}
