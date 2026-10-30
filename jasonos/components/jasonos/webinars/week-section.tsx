import ReactMarkdown from "react-markdown";
import type { WebinarsPageWeek } from "@/lib/webinars/store";
import { CandidateRow } from "./candidate-row";
import { SessionCard } from "./session-card";

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 text-sm last:mb-0">{children}</ul>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-2 text-sm font-semibold">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1 text-sm font-semibold">{children}</h3>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} className="underline underline-offset-2" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

export function WeekSection({ week }: { week: WebinarsPageWeek }) {
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">{week.week_label}</h2>
        <p className="text-xs text-muted-foreground">
          {week.confirmed.length} confirmed session
          {week.confirmed.length === 1 ? "" : "s"}
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-4">
        {week.digest ? (
          <ReactMarkdown components={markdownComponents}>
            {week.digest.body_md}
          </ReactMarkdown>
        ) : (
          <p className="text-sm text-muted-foreground">
            Digest publishes Friday evening.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {week.confirmed.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            takeaways={session.takeaways}
          />
        ))}
      </div>

      {week.candidates.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Candidates</h3>
          {week.candidates.map((session) => (
            <CandidateRow key={session.id} session={session} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
