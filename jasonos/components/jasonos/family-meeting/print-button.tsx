"use client";

export function FamilyMeetingPrintButton() {
  return (
    <button
      type="button"
      className="primary"
      onClick={() => {
        // Give fit-to-page a tick to remeasure before the print dialog.
        window.dispatchEvent(new Event("resize"));
        requestAnimationFrame(() => window.print());
      }}
    >
      Print / Save PDF
    </button>
  );
}
