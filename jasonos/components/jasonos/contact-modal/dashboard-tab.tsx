"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ModalSectionTitle,
  WordPill,
  modalGhostLinkClass,
  modalSecondaryClass,
} from "@/components/jasonos/contact-modal/parts";
import { briefSourceLinkLabel } from "@/lib/outreach/relationship-brief";
import type {
  BriefCitedItem,
  BriefCommitment,
  BriefCommitmentStatus,
  BriefStats,
  RelationshipBrief,
} from "@/lib/outreach/relationship-brief-types";
import {
  generateRelationshipBrief,
  getRelationshipBrief,
  markBriefCommitmentDone,
} from "@/lib/server-actions/relationship-brief";

export type DashboardJump =
  | { tab: "engage"; section?: "log-touch" | "engagements" }
  | { tab: "meetings"; section?: "generate-intro" };

const COMMITMENT_ORDER: BriefCommitmentStatus[] = [
  "overdue",
  "open",
  "awaiting",
  "done",
];

function commitmentTone(
  status: BriefCommitmentStatus
): "cyan" | "yellow" | "magenta" | "ink" {
  if (status === "overdue") return "magenta";
  if (status === "awaiting") return "cyan";
  if (status === "done") return "ink";
  return "yellow";
}

function commitmentLabel(
  item: BriefCommitment
): string {
  if (item.status === "awaiting") return "AWAITING";
  if (item.status === "overdue") return "OVERDUE";
  if (item.status === "done") return "DONE";
  if (item.due) return "REQUEST DUE";
  return "OPEN";
}

