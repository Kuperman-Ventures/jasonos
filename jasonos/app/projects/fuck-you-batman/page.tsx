import { format } from "date-fns";
import { getFybStatus } from "@/lib/fuck-you-batman/status";

export const metadata = {
  title: "Fuck You Batman · JasonOS",
  description:
    "Novel narrated by a superhero's supercomputer that slowly goes mad. Project plan, phases and weekly cadence.",
};

export const dynamic = "force-dynamic";

function displayCardTitle(title: string): string {
  return title.replace(/^FYB:\s*/, "");
}

const PROJECT_START = "2026-10-12";

type Phase = {
  number: number;
  name: string;
  startWeek: number;
  endWeek: number;
  start: string;
  end: string;
  output: string;
};

const PHASES: Phase[] = [
  { number: 1, name: "Voice", startWeek: 1, endWeek: 2, start: "2026-10-12", end: "2026-10-25", output: "Style Profile, AI Tells Checklist, calibration test results" },
  { number: 2, name: "Story foundation", startWeek: 3, endWeek: 5, start: "2026-10-26", end: "2026-11-15", output: "Premise, Story Bible, Drift Map, ending" },
  { number: 3, name: "Outline", startWeek: 6, endWeek: 7, start: "2026-11-16", end: "2026-11-29", output: "Scene Outline for the whole book" },
  { number: 4, name: "Sample chapters", startWeek: 8, endWeek: 8, start: "2026-11-30", end: "2026-12-06", output: "Chapters 1-3 drafted, Style Profile adjusted" },
  { number: 5, name: "First draft", startWeek: 9, endWeek: 24, start: "2026-12-07", end: "2027-03-28", output: "Complete first draft, 80,000 words at 5,000 per week" },
  { number: 6, name: "Revision", startWeek: 25, endWeek: 34, start: "2027-03-29", end: "2027-06-06", output: "Five revision passes" },
  { number: 7, name: "Outside readers", startWeek: 35, endWeek: 38, start: "2027-06-07", end: "2027-07-04", output: "Reader feedback, final fixes list" },
  { number: 8, name: "Final polish", startWeek: 39, endWeek: 40, start: "2027-07-05", end: "2027-07-18", output: "Finished manuscript" },
];

const CADENCE = [
  { when: "Monday", what: "Claude sets the week's goals and adds them as JasonOS to-dos (personal track)." },
  { when: "Writing sessions", what: "Jason writes about 1,000 words per session, 5 sessions a week, in Google Docs." },
  { when: "Sunday", what: "Claude reviews the week's pages against the Style Profile, Drift Map and AI Tells Checklist, then emails a status." },
  { when: "Every 4 weeks", what: "Jason reads the month's chapters in one sitting." },
];

const DECISIONS = [
  "Drafting: Jason writes every scene. Claude edits, checks and runs the cadence.",
  "Length: 80,000 words.",
  "The computer's voice deliberately picks up machine-like patterns as it degrades. Each one is planned in the Drift Map. Any machine-like line not in the Drift Map is an error.",
  "Publishing: likely self-publishing. Drafts stay in their original Google Docs, so version history records which text Jason wrote.",
];

function weekNumber(today: Date): number {
  const start = new Date(`${PROJECT_START}T00:00:00-04:00`);
  const days = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return Math.floor(days / 7) + 1;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function FuckYouBatmanPage() {
  const week = weekNumber(new Date());
  const current = PHASES.find((p) => week >= p.startWeek && week <= p.endWeek);
  const statusLabel =
    week < 1 ? "Starts Monday, Oct 12, 2026" : current ? `Week ${week} of 40` : "Plan complete";
  const { openTodos, doneTodos, openCards } = await getFybStatus();
  const hasOpenItems = openCards.length > 0 || openTodos.length > 0;

  return (
    <div className="mx-auto max-w-[720px] space-y-4 px-4 py-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {statusLabel}
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Fuck You Batman</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Novel narrated by a superhero&apos;s supercomputer that slowly goes mad and guides the
          hero toward a hidden purpose. Working name, not the book&apos;s title.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Current phase
        </h2>
        {current ? (
          <>
            <p className="mt-1 text-sm font-semibold">
              Phase {current.number}: {current.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(current.start)} - {formatDate(current.end)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              Output: {current.output}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-foreground/80">
            {week < 1
              ? "Phase 1 (Voice) starts Monday. First task: put 3 to 5 writing samples in the manuscript Drive folder."
              : "All phases complete."}
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          This week
        </h2>
        {!hasOpenItems ? (
          <p className="mt-1 text-sm text-foreground/80">No open Fuck You Batman items.</p>
        ) : (
          <>
            {openCards.length > 0 ? (
              <ul className="mt-2 space-y-3">
                {openCards.map((card) => (
                  <li key={card.id}>
                    <p className="text-sm font-semibold">{displayCardTitle(card.title)}</p>
                    {card.subtitle ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{card.subtitle}</p>
                    ) : null}
                    {card.body?.links?.length ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {card.body.links.map((link) =>
                          link.href.startsWith("/") || link.href.startsWith("mailto:") ? (
                            <a key={link.href} href={link.href} className="text-[11px] underline">
                              {link.label}
                            </a>
                          ) : (
                            <a
                              key={link.href}
                              href={link.href}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] underline"
                            >
                              {link.label}
                            </a>
                          )
                        )}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {openTodos.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-xs">
                {openTodos.map((todo) => (
                  <li key={todo.id} className="flex items-center justify-between gap-2">
                    <span>{todo.title}</span>
                    {todo.due_date ? (
                      <span className="num-mono text-[10px] text-muted-foreground">
                        {format(new Date(todo.due_date), "MMM d")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Recently done
        </h2>
        <ul className="mt-2 space-y-1.5 text-xs">
          {doneTodos.map((todo) => (
            <li key={todo.id} className="flex items-center justify-between gap-2">
              <span>{todo.title}</span>
              <span className="num-mono text-[10px] text-muted-foreground">
                {format(new Date(todo.updated_at), "MMM d")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Phases
        </h2>
        <ol className="mt-2 divide-y text-xs">
          {PHASES.map((p) => {
            const isCurrent = current?.number === p.number;
            const isDone = week > p.endWeek;
            return (
              <li key={p.number} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <p className={isCurrent ? "font-semibold text-foreground" : "text-foreground/80"}>
                    {p.number}. {p.name}
                    {isCurrent ? " (current)" : isDone ? " (done)" : ""}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">{p.output}</p>
                </div>
                <p className="num-mono shrink-0 text-muted-foreground">
                  Wk {p.startWeek === p.endWeek ? p.startWeek : `${p.startWeek}-${p.endWeek}`}
                </p>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          A missed drafting week moves the end date out by a week. Later phases are not compressed.
        </p>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Weekly cadence
        </h2>
        <dl className="mt-2 space-y-2 text-xs">
          {CADENCE.map((c) => (
            <div key={c.when}>
              <dt className="font-semibold text-foreground">{c.when}</dt>
              <dd className="mt-0.5 text-foreground/80">{c.what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Decisions made (Oct 10, 2026)
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-foreground/80">
          {DECISIONS.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Where the work lives
        </h2>
        <ul className="mt-2 space-y-1 text-xs text-foreground/80">
          <li>Full plan, Style Profile, Story Bible, Drift Map: the Fuck You Batman Project in Claude.</li>
          <li>Manuscript: Google Drive folder &quot;Fuck You Batman - Manuscript&quot;, one doc per chapter.</li>
          <li>To-dos: JasonOS To-Dos, personal track, titles start with &quot;FYB:&quot;.</li>
        </ul>
      </section>
    </div>
  );
}
