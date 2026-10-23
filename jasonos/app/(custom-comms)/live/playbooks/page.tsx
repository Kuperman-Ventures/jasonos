import type { Metadata } from "next";
import Link from "next/link";
import { listLiveScripts } from "@/lib/server-actions/live-scripts";

export const metadata: Metadata = { title: "Playbooks · Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LivePlaybooksPage() {
  const result = await listLiveScripts({ kind: "strategy" });
  const scripts = result.ok ? result.scripts : [];
  const error = result.ok ? null : result.error;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 min-[900px]:px-10">
      <header>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--jos-ink)]">Playbooks</h1>
        <p className="mt-1 text-[14px] text-[var(--jos-muted)]">
          Reusable point sets you rehearse and use for meetings.
        </p>
      </header>
      {error ? <p className="text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {scripts.length === 0 ? (
        <p className="text-[15px] text-[var(--jos-muted)]">No playbooks yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--jos-line)] border-t border-b border-[var(--jos-line)]">
          {scripts.map((script) => (
            <li key={script.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/live/scripts/${script.id}`}
                  className="text-[16px] font-bold text-[var(--jos-ink)] hover:underline"
                >
                  {script.name}
                </Link>
                <p className="mt-0.5 truncate text-[14px] text-[var(--jos-muted)]">
                  {script.successSentence?.trim() || script.description?.trim() || "No success sentence"}
                </p>
                <p className="mt-0.5 text-[13px] tabular-nums text-[var(--jos-muted)]">
                  {script.itemCount} points · used {script.useCount}
                </p>
              </div>
              {script.itemCount > 0 ? (
                <Link
                  href={`/live/scripts/${script.id}/rehearse`}
                  className="text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
                >
                  Rehearse
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
