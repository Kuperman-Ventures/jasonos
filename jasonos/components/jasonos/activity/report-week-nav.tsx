import type { CSSProperties } from "react";
import Link from "next/link";

// Prev / next week controls for the networking report. Hidden when printing
// so the PDF stays a clean single-week document.

function weekHref(weekStart: string): string {
  return `/activity?week=${weekStart}`;
}

const linkStyle: CSSProperties = {
  fontFamily: '"Source Serif 4", Georgia, serif',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: "#201e1d",
  textDecoration: "none",
  background: "#f3f2f2",
  border: "1px solid color-mix(in srgb, #201e1d 18%, transparent)",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 2px 6px color-mix(in srgb, #2d2b2b 12%, transparent)",
};

const disabledStyle: CSSProperties = {
  ...linkStyle,
  color: "#7d7979",
  cursor: "default",
  boxShadow: "none",
  opacity: 0.7,
};

export function ReportWeekNav({
  prevWeekStart,
  nextWeekStart,
  isCurrentWeek,
}: {
  prevWeekStart: string;
  nextWeekStart: string | null;
  isCurrentWeek: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <Link href={weekHref(prevWeekStart)} style={linkStyle} prefetch={false}>
        &larr; Previous week
      </Link>
      {!isCurrentWeek ? (
        <Link href="/activity" style={linkStyle} prefetch={false}>
          This week
        </Link>
      ) : null}
      {nextWeekStart ? (
        <Link href={weekHref(nextWeekStart)} style={linkStyle} prefetch={false}>
          Next week &rarr;
        </Link>
      ) : (
        <span style={disabledStyle} aria-disabled="true">
          Next week &rarr;
        </span>
      )}
    </div>
  );
}
