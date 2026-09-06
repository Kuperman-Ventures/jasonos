"use client";

import type { GuideId } from "@/lib/iugr/types";

type GuideSigilProps = {
  guideId: GuideId;
  title?: string;
  className?: string;
};

/** Abstract field-guide marks — inline SVG only, no external imagery. */
export function GuideSigil({
  guideId,
  title,
  className = "iugr-sigil",
}: GuideSigilProps) {
  if (guideId === "mira") {
    return (
      <svg className={className} viewBox="0 0 48 48" role="img" aria-label={title ?? "Mira sigil"}>
        <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeOpacity="0.35" />
        <circle cx="24" cy="24" r="7" fill="currentColor" fillOpacity="0.2" stroke="currentColor" />
        <path d="M10 30c6-12 22-16 30-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="38" cy="24" r="2" fill="currentColor" />
      </svg>
    );
  }

  if (guideId === "dr-maybe") {
    return (
      <svg className={className} viewBox="0 0 48 48" role="img" aria-label={title ?? "Dr. Maybe sigil"}>
        <circle cx="20" cy="20" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M27 27l10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M17 16c0-2.2 1.7-4 3.8-4 2 0 3.5 1.4 3.5 3.4 0 2.2-1.5 3-2.7 3.8-.8.5-1.4 1.1-1.4 2.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="20.2" cy="26.5" r="1.2" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 48 48" role="img" aria-label={title ?? "The Guide sigil"}>
      <rect x="10" y="12" width="28" height="24" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 12v24" stroke="currentColor" strokeOpacity="0.45" />
      <path
        d="M24 18l2.2 4.4 4.8.4-3.7 3.2 1.2 4.7L24 28.2 19.5 30.7l1.2-4.7-3.7-3.2 4.8-.4z"
        fill="currentColor"
        fillOpacity="0.85"
      />
      <circle
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeDasharray="2 4"
      />
    </svg>
  );
}
