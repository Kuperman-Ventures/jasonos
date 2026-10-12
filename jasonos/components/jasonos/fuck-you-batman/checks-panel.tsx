import type { FybCheck } from "@/lib/fuck-you-batman/types";

export function ChecksPanel({ checks }: { checks: FybCheck[] }) {
  const problems = checks.filter((c) => c.level === "problem");
  const warnings = checks.filter((c) => c.level === "warning");

  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Checks
      </h2>
      {checks.length === 0 ? (
        <p className="mt-1 text-sm text-foreground/80">No problems found</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-xs">
          {problems.map((check) => (
            <li key={`p-${check.message}`} className="text-foreground">
              {check.message}
            </li>
          ))}
          {warnings.map((check) => (
            <li key={`w-${check.message}`} className="text-muted-foreground">
              {check.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
