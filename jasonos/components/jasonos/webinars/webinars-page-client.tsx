"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { rescanNow } from "@/lib/server-actions/webinars";
import type { WebinarsByTopic } from "@/lib/webinars/store";
import { CandidateRow } from "./candidate-row";
import { DigestCard } from "./digest-card";
import { ProposedTopics } from "./proposed-topics";
import { SessionCard } from "./session-card";

const RANGES = [
  { id: "week", label: "This week", href: "/webinars?range=week" },
  { id: "4w", label: "4 weeks", href: "/webinars?range=4w" },
  { id: "all", label: "All", href: "/webinars?range=all" },
] as const;

export type WebinarRange = (typeof RANGES)[number]["id"];

export function WebinarsPageClient({
  range,
  data,
  topicNames,
  activeTopics,
}: {
  range: WebinarRange;
  data: WebinarsByTopic;
  topicNames: Record<string, string>;
  activeTopics: Array<{ slug: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);

  const onRescan = () => {
    setScanning(true);
    startTransition(async () => {
      const result = await rescanNow();
      setScanning(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const errNote =
        result.errors.length > 0
          ? ` (${result.errors.slice(0, 2).join("; ")})`
          : "";
      toast.success(
        `Rescan done — ${result.new_or_updated} session${
          result.new_or_updated === 1 ? "" : "s"
        } touched${errNote}`
      );
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-[880px] space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Webinars
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sessions grouped by topic. Claude summarizes; this page stores and
            shows the result.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/webinars/topics"
            className="rounded border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            Manage topics
          </Link>
          <button
            type="button"
            disabled={pending || scanning}
            onClick={onRescan}
            className="rounded border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            {scanning || pending ? "Scanning…" : "Rescan"}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
        {RANGES.map((option) => {
          const selected = option.id === range;
          return (
            <Link
              key={option.id}
              href={option.href}
              aria-current={selected ? "page" : undefined}
              className={
                selected
                  ? "rounded border border-foreground bg-foreground px-2.5 py-1 text-sm text-background"
                  : "rounded border border-border bg-card px-2.5 py-1 text-sm hover:bg-muted"
              }
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      <DigestCard digest={data.digest} />

      {data.topics.length ? (
        <nav className="flex flex-wrap gap-2" aria-label="Topics">
          {data.topics.map((topic) => (
            <div
              key={topic.slug}
              className="inline-flex items-center rounded-full border border-border bg-card"
            >
              <a
                href={`#topic-${topic.slug}`}
                className="py-1 pl-3 pr-1 text-sm text-foreground hover:underline"
              >
                {topic.name}
                <span className="ml-1 text-muted-foreground">{topic.sessions.length}</span>
              </a>
              <Link
                href={`/webinars/${topic.slug}`}
                aria-label={`${topic.name} takeaways`}
                className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
              >
                →
              </Link>
            </div>
          ))}
        </nav>
      ) : (
        <p className="text-sm text-muted-foreground">No published sessions in this range.</p>
      )}

      {data.topics.map((topic) => (
        <section key={topic.slug} id={`topic-${topic.slug}`} className="scroll-mt-24 space-y-3">
          <header>
            <h2 className="text-lg font-semibold text-foreground">{topic.name}</h2>
            {topic.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{topic.description}</p>
            ) : null}
          </header>
          <div className="space-y-3">
            {topic.sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                takeaways={session.takeaways}
                topicNames={topicNames}
              />
            ))}
          </div>
        </section>
      ))}

      <ProposedTopics proposed={data.proposed} activeTopics={activeTopics} />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Candidates</h2>
        {data.candidates.length ? (
          data.candidates.map((session) => (
            <CandidateRow key={session.id} session={session} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">None in the last 4 weeks.</p>
        )}
      </section>
    </div>
  );
}
