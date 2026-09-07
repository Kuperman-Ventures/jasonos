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
  /**
   * Use the copy-town coral palette for the reader mark (matched pair
   * with the original chartreuse reader).
   */
  copyPalette?: boolean;
  /** Show the faint selectable resting ring. Defaults to true when not reader/muted. */
  selectable?: boolean;
  /** Height scale relative to 1 — keep within about ±8%. */
  heightScale?: number;
  className?: string;
};

/**
 * Field-guide resident mark.
 * Full variant: head, short neck, tapered body. Stroke only unless the
 * reader fill is active. Chartreuse is reserved for the original reader;
 * coral is reserved for the copied reader.
 */
export function ResidentFigure({
  variant,
  isReader,
  index,
  tickLabel,
  dashed = false,
  muted = false,
  copyPalette = false,
  selectable,
  heightScale = 1,
  className,
}: ResidentFigureProps) {
  const idle = idleMotionForIndex(index);
  const mark = isReader ? (tickLabel ?? "YOU") : null;
  const roleClass = isReader
    ? copyPalette
      ? "is-copy-reader"
      : "is-reader"
    : muted
      ? "is-muted"
      : "is-resident";
  const showSelectable =
    selectable ?? (!isReader && !muted && variant === "full");

  return (
    <span
      className={[
        "iugr-resident-figure",
        roleClass,
        muted && isReader ? "is-muted" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-variant={variant}
      data-reader={isReader ? "true" : "false"}
      data-selectable={showSelectable ? "true" : "false"}
      style={{
        ["--iugr-idle-duration" as string]: `${idle.durationMs}ms`,
        ["--iugr-idle-delay" as string]: `${idle.delayMs}ms`,
        ["--figure-scale" as string]: String(heightScale),
      }}
    >
      <svg
        className="iugr-resident-svg"
        viewBox={variant === "token" ? "0 0 16 22" : "0 0 20 38"}
        aria-hidden
      >
        {isReader ? (
          <ellipse
            className="iugr-resident-ring"
            cx={variant === "token" ? 8 : 10}
            cy={variant === "token" ? 9 : 19}
            rx={variant === "token" ? 7 : 8.2}
            ry={variant === "token" ? 9.5 : 17.5}
          />
        ) : null}

        {showSelectable ? (
          <ellipse
            className="iugr-resident-selectable"
            cx="10"
            cy="19"
            rx="8.2"
            ry="17.5"
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
            {/* Head */}
            <circle
              className="iugr-resident-stroke iugr-resident-fill"
              cx="10"
              cy="5"
              r="3.4"
              strokeDasharray={dashed ? "3 2.5" : undefined}
            />
            {/* Short neck — 2 unit gap from chin (y=8.4) to shoulders (y=10.4) */}
            <line
              className="iugr-resident-stroke"
              x1="10"
              y1="8.4"
              x2="10"
              y2="10.4"
              strokeDasharray={dashed ? "3 2.5" : undefined}
            />
            {/* Tapered body: narrow at shoulders, wider at the base */}
            <path
              className="iugr-resident-stroke iugr-resident-fill"
              d="M7.4 10.4
                 C6.6 12.2 5.8 17.5 5.2 26.5
                 C5 29.8 6.8 33.2 10 33.2
                 C13.2 33.2 15 29.8 14.8 26.5
                 C14.2 17.5 13.4 12.2 12.6 10.4
                 Z"
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
