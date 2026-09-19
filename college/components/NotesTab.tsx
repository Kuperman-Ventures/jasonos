"use client";

export function NotesTab({
  notes,
  saveState,
  onChange,
}: {
  notes: string;
  saveState: string;
  onChange: (value: string) => void;
}) {
  return (
    <section>
      <h2 className="section-title">Notes</h2>
      <p className="section-sub">
        Family notes, open questions, and decisions as you make them. Shared with anyone who has this page open.
      </p>
      <textarea className="notes" id="notes" value={notes} placeholder="Start typing..." onChange={(event) => onChange(event.target.value)} />
      <div className="save-state">{saveState}</div>
    </section>
  );
}
