import Link from "next/link";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fybMarkdownComponents } from "@/components/jasonos/fuck-you-batman/markdown";
import { chosenAnswerLabel } from "@/lib/fuck-you-batman/logic";
import { PHASES, TOTAL_WEEKS, currentPhase, isPhaseDone, weekNumber } from "@/lib/fuck-you-batman/plan";
import { getFybStatus } from "@/lib/fuck-you-batman/status";
import { FYB_BIBLE_KINDS, FYB_DRIFT_KINDS, FYB_SCENE_KINDS, type FybEntry, type FybEntryKind } from "@/lib/fuck-you-batman/types";
import { loadFybDecisions, loadFybEntries } from "@/lib/server-actions/fuck-you-batman";

export const metadata = {
  title: "Fuck You Batman · JasonOS",
  description:
    "Novel narrated by a superhero's supercomputer that slowly goes mad. Project plan, phases and weekly cadence.",
};

export const dynamic = "force-dynamic";

function displayCardTitle(title: string): string {
  return title.replace(/^FYB:\s*/, "");
}

function WaitingCounts({
  href,
  label,
  counts,
}: {
  href: string;
  label: string;
  counts: { draft: number; changes: number };
}) {
  const parts: string[] = [];
  if (counts.draft) parts.push(`${counts.draft} draft${counts.draft === 1 ? "" : "s"}`);
  if (counts.changes) {
    parts.push(`${counts.changes} change${counts.changes === 1 ? "" : "s"} requested`);
  }
  if (!parts.length) return null;
  return (
    <li>
      <Link href={href} className="underline">
        {label}: {parts.join(", ")}
      </Link>
    </li>
  );
}

function reviewCounts(entries: FybEntry[], kinds: FybEntryKind[]) {
  const subset = entries.filter((entry) => kinds.includes(entry.kind));
  return {
    draft: subset.filter((entry) => entry.status === "draft").length,
    changes: subset.filter((entry) => entry.status === "changes_requested").length,
  };
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function FuckYouBatmanPage() {
  const week = weekNumber();
  const current = currentPhase(week);
  const statusLabel =
    week < 1 ? "Starts Monday, Oct 12, 2026" : current ? `Week ${week} of ${TOTAL_WEEKS}` : "Plan complete";
  const [{ openTodos, doneTodos, openCards }, decisions, entries, referenceEntries] = await Promise.all([
    getFybStatus(),
    loadFybDecisions(),
    loadFybEntries(),
    loadFybEntries("reference"),
  ]);
  const processGuide = referenceEntries.find((entry) => entry.entry_key === "process-guide");
  const hasOpenItems = openCards.length > 0 || openTodos.length > 0;
  const dueThisWeek = decisions.filter((d) => d.status === "open" && d.week === week);
  const bibleCounts = reviewCounts(entries, FYB_BIBLE_KINDS);
  const driftCounts = reviewCounts(entries, FYB_DRIFT_KINDS);
  const sceneCounts = reviewCounts(entries, FYB_SCENE_KINDS);
  const waitingEmpty =
    dueThisWeek.length === 0 &&
    bibleCounts.draft + bibleCounts.changes + driftCounts.draft + driftCounts.changes + sceneCounts.draft + sceneCounts.changes === 0;
  const decided = decisions
    .filter((d) => d.status === "decided")
    .slice()
    .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""));

  return (
    <>
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
              ? "Phase 1 (Voice) is done. Story foundation starts Monday. First story work: ending, hidden purpose, Story Bible, Drift Map, tense."
              : "All phases complete."}
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Waiting on you
        </h2>
        {waitingEmpty ? (
          <p className="mt-1 text-sm text-foreground/80">Nothing waiting on you.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {dueThisWeek.map((decision) => (
              <li key={decision.id}>
                <Link href="/projects/fuck-you-batman/decisions" className="underline">
                  {decision.question}
                </Link>
              </li>
            ))}
            <WaitingCounts href="/projects/fuck-you-batman/bible" label="Story Bible" counts={bibleCounts} />
            <WaitingCounts href="/projects/fuck-you-batman/drift" label="Drift Map" counts={driftCounts} />
            <WaitingCounts href="/projects/fuck-you-batman/scenes" label="Scenes" counts={sceneCounts} />
          </ul>
        )}
      </section>

      {processGuide ? (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            How the book gets made
          </h2>
          <details open className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Show or hide the process
            </summary>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={fybMarkdownComponents}>
              {processGuide.body_md}
            </ReactMarkdown>
          </details>
        </section>
      ) : null}

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
        {doneTodos.length === 0 ? (
          <p className="mt-1 text-sm text-foreground/80">Nothing marked done yet.</p>
        ) : (
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
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Phases
        </h2>
        <ol className="mt-2 divide-y text-xs">
          {PHASES.map((p) => {
            const isCurrent = current?.number === p.number;
            const isDone = isPhaseDone(p, week);
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
                  {p.startWeek === 0
                    ? "done"
                    : p.startWeek === p.endWeek
                      ? `Wk ${p.startWeek}`
                      : `Wk ${p.startWeek}-${p.endWeek}`}
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
          Decisions made
        </h2>
        {decided.length === 0 ? (
          <p className="mt-1 text-sm text-foreground/80">None recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs text-foreground/80">
            {decided.map((d) => (
              <li key={d.id}>
                <p className="font-semibold text-foreground">{d.question}</p>
                <p className="mt-0.5">{chosenAnswerLabel(d)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Where the work lives
        </h2>
        <ul className="mt-2 space-y-1 text-xs text-foreground/80">
          <li>
            Decisions and story reference: JasonOS (
            <Link href="/projects/fuck-you-batman/decisions" className="underline">
              Decisions
            </Link>
            ,{" "}
            <Link href="/projects/fuck-you-batman/reference" className="underline">
              Reference
            </Link>
            ).
          </li>
          <li>
            Manuscript: Google Docs. Early sketches are in the &quot;FYB&quot; doc; chapters go in the Drive
            folder &quot;Fuck You Batman - Manuscript&quot;, one doc per chapter, from Phase 4.
          </li>
          <li>Weekly snapshot: the Drive Planning folder.</li>
          <li>To-dos: JasonOS To-Dos, personal track, titles start with &quot;FYB:&quot;.</li>
        </ul>
      </section>
    </>
  );
}