function fmtGenerated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CitedList({
  items,
  onJump,
}: {
  items: BriefCitedItem[];
  onJump: (jump: DashboardJump) => void;
}) {
  return (
    <ul>
      {items.map((item, i) => (
        <li key={`${item.source.id}-${i}`} className="flex items-baseline justify-between gap-3 border-b border-[var(--color-divider)] py-3 last:border-b-0">
          <p className="min-w-0 flex-1 text-[16px] font-normal text-[var(--color-text)]">
            {item.text}
          </p>
          <button
            type="button"
            onClick={() =>
              onJump(
                item.source.type === "meeting"
                  ? { tab: "meetings" }
                  : { tab: "engage", section: "engagements" }
              )
            }
            className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-accent-700)] hover:text-[var(--color-accent-800)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)]"
          >
            {briefSourceLinkLabel(item.source)}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function DashboardTab({
  contactId,
  onJump,
}: {
  contactId: string;
  onJump: (jump: DashboardJump) => void;
}) {
  const [brief, setBrief] = useState<RelationshipBrief | null>(null);
  const [stats, setStats] = useState<BriefStats>({
    meetingsHeld: 0,
    introsOffered: 0,
    introsMade: 0,
    daysSinceLastTouch: null,
  });
  const [hasMaterial, setHasMaterial] = useState(false);
  const [promptVersion, setPromptVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startPending] = useTransition();
  const [offerStale, setOfferStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(null);
    getRelationshipBrief(contactId)
      .then((res) => {
        if (cancelled) return;
        setBrief(res.brief);
        setStats(res.stats);
        setHasMaterial(res.hasMaterial);
        setPromptVersion(res.promptVersion);
        setOfferStale(Boolean(res.brief?.stale));
        setLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load brief.");
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const generate = (persist: boolean) => {
    startPending(async () => {
      setError(null);
      const res = await generateRelationshipBrief({ contactId, persist });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBrief(res.brief);
      setStats(res.stats);
      setHasMaterial(true);
      setOfferStale(false);
    });
  };

  const markDone = (text: string) => {
    startPending(async () => {
      const res = await markBriefCommitmentDone({ contactId, text });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBrief(res.brief);
    });
  };

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 py-6 text-[13px] text-[var(--jos-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading brief…
      </div>
    );
  }

  const olderPrompt =
    brief && promptVersion > 0 && brief.promptVersion < promptVersion;

  return (
    <div className="flex flex-col gap-[30px]">
      {error ? (
        <div className="bg-rung-1 px-3.5 py-2.5 text-[13px] font-semibold">
          Brief failed. {error}{" "}
          <button
            type="button"
            onClick={() => generate(true)}
            className={cn(modalGhostLinkClass, "ml-1 text-[var(--color-bg)]")}
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ModalSectionTitle>Relationship brief</ModalSectionTitle>
          {brief ? (
            <p className="mt-1 text-[13px] font-normal text-[var(--jos-muted)]">
              Generated {fmtGenerated(brief.generatedAt)}
              {brief.sources.length ? ` from ${brief.sources.join(", ")}` : ""}
              {brief.stale ? (
                <WordPill tone="yellow" className="ml-2 align-middle">
                  Stale
                </WordPill>
              ) : null}
              {olderPrompt ? (
                <span className="ml-2 text-[12px] font-medium">Older prompt</span>
              ) : null}{" "}
              <a href="/settings#relationship-brief" className={modalGhostLinkClass}>
                Edit prompt in Settings
              </a>
            </p>
          ) : (
            <p className="mt-1 text-[13px] font-normal text-[var(--jos-muted)]">
              Needs at least one email or meeting. Load latest context on Engage
              first.
            </p>
          )}
        </div>
        {brief ? (
          <Button
            type="button"
            variant="outline"
            className={cn(modalSecondaryClass, "min-w-[9.5rem]")}
            disabled={pending}
            onClick={() => generate(true)}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {pending ? "Writing brief..." : "Regenerate"}
          </Button>
        ) : (
          <Button
            type="button"
            className="min-w-[9.5rem]"
            disabled={pending || !hasMaterial}
            onClick={() => generate(true)}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending ? "Writing brief..." : "Generate brief"}
          </Button>
        )}
      </div>

      {!brief ? (
        !hasMaterial ? (
          <p className="text-[13px] text-[var(--jos-muted)]">
            <button
              type="button"
              className={modalGhostLinkClass}
              onClick={() => onJump({ tab: "engage", section: "engagements" })}
            >
              Open Engage
            </button>{" "}
            to load context, then come back.
          </p>
        ) : null
      ) : (
        <>
          {offerStale ? (
            <p className="text-[13px] text-[var(--jos-muted)]">
              This brief is stale.{" "}
              <button
                type="button"
                className={modalGhostLinkClass}
                onClick={() => generate(true)}
              >
                Regenerate now
              </button>
            </p>
          ) : null}

          {brief.summary ? (
            <p className="text-[17px] leading-[1.55] font-normal text-[var(--color-text)]">
              {brief.summary}
            </p>
          ) : null}

          <div className="border-t-2 border-[var(--color-text)] pt-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(
                [
                  ["Meetings held", stats.meetingsHeld],
                  ["Intros offered", stats.introsOffered],
                  ["Intros made", stats.introsMade],
                  [
                    "Days since last touch",
                    stats.daysSinceLastTouch ?? "—",
                  ],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <div className="text-[40px] font-black tracking-[-0.03em] tabular-nums text-[var(--color-text)]">
                    {value}
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {brief.nextMove ? (
            <div
              className={cn(
                "flex items-start justify-between gap-3 px-[18px] py-4",
                brief.nextMove.tone === "magenta"
                  ? "bg-rung-1"
                  : brief.nextMove.tone === "cyan"
                    ? "bg-rung-3"
                    : "bg-rung-2"
              )}
            >
              <div className="min-w-0">
                <p className="text-[12px] font-extrabold uppercase tracking-[0.06em]">
                  Suggested next move
                </p>
                <p className="mt-1 text-[18px] font-extrabold leading-snug">
                  {brief.nextMove.text}
                </p>
              </div>
              <Button
                type="button"
                className={cn(
                  "shrink-0",
                  brief.nextMove.tone === "yellow"
                    ? "bg-[var(--color-text)] text-[var(--color-bg)] hover:bg-[var(--color-neutral-700)]"
                    : "border border-[var(--color-bg)] bg-transparent text-[var(--color-bg)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                )}
                onClick={() =>
                  onJump(
                    brief.nextMove?.jump === "generate_intro"
                      ? { tab: "meetings", section: "generate-intro" }
                      : { tab: "engage", section: "log-touch" }
                  )
                }
              >
                Log touch
              </Button>
            </div>
          ) : null}

          {brief.helped.length ? (
            <section>
              <ModalSectionTitle className="mb-1">
                How they have helped
              </ModalSectionTitle>
              <CitedList items={brief.helped} onJump={onJump} />
            </section>
          ) : null}

          {brief.topics.length ? (
            <section>
              <ModalSectionTitle className="mb-1">
                What they have talked about
              </ModalSectionTitle>
              <CitedList items={brief.topics} onJump={onJump} />
            </section>
          ) : null}

          {brief.commitments.length ? (
            <section>
              <div className="grid grid-cols-1 gap-4 border-t-2 border-[var(--color-text)] pt-3 sm:grid-cols-2">
                {(
                  [
                    ["They offered me", "theirs"],
                    ["I offered them", "mine"],
                  ] as const
                ).map(([kicker, direction]) => {
                  const items = brief.commitments
                    .filter((c) => c.direction === direction)
                    .sort(
                      (a, b) =>
                        COMMITMENT_ORDER.indexOf(a.status) -
                        COMMITMENT_ORDER.indexOf(b.status)
                    );
                  if (!items.length) return null;
                  return (
                    <div key={direction}>
                      <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--jos-muted)]">
                        {kicker}
                      </p>
                      <div className="space-y-2">
                        {items.map((item, i) => (
                          <div
                            key={`${item.text}-${i}`}
                            className="bg-[var(--color-surface)] px-3.5 py-3"
                          >
                            <p className="text-[15px] font-semibold">{item.text}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <WordPill tone={commitmentTone(item.status)}>
                                {commitmentLabel(item)}
                              </WordPill>
                              <button
                                type="button"
                                className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-accent-700)]"
                                onClick={() =>
                                  onJump(
                                    item.source.type === "meeting"
                                      ? { tab: "meetings" }
                                      : { tab: "engage", section: "engagements" }
                                  )
                                }
                              >
                                {briefSourceLinkLabel(item.source)}
                              </button>
                              {item.status !== "done" ? (
                                <button
                                  type="button"
                                  className={modalGhostLinkClass}
                                  onClick={() => markDone(item.text)}
                                >
                                  Mark done
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {brief.remember.length ? (
            <section>
              <ModalSectionTitle className="mb-1">Worth remembering</ModalSectionTitle>
              <CitedList items={brief.remember} onJump={onJump} />
            </section>
          ) : null}

          <p className="border-t border-[var(--color-divider)] pt-3 text-[13px] font-normal text-[var(--jos-muted)]">
            AI-generated from synced email, meetings and notes. Check source
            links before acting.
          </p>
        </>
      )}
    </div>
  );
}
