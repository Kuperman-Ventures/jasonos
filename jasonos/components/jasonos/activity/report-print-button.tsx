"use client";

// A small on-screen control that generates the weekly-review PDF via the
// browser's print-to-PDF ("Save as PDF"). The report's print CSS (Letter page
// size + break-inside rules) makes the page breaks land between sections and
// never mid-row. Hidden when printing (via the toolbar's report-no-print class).

export function ReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        fontFamily: '"Source Serif 4", Georgia, serif',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: "#f3f2f2",
        background: "#201e1d",
        border: "none",
        borderRadius: 6,
        padding: "8px 14px",
        cursor: "pointer",
        boxShadow: "0 3px 10px color-mix(in srgb, #2d2b2b 22%, transparent)",
        whiteSpace: "nowrap",
      }}
    >
      Download PDF
    </button>
  );
}
