"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusPill } from "@/components/jasonos/brand/status";
import { COVERAGE_STATES, type CoverageRow, type CoverageState } from "@/lib/connections/types";
import { setCoverageAction } from "@/lib/server-actions/connections";

function rungFor(state: CoverageState): "done" | 2 | 1 {
  return state === "Done" ? "done" : state === "Partial" ? 2 : 1;
}

export function CoverageList({ rows }: { rows: CoverageRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setState(row: CoverageRow, state: CoverageState) {
    startTransition(async () => {
      const res = await setCoverageAction({ id: row.id, source: row.source, state, note: row.note });
      if (res.ok) {
        toast.success("Coverage updated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">What has been checked</h2>
        <p className="max-w-[70ch] text-sm text-[var(--jos-muted)]">
          Each source of grants, and whether it has been inventoried. A source marked Not checked may hold
          grants missing from the register.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-[var(--jos-muted)]">
          No coverage notes recorded yet.
        </p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="grid gap-1 rounded-xl border bg-card px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3">
              <span className="font-semibold">{row.source}</span>
              <StatusPill rung={rungFor(row.state)}>{row.state}</StatusPill>
              <select
                id={`coverage-state-${row.id}`}
                aria-label={`Change coverage for ${row.source}`}
                value={row.state}
                disabled={pending}
                onChange={(e) => setState(row, e.target.value as CoverageState)}
                className="h-8 rounded-[2px] border border-[var(--jos-line)] bg-transparent px-2 text-[13px]"
              >
                {COVERAGE_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {row.note ? (
                <span className="text-[13px] text-[var(--jos-muted)] sm:col-span-3">{row.note}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
