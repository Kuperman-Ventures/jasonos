"use client";

import { useState } from "react";
import { SafetyBadge } from "./SafetyBadge";
import { SchoolMark } from "./SchoolMark";
import { MobileSchoolSnapshot } from "./MobileSchoolSnapshot";
import {
  interestLabel,
  tierLabel,
  type School,
} from "@/lib/types";

export function CollegesMobileList({ schools }: { schools: School[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = [...schools]
    .filter((school) => !school.archived)
    .sort((a, b) => a.listOrder - b.listOrder);
  const selected = selectedId
    ? rows.find((school) => school.id === selectedId) ?? null
    : null;

  if (selected) {
    return (
      <MobileSchoolSnapshot
        school={selected}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <section className="colleges-mobile" data-viewport="mobile" aria-label="College list">
      <header className="colleges-mobile-head">
        <h1>College list</h1>
        <p className="colleges-mobile-count">
          {rows.length} school{rows.length === 1 ? "" : "s"}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="colleges-mobile-empty">No schools on the list yet.</p>
      ) : (
        <ul className="colleges-mobile-list">
          {rows.map((school) => {
            const selectivity = tierLabel(school.selectivityTier) || "—";
            const interest = interestLabel(school.interestLevel) || "—";
            return (
              <li key={school.id}>
                <button
                  type="button"
                  className="colleges-mobile-row"
                  data-level={school.interestLevel || undefined}
                  onClick={() => setSelectedId(school.id)}
                >
                  <span className="colleges-mobile-name">
                    <SchoolMark name={school.name} website={school.website} />
                    <span>
                      {school.name}
                      <SafetyBadge school={school} />
                    </span>
                  </span>
                  <span className="colleges-mobile-meta">
                    <span className="colleges-mobile-tier">{selectivity}</span>
                    <span
                      className="colleges-mobile-interest"
                      data-level={school.interestLevel || undefined}
                    >
                      {interest}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
