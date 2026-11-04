import Link from "next/link";
import { TrackPill } from "@/components/jasonos/track-pill";
import type { Track } from "@/lib/types";
import type { TopicTakeawayView, WebinarTopicRow } from "@/lib/webinars/store";

function countPhrase(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatSessionDate(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return ymd;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function TopicTakeaways({
  topic,
  takeaways,
  takeawayCount,
  sessionCount,
}: {
  topic: WebinarTopicRow;
  takeaways: TopicTakeawayView[];
  takeawayCount: number;
  sessionCount: number;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/webinars"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Webinars
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{topic.name}</h1>
        {topic.description ? (
          <p className="text-sm text-muted-foreground">{topic.description}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {countPhrase(takeawayCount, "takeaway", "takeaways")} from{" "}
          {countPhrase(sessionCount, "session", "sessions")}
        </p>
      </header>

      {takeaways.length ? (
        <ul className="space-y-4">
          {takeaways.map((takeaway) => (
            <li key={takeaway.id} className="border-l-2 border-border pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-foreground">{takeaway.text}</p>
                {takeaway.track ? <TrackPill track={takeaway.track as Track} /> : null}
                {takeaway.is_action ? (
                  takeaway.card_id ? (
                    <Link
                      href={`/?card=${takeaway.card_id}`}
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
              {takeaway.relevance_note ? (
                <p className="mt-1 text-xs text-muted-foreground">{takeaway.relevance_note}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {takeaway.transcript_url ? (
                  <a
                    href={takeaway.transcript_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {takeaway.session_title}
                  </a>
                ) : (
                  <span>{takeaway.session_title}</span>
                )}
                {" · "}
                {formatSessionDate(takeaway.session_date)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No takeaways in this topic yet.</p>
      )}
    </div>
  );
}
