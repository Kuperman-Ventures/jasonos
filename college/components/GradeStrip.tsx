"use client";

import type { GradeCellState } from "@/lib/activities-journal";

const GRADES = [6, 7, 8, 9, 10, 11, 12] as const;

export type GradeStripProps = {
  since?: number | null;
  until?: number | null;
  stillDoing?: boolean;
  currentGrade: number | null;
  size: "pick" | "mini" | "row";
  onPick?: (grade: number) => void;
  label: string;
  cells?: Record<number, GradeCellState>;
  markers?: { grade: number; title: string }[];
  onEmptyClick?: () => void;
};

function filledEnd(
  since: number | null | undefined,
  until: number | null | undefined,
  stillDoing: boolean | undefined,
  currentGrade: number | null,
): number | null {
  if (since == null) return null;
  if (stillDoing) return currentGrade ?? since;
  return until ?? since;
}

function isFilled(state: GradeCellState | undefined): boolean {
  return state === "completed" || state === "in_progress";
}

export function GradeStrip({
  since = null,
  until = null,
  stillDoing = false,
  currentGrade,
  size,
  onPick,
  label,
  cells,
  markers,
  onEmptyClick,
}: GradeStripProps) {
  const end = filledEnd(since, until, stillDoing, currentGrade);
  const pick = size === "pick";
  const row = size === "row";
  const markerByGrade = new Map((markers ?? []).map((m) => [m.grade, m.title]));

  if (row) {
    const empty = GRADES.every((g) => !cells?.[g]);
    if (empty && onEmptyClick) {
      return (
        <button type="button" className="aj-text-btn strong rec-no-grades" onClick={onEmptyClick}>
          Add the grades you did this
        </button>
      );
    }

    return (
      <div className="aj-grade-strip aj-grade-strip--row" role="img" aria-label={label}>
        <div className="aj-grade-cells">
          {GRADES.flatMap((g, i) => {
            const state = cells?.[g] ?? null;
            const filled = isFilled(state);
            const prev = g === 9 ? 8 : g === 6 ? null : g - 1;
            const next = g === 8 ? 9 : g === 12 ? null : g + 1;
            const prevFilled = prev != null && isFilled(cells?.[prev]);
            const nextFilled = next != null && isFilled(cells?.[next]);
            const isCurrent = currentGrade != null && g === currentGrade;
            const future = currentGrade != null && g > currentGrade;
            const award = markerByGrade.get(g);
            const className = [
              "aj-grade-cell",
              i === 0 ? "is-first" : "",
              i === GRADES.length - 1 ? "is-last" : "",
              filled ? "is-on" : "",
              filled && !prevFilled ? "is-start" : "",
              filled && !nextFilled ? "is-end" : "",
              state === "in_progress" && isCurrent ? "is-now" : "",
              state === "planned" ? "is-planned" : "",
              !filled && state !== "planned" && !future ? "is-track" : "",
              !filled && state !== "planned" && future ? "is-future" : "",
              award ? "is-award" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const cell = (
              <span key={g} className={className} title={award} aria-hidden="true" />
            );
            if (g === 9) {
              const gapOn = isFilled(cells?.[8]) && isFilled(cells?.[9]);
              return [
                <span
                  key="gap"
                  className={gapOn ? "aj-grade-gap is-on" : "aj-grade-gap"}
                  aria-hidden="true"
                />,
                cell,
              ];
            }
            return [cell];
          })}
        </div>
      </div>
    );
  }

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
