import ReactMarkdown from "react-markdown";
import type { WebinarSessionRow, WebinarTakeawayRow } from "@/lib/webinars/store";
import { TakeawayList } from "./takeaway-list";

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 text-sm last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 text-sm last:mb-0">{children}</ol>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} className="underline underline-offset-2" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

function speakersLine(speakers: unknown): string | null {
  if (!Array.isArray(speakers) || !speakers.length) return null;
  const names = speakers
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const row = s as { name?: string; title?: string; org?: string };
      if (!row.name) return null;
      const bits = [row.name, row.title, row.org].filter(Boolean);
      return bits.join(", ");
    })
    .filter(Boolean);
  return names.length ? names.join(" · ") : null;
}

export function SessionCard({
  session,
  takeaways,
}: {
  session: WebinarSessionRow;
  takeaways: WebinarTakeawayRow[];
}) {
  const speakers = speakersLine(session.speakers);
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 space-y-1">
        <h3 className="text-base font-semibold text-foreground">{session.title}</h3>
        <p className="text-xs text-muted-foreground">
          {[session.host_org || null, session.session_date, speakers]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {session.transcript_url ? (
          <a
            href={session.transcript_url}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
          >
            Open transcript
          </a>
        ) : null}
      </header>
      {session.summary_md ? (
        <div className="mb-4 text-foreground">
          <ReactMarkdown components={markdownComponents}>
            {session.summary_md}
          </ReactMarkdown>
        </div>
      ) : null}
      <TakeawayList takeaways={takeaways} />
    </article>
  );
}
