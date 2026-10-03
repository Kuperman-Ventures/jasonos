"use client";

const GRADES = [6, 7, 8, 9, 10, 11, 12] as const;

export type GradeStripProps = {
  since: number | null;
  until: number | null;
  stillDoing: boolean;
  currentGrade: number | null;
  size: "pick" | "mini";
  onPick?: (grade: number) => void;
  label: string;
};

function filledEnd(
  since: number | null,
  until: number | null,
  stillDoing: boolean,
  currentGrade: number | null,
): number | null {
  if (since == null) return null;
  if (stillDoing) return currentGrade ?? since;
  return until ?? since;
}

export function GradeStrip({
  since,
  until,
  stillDoing,
  currentGrade,
  size,
  onPick,
  label,
}: GradeStripProps) {
  const end = filledEnd(since, until, stillDoing, currentGrade);
  const pick = size === "pick";

  return (
    <div className={`aj-grade-strip aj-grade-strip--${size}`} aria-label={pick ? label : undefined}>
      {pick ? (
        <div className="aj-grade-groups" aria-hidden="true">
          <span>Middle school</span>
          <span>High school</span>
        </div>
      ) : null}
      <div className="aj-grade-cells">
        {GRADES.flatMap((g, i) => {
          const filled = since != null && end != null && g >= since && g <= end;
          const isCurrent = currentGrade != null && g === currentGrade;
          const future = currentGrade != null && g > currentGrade;
          const disabled = Boolean(pick && (future || !onPick));
          const className = [
            "aj-grade-cell",
            i === 0 ? "is-first" : "",
            i === GRADES.length - 1 ? "is-last" : "",
            filled ? "is-on" : "",
            filled && isCurrent ? "is-now" : "",
            isCurrent ? "is-current" : "",
            !filled && future ? "is-future" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const cell = pick ? (
            <button
              key={g}
              type="button"
              className={className}
              disabled={disabled}
              aria-label={`${g}th grade`}
              aria-pressed={g === since || (!stillDoing && g === until)}
              onClick={() => onPick?.(g)}
            >
              {g}
            </button>
          ) : (
            <span key={g} className={className} aria-hidden="true" />
          );
          if (g === 9) return [<span key="gap" className="aj-grade-gap" aria-hidden="true" />, cell];
          return [cell];
        })}
      </div>
    </div>
  );
}
