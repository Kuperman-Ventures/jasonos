import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LiveBreadcrumb } from "@/components/jasonos/live/live-breadcrumb";
import { LiveSectionNav } from "@/components/jasonos/live/live-section-nav";
import { PlaybooksListClient } from "@/components/jasonos/live/playbooks-list-client";
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
      <LiveBreadcrumb
        crumbs={[
          { label: "Live", href: "/live" },
          { label: "Playbooks" },
        ]}
      />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
            Live
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Playbooks</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LiveSectionNav current="playbooks" />
          <form action={newPlaybookAction}>
            <button type="submit" className={buttonVariants({ size: "sm" })}>
              New playbook
            </button>
          </form>
        </div>
      </div>

      {!result.ok ? (
        <p className="mt-4 text-sm text-[var(--jos-danger-text)]">{result.error}</p>
      ) : (
        <PlaybooksListClient playbooks={result.playbooks} />
      )}
    </div>
  );
}
