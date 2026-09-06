import { FUTURE_ENTRIES } from "@/lib/iugr/episodes";
import { SERIES } from "@/lib/iugr/copy";

export function FieldNoteLibrary() {
  return (
    <footer className="iugr-footer">
      <div className="iugr-footer-mark">{SERIES.libraryLabel}</div>
      <ul className="iugr-future-list">
        {FUTURE_ENTRIES.map((entry) => (
          <li key={entry.id} className="iugr-future-item">
            <span>{entry.title}</span>
            <span>{entry.statusLabel}</span>
          </li>
        ))}
      </ul>
    </footer>
  );
}
