import Link from "next/link";
import { format } from "date-fns";
import { NextStepCard } from "@/components/jasonos/fuck-you-batman/next-step-card";
import { ProcessGuide } from "@/components/jasonos/fuck-you-batman/process-guide";
import { chosenAnswerLabel } from "@/lib/fuck-you-batman/logic";
import { TOTAL_WEEKS, currentPhase, weekNumber } from "@/lib/fuck-you-batman/plan";
import {
  QUESTION_SETS,
  displayQuestion,
  isProvisional,
  isQuestion,
  questionSet,
} from "@/lib/fuck-you-batman/process";
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

export default async function FuckYouBatmanPage() {
  const week = weekNumber();
  const current = currentPhase(week);
  const statusLabel =
    week < 1 ? "Starts Monday, Oct 12, 2026" : current ? `Week ${week} of ${TOTAL_WEEKS}` : "Plan complete";
  const [{ openTodos, doneTodos, openCards }, decisions, entries] = await Promise.all([
    getFybStatus(),
    loadFybDecisions(),
    loadFybEntries(),
  ]);
  const hasOpenItems = openCards.length > 0 || openTodos.length > 0;
  const openQuestionGroups = Object.keys(QUESTION_SETS)
    .map((set) => {
      const cards = decisions.filter((d) => isQuestion(d) && questionSet(d) === set);
      const open = cards.filter((d) => d.status === "open").length;
      return { set, label: QUESTION_SETS[set], open, total: cards.length };
    })
    .filter((group) => group.open > 0);
  const dueThisWeek = decisions.filter((d) => d.status === "open" && !isQuestion(d) && d.week === week);
  const bibleCounts = reviewCounts(entries, FYB_BIBLE_KINDS);
  const driftCounts = reviewCounts(entries, FYB_DRIFT_KINDS);
  const sceneCounts = reviewCounts(entries, FYB_SCENE_KINDS);
  const waitingEmpty =
    openQuestionGroups.length === 0 &&
    dueThisWeek.length === 0 &&
    bibleCounts.draft + bibleCounts.changes + driftCounts.draft + driftCounts.changes + sceneCounts.draft + sceneCounts.changes === 0;
  const decided = decisions
    .filter((d) => d.status === "decided" && !isQuestion(d))
    .slice()
    .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""));
  const questionsAnswered = decisions.filter((d) => isQuestion(d) && d.status === "decided").length;

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

      <NextStepCard week={week} decisions={decisions} entries={entries} />

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Waiting on you
        </h2>
        {waitingEmpty ? (
          <p className="mt-1 text-sm text-foreground/80">Nothing waiting on you.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {openQuestionGroups.map((group) => (
              <li key={group.set}>
                <Link href={`/projects/fuck-you-batman/decisions#set-${group.set}`} className="underline">
                  {group.label}: {group.open} of {group.total} questions open
                </Link>
              </li>
            ))}
            {dueThisWeek.map((decision) => (
              <li key={decision.id}>
                <Link href={`/projects/fuck-you-batman/decisions#${decision.decision_key}`} className="underline">
                  {displayQuestion(decision)}
                </Link>
              </li>
            ))}
            <WaitingCounts href="/projects/fuck-you-batman/bible" label="Story Bible" counts={bibleCounts} />
            <WaitingCounts href="/projects/fuck-you-batman/drift" label="Drift Map" counts={driftCounts} />
            <WaitingCounts href="/projects/fuck-you-batman/scenes" label="Scenes" counts={sceneCounts} />
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <ProcessGuide week={week} decisions={decisions} entries={entries} />
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
          Decisions made
        </h2>
        {decided.length === 0 && questionsAnswered === 0 ? (
          <p className="mt-1 text-sm text-foreground/80">None recorded yet.</p>
        ) : (
          <>
            {decided.length > 0 ? (
              <ul className="mt-2 space-y-2 text-xs text-foreground/80">
                {decided.map((d) => (
                  <li key={d.id}>
                    <p className="font-semibold text-foreground">
                      {displayQuestion(d)}
                      {isProvisional(d) ? (
                        <span className="ml-1 rounded-full border px-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                          Provisional
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5">{chosenAnswerLabel(d)}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className={decided.length > 0 ? "mt-2 text-xs text-muted-foreground" : "mt-1 text-xs text-muted-foreground"}>
              {questionsAnswered} questions answered.{" "}
              <Link href="/projects/fuck-you-batman/decisions" className="underline">
                See your answers
              </Link>
            </p>
          </>
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
