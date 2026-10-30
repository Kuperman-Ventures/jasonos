import Link from "next/link";
import { TrackPill } from "@/components/jasonos/track-pill";
import type { Track } from "@/lib/types";
import type { WebinarTakeawayRow } from "@/lib/webinars/store";

export function TakeawayList({
  takeaways,
}: {
  takeaways: WebinarTakeawayRow[];
}) {
  if (!takeaways.length) {
    return (
      <p className="text-sm text-muted-foreground">No takeaways published yet.</p>
    );
  }
  return (
    <ul className="space-y-3">
      {takeaways.map((t) => (
        <li key={t.id} className="border-l-2 border-border pl-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-foreground">{t.text}</p>
            {t.track ? <TrackPill track={t.track as Track} /> : null}
            {t.is_action ? (
              t.card_id ? (
                <Link
                  href={`/?card=${t.card_id}`}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  Action
                </Link>
              ) : (
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Action
                </span>
              )
            ) : null}
          </div>
          {t.relevance_note ? (
            <p className="mt-1 text-xs text-muted-foreground">{t.relevance_note}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
