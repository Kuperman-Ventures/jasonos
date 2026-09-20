"use client";

export function NotesTab({
  notes,
  saveState,
  onChange,
  dateline,
}: {
  notes: string;
  saveState: string;
  onChange: (value: string) => void;
  dateline: string;
}) {
  return (
    <section>
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Notes</h2>
        </div>
      </header>
      <p className="section-sub">
        Family notes, open questions, and decisions as you make them. Shared with anyone who has this page open.
      </p>
      <textarea className="notes" id="notes" value={notes} placeholder="Start typing..." onChange={(event) => onChange(event.target.value)} />
      <div className="save-state">{saveState}</div>
    </section>
  );
}
