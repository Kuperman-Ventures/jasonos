"use client";

import { useMemo } from "react";
import {
  classStanding,
  currentGrade,
  graduationYearOptions,
} from "@/lib/activities-journal";

export function GraduationYearPicker({
  classOf,
  onPick,
  headingId = "rec-year-q",
  compact = false,
}: {
  classOf: number | null | undefined;
  onPick: (year: number) => void;
  headingId?: string;
  compact?: boolean;
}) {
  const years = useMemo(() => graduationYearOptions(), []);
  const standing = classStanding(currentGrade(classOf ?? undefined));
  return (
    <div className={compact ? "rec-year is-compact" : "rec-year"}>
      <p className="aj-recall-year-q" id={headingId}>
        What year do you graduate from high school?
      </p>
      <div className="aj-recall-years" role="group" aria-labelledby={headingId}>
        {years.map((y) => (
          <button
            key={y}
            type="button"
            aria-pressed={classOf === y}
            onClick={() => onPick(y)}
          >
            {y}
          </button>
        ))}
      </div>
      {classOf && standing ? (
        <p className="aj-recall-year-note">That makes you a {standing} this year.</p>
      ) : (
        <p className="aj-recall-year-note" />
      )}
    </div>
  );
}
