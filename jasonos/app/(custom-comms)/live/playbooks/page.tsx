import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createPlaybook, listPlaybooks } from "@/lib/server-actions/decks";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Playbooks · Live · JasonOS" };
export const dynamic = "force-dynamic";

async function newPlaybookAction() {
  "use server";
  const result = await createPlaybook();
  if (!result.ok) throw new Error(result.error);
  redirect(`/live/playbooks/${result.id}`);
}

export default async function PlaybooksPage() {
  const result = await listPlaybooks();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
            <Link href="/live" className="hover:underline">
              Live
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Playbooks</h1>
        </div>
        <form action={newPlaybookAction}>
          <button type="submit" className={buttonVariants({ size: "sm" })}>
            New Playbook
          </button>
        </form>
      </div>

      {!result.ok ? (
        <p className="mt-4 text-sm text-[var(--jos-danger-text)]">{result.error}</p>
      ) : (
        <ul className="mt-8 divide-y divide-[var(--jos-line)] border border-[var(--jos-line)] bg-[var(--jos-surface)]">
          {result.playbooks.length === 0 ? (
            <li className="px-4 py-3 text-sm text-[var(--jos-muted)]">No playbooks yet.</li>
          ) : (
            result.playbooks.map((playbook) => (
              <li key={playbook.id}>
                <Link
                  href={`/live/playbooks/${playbook.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[color-mix(in_srgb,var(--jos-focus)_6%,transparent)]"
                >
                  <span className="truncate text-sm font-semibold">{playbook.name}</span>
                  <span className="shrink-0 text-[12px] text-[var(--jos-muted)]">
                    {playbook.slideCount} slides
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
