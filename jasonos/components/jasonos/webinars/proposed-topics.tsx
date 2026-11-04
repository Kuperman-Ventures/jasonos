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

  const run = (key: string, action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) => {
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
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Proposed topics</h2>
      <ul className="space-y-3">
        {proposed.map((topic) => {
          const into = intoBySlug[topic.slug] || activeTopics[0]?.slug || "";
          return (
            <li key={topic.slug} className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">{topic.name}</p>
              {topic.proposed_reason ? (
                <p className="mt-1 text-sm text-muted-foreground">{topic.proposed_reason}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(`accept:${topic.slug}`, () => acceptTopic(topic.slug), "Topic accepted.")
                  }
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  {busy === `accept:${topic.slug}` ? "…" : "Accept"}
                </button>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
                    className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
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
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  {busy === `merge:${topic.slug}` ? "…" : "Merge"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
