import Link from "next/link";
import { FUTURE_ENTRIES, otherLiveEntries } from "@/lib/iugr/episodes";
import { SERIES } from "@/lib/iugr/copy";

export function FieldNoteLibrary({ currentId }: { currentId: string }) {
  const live = otherLiveEntries(currentId);
  return (
    <footer className="iugr-footer">
      <div className="iugr-footer-mark">{SERIES.libraryLabel}</div>
      <ul className="iugr-future-list">
        {live.map((entry) => (
          <li key={entry.id} className="iugr-future-item is-live">
            <Link href={entry.href}>{entry.title}</Link>
            <span>
              Entry {String(entry.entryNumber).padStart(2, "0")} · {entry.statusLabel}
            </span>
          </li>
        ))}
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
