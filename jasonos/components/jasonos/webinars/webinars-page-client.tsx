"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { rescanNow } from "@/lib/server-actions/webinars";
import type { WebinarRange } from "@/lib/webinars/display";
import type { WebinarsByTopic } from "@/lib/webinars/store";
import { ActionsStrip } from "./actions-strip";
import { CandidateRow } from "./candidate-row";
import { DigestCard } from "./digest-card";
import { PageHeader } from "./page-header";
import { ProposedTopics } from "./proposed-topics";
import { TopicSection } from "./topic-section";

export type { WebinarRange };

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
        result.errors.length > 0 ? ` (${result.errors.slice(0, 2).join("; ")})` : "";
      toast.success(
        `Rescan done — ${result.new_or_updated} session${
          result.new_or_updated === 1 ? "" : "s"
        } touched${errNote}`
      );
      router.refresh();
    });
  };

  const counts = new Map(data.topics.map((topic) => [topic.slug, topic.sessions.length]));
  const seen = new Set<string>();
  const chips = activeTopics.map((topic) => {
    seen.add(topic.slug);
    return { slug: topic.slug, name: topic.name, count: counts.get(topic.slug) ?? 0 };
  });
  for (const topic of data.topics) {
    if (seen.has(topic.slug)) continue;
    chips.push({ slug: topic.slug, name: topic.name, count: topic.sessions.length });
  }

  const sessions = data.topics.reduce((sum, topic) => sum + topic.sessions.length, 0);
  const takeaways = data.topics.reduce(
    (sum, topic) =>
      sum + topic.sessions.reduce((inner, session) => inner + session.takeaways.length, 0),
    0
  );

  return (
    <div className="min-h-full bg-[#f6f5f3] text-[#201e1d]">
      <div className="mx-auto flex max-w-[860px] flex-col gap-11 px-6 pb-20 pt-10">
        <PageHeader
          range={range}
          chips={chips}
          sessions={sessions}
          takeaways={takeaways}
          actions={data.actions.length}
          candidates={data.candidates.length}
          scanning={scanning || pending}
          onRescan={onRescan}
        />
        <ActionsStrip actions={data.actions} range={range} />
        <DigestCard digest={data.digest} />
        {data.topics.map((topic) => (
          <TopicSection
            key={topic.slug}
            topic={topic}
            sessions={topic.sessions}
            topicNames={topicNames}
            range={range}
          />
        ))}
        <ProposedTopics proposed={data.proposed} activeTopics={activeTopics} />
        <section>
          <h2 className="flex items-center gap-2 text-[18px] font-semibold text-[#201e1d]">
            <span
              aria-hidden
              className="h-3.5 w-3.5 rounded-full border border-dashed border-[#aa0b56]"
            />
            Waiting for you
          </h2>
          <p className="mt-1 text-[13px] text-[#605d5d]">
            Recordings the detector is not sure about
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {data.candidates.length ? (
              data.candidates.map((session) => (
                <CandidateRow key={session.id} session={session} />
              ))
            ) : (
              <p className="text-[13px] text-[#7d7979]">None in the last 4 weeks.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
