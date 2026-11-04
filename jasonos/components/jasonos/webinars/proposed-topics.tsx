"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { acceptTopic, mergeTopicInto } from "@/lib/server-actions/webinars";
import type { WebinarTopicRow } from "@/lib/webinars/store";

export function ProposedTopics({
  proposed,
  activeTopics,
}: {
  proposed: WebinarTopicRow[];
  activeTopics: Array<{ slug: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [intoBySlug, setIntoBySlug] = useState<Record<string, string>>({});

  if (!proposed.length) return null;

  const run = (
    key: string,
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success: string
  ) => {
    setBusy(key);
    startTransition(async () => {
      const result = await action();
      setBusy(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  };

  return (
    <section>
      <h2 className="mb-4 text-[18px] font-semibold text-[#201e1d]">Proposed topics</h2>
      <div className="rounded-[6px] border border-[rgba(32,30,29,0.10)] bg-[#ffffff]">
        {proposed.map((topic) => {
          const into = intoBySlug[topic.slug] || activeTopics[0]?.slug || "";
          return (
            <div
              key={topic.slug}
              className="border-t border-[rgba(32,30,29,0.08)] px-6 py-4 first:border-t-0"
            >
              <p className="text-[15px] font-semibold leading-[1.5] text-[#201e1d]">{topic.name}</p>
              {topic.proposed_reason ? (
                <p className="mt-1 text-[13px] leading-[1.5] text-[#605d5d]">
                  {topic.proposed_reason}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(`accept:${topic.slug}`, () => acceptTopic(topic.slug), "Topic accepted.")
                  }
                  className="rounded-[6px] bg-[#006786] px-3 py-1.5 text-[13px] font-semibold text-[#ffffff] disabled:opacity-50"
                >
                  {busy === `accept:${topic.slug}` ? "…" : "Accept"}
                </button>
                <label className="flex items-center gap-2 text-[13px] text-[#605d5d]">
                  Merge into
                  <select
                    value={into}
                    disabled={pending || !activeTopics.length}
                    onChange={(event) =>
                      setIntoBySlug((current) => ({
                        ...current,
                        [topic.slug]: event.target.value,
                      }))
                    }
                    className="rounded-[6px] border border-[rgba(32,30,29,0.10)] bg-[#ffffff] px-2 py-1 text-[13px] text-[#201e1d]"
                  >
                    {activeTopics.map((active) => (
                      <option key={active.slug} value={active.slug}>
                        {active.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={pending || !into}
                  onClick={() =>
                    run(
                      `merge:${topic.slug}`,
                      () => mergeTopicInto(topic.slug, into),
                      "Topic merged."
                    )
                  }
                  className="rounded-[6px] border border-[rgba(32,30,29,0.10)] bg-[#ffffff] px-3 py-1.5 text-[13px] text-[#201e1d] disabled:opacity-50"
                >
                  {busy === `merge:${topic.slug}` ? "…" : "Merge"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
