"use client";

export function FamilyMeetingPrintButton() {
  return (
    <button type="button" className="primary" onClick={() => window.print()}>
      Print / Save PDF
    </button>
  );
}
