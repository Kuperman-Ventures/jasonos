import Link from "next/link";
import { FUTURE_ENTRIES, otherLiveEntries } from "@/lib/iugr/episodes";

export function IugrLibraryList({ currentId }: { currentId: string }) {
  const live = otherLiveEntries(currentId);
  return (
    <div className="iugr-deck-menu-other">
      {live.length ? (
        <>
          <h3>Live entries</h3>
          <ul>
            {live.map((entry) => (
              <li key={entry.id}>
                <Link href={entry.href}>{entry.title}</Link>
                <span className="iugr-deck-menu-status">
                  Entry {String(entry.entryNumber).padStart(2, "0")} · {entry.statusLabel}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>Coming soon</h3>
      <ul>
        {FUTURE_ENTRIES.map((entry) => (
          <li key={entry.id}>
            <span>{entry.title}</span>
            <span className="iugr-deck-menu-status">{entry.statusLabel}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
