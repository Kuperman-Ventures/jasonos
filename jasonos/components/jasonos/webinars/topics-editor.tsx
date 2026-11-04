"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { archiveTopic, saveTopic } from "@/lib/server-actions/webinars";
import type { WebinarTopicWithCounts } from "@/lib/webinars/store";

const fieldClass =
  "w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground";

export function TopicsEditor({
  topics,
  nextSortOrder,
}: {
  topics: WebinarTopicWithCounts[];
  nextSortOrder: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(topics);
  const [draft, setDraft] = useState({
    slug: "",
    name: "",
    description: "",
    sort_order: String(nextSortOrder),
  });

  const run = (
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success: string
  ) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-[960px] space-y-8 px-4 py-8">
      <header className="space-y-2">
        <Link
          href="/webinars"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Webinars
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Manage topics</h1>
        <p className="text-sm text-muted-foreground">
          Active topics are what Claude can assign. Archive only works when nothing points at the topic.
        </p>
      </header>

      <form
        className="space-y-3 rounded-lg border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await saveTopic({
              slug: draft.slug,
              name: draft.name,
              description: draft.description,
              sort_order: Number(draft.sort_order),
              status: "active",
              creating: true,
            });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Topic added.");
            const currentSort = Number(draft.sort_order);
            setDraft({
              slug: "",
              name: "",
              description: "",
              sort_order: String(Number.isFinite(currentSort) ? currentSort + 10 : nextSortOrder),
            });
            router.refresh();
          });
        }}
      >
        <h2 className="text-sm font-semibold text-foreground">Add a topic</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted-foreground">
            Slug
            <input
              value={draft.slug}
              onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
              placeholder="retail-media"
              className={`${fieldClass} mt-1`}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Name
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              className={`${fieldClass} mt-1`}
            />
          </label>
          <label className="block text-xs text-muted-foreground sm:col-span-2">
            Description
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({ ...current, description: event.target.value }))
              }
              rows={2}
              className={`${fieldClass} mt-1`}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Sort order
            <input
              type="number"
              value={draft.sort_order}
              onChange={(event) =>
                setDraft((current) => ({ ...current, sort_order: event.target.value }))
              }
              className={`${fieldClass} mt-1`}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          Add topic
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Slug</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Sort</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Use</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((topic) => (
              <tr key={topic.slug} className="border-t border-border align-top">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{topic.slug}</td>
                <td className="px-3 py-2">
                  <input
                    value={topic.name}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((row) =>
                          row.slug === topic.slug ? { ...row, name: event.target.value } : row
                        )
                      )
                    }
                    className={fieldClass}
                  />
                </td>
                <td className="px-3 py-2">
                  <textarea
                    value={topic.description}
                    rows={2}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((row) =>
                          row.slug === topic.slug
                            ? { ...row, description: event.target.value }
                            : row
                        )
                      )
                    }
                    className={fieldClass}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={topic.sort_order}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((row) =>
                          row.slug === topic.slug
                            ? { ...row, sort_order: Number(event.target.value) }
                            : row
                        )
                      )
                    }
                    className={`${fieldClass} w-20`}
                  />
                </td>
                <td className="px-3 py-2 text-xs capitalize text-muted-foreground">
                  {topic.status}
                  {topic.merged_into ? (
                    <span className="mt-1 block normal-case">into {topic.merged_into}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {topic.session_count} sessions
                  <span className="block">{topic.takeaway_count} takeaways</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            saveTopic({
                              slug: topic.slug,
                              name: topic.name,
                              description: topic.description,
                              sort_order: topic.sort_order,
                              status: topic.status,
                            }),
                          "Topic saved."
                        )
                      }
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      Save
                    </button>
                    {topic.status === "archived" ? (
                      <span className="text-xs text-muted-foreground">Archived</span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() => archiveTopic(topic.slug), "Topic archived.")
                        }
                        className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
