import { idleMotionForIndex } from "@/lib/iugr/motion";

export type ResidentFigureVariant = "full" | "token";

export type ResidentFigureProps = {
  variant: ResidentFigureVariant;
  isReader: boolean;
  index: number;
  /** Override the reader tick. Defaults to "YOU" when isReader is true. */
  tickLabel?: string;
  dashed?: boolean;
  muted?: boolean;
  className?: string;
};

export function ResidentFigure({
  variant,
  isReader,
  index,
  tickLabel,
  dashed = false,
  muted = false,
  className,
}: ResidentFigureProps) {
  const idle = idleMotionForIndex(index);
  const mark = isReader ? (tickLabel ?? "YOU") : null;
  const tone = muted ? "muted" : isReader ? "reader" : "resident";

  return (
    <span
      className={["iugr-resident-figure", `is-${tone}`, className]
        .filter(Boolean)
        .join(" ")}
      data-variant={variant}
      data-reader={isReader ? "true" : "false"}
      style={{
        ["--iugr-idle-duration" as string]: `${idle.durationMs}ms`,
        ["--iugr-idle-delay" as string]: `${idle.delayMs}ms`,
      }}
    >
      <svg
        className="iugr-resident-svg"
        viewBox={variant === "token" ? "0 0 16 22" : "0 0 20 36"}
        aria-hidden
      >
        {isReader ? (
          <ellipse
            className="iugr-resident-ring"
            cx={variant === "token" ? 8 : 10}
            cy={variant === "token" ? 8 : 18}
            rx={variant === "token" ? 7 : 8.5}
            ry={variant === "token" ? 9 : 16.5}
          />
        ) : null}

        {variant === "token" ? (
          <g className="iugr-resident-idle">
            <line
              className="iugr-resident-stroke"
              x1="8"
              y1="10"
              x2="8"
              y2="18"
              strokeDasharray={dashed ? "2 2" : undefined}
            />
            <circle
              className="iugr-resident-stroke iugr-resident-fill"
              cx="8"
              cy="6"
              r="3.2"
              strokeDasharray={dashed ? "2 2" : undefined}
            />
          </g>
        ) : (
          <g className="iugr-resident-idle">
            <path
              className="iugr-resident-stroke iugr-resident-fill"
              d="M4.5 14.5 C4.5 11.2 7 9 10 9 C13 9 15.5 11.2 15.5 14.5 L15.5 31 C15.5 32.4 14.2 33.5 10 33.5 C5.8 33.5 4.5 32.4 4.5 31 Z"
              strokeDasharray={dashed ? "3 2.5" : undefined}
            />
            <circle
              className="iugr-resident-stroke iugr-resident-fill"
              cx="10"
              cy="6.2"
              r="4.1"
              strokeDasharray={dashed ? "3 2.5" : undefined}
            />
          </g>
        )}
      </svg>
      {mark ? (
        <span className="iugr-resident-tick" data-tick={mark}>
          {mark}
        </span>
      ) : null}
    </span>
  );
}
