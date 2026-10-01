"use client";

import { SchoolMark } from "./SchoolMark";
import { websiteHref } from "@/lib/school-photo";
import {
  interestLabel,
  tierLabel,
  type School,
} from "@/lib/types";

export function CollegesMobileList({ schools }: { schools: School[] }) {
  const rows = [...schools]
    .filter((school) => !school.archived)
    .sort((a, b) => a.listOrder - b.listOrder);

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
            const href = websiteHref(school.website);
            const selectivity = tierLabel(school.selectivityTier) || "—";
            const interest = interestLabel(school.interestLevel) || "—";
            const body = (
              <>
                <span className="colleges-mobile-name">
                  <SchoolMark name={school.name} website={school.website} />
                  <span>{school.name}</span>
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
              </>
            );
            return (
              <li key={school.id}>
                {href ? (
                  <a
                    className="colleges-mobile-row"
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    data-level={school.interestLevel || undefined}
                  >
                    {body}
                  </a>
                ) : (
                  <div
                    className="colleges-mobile-row is-static"
                    data-level={school.interestLevel || undefined}
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
