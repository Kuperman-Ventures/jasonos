"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/jasonos/brand/status";
import { formatVerified, grantTouchesNode, isHttpUrl, nodeRoles, statusRung } from "@/lib/connections/logic";
import { STATUS_LABEL, type ConnectionGrant, type ConnectionNode } from "@/lib/connections/types";
import { CheckLink } from "./register-table";

function LinkChip({ label, url }: { label: string; url?: string | null }) {
  const base = "rounded-full border border-[var(--jos-line)] px-3 py-1 text-[13px]";
  return isHttpUrl(url) ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`${base} font-semibold text-[var(--jos-action)] hover:bg-[var(--jos-surface)]`}>
      {label}
    </a>
  ) : (
    <span className={`${base} text-[var(--jos-muted)]`}>{label}</span>
  );
}

export function NodeDetailPanel({
  name,
  node,
  grants,
  onClear,
}: {
  name: string | null;
  node: ConnectionNode | null;
  grants: ConnectionGrant[];
  onClear: () => void;
}) {
  if (!name) {
    return (
      <aside className="rounded-xl border bg-card p-4 lg:sticky lg:top-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">Details</p>
        <p className="mt-2 text-sm text-[var(--jos-muted)]">
          Select any box on the map to see what it is, where to manage it, and every grant that runs through it.
        </p>
      </aside>
    );
  }

  const through = grants.filter((g) => grantTouchesNode(g, name));
  const roles = nodeRoles(grants, name).join(" and ");
  const fallbackLinks = [...new Set(through.map((g) => g.check_at).filter(Boolean))];
  const items = node?.items ?? [];
  const used = items.filter((i) => i.used);
  const orderedItems = [...used, ...items.filter((i) => !i.used)];

  return (
    <aside
      aria-live="polite"
      className="grid min-w-0 gap-4 rounded-xl border bg-card p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto"
    >
      <div>
        {roles ? (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">{roles}</p>
        ) : null}
        <h2 className="mt-1 text-lg font-semibold break-words">{name}</h2>
      </div>

      {node?.about ? <p className="text-sm">{node.about}</p> : null}

      <section className="grid gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">Manage</h3>
        <div className="flex flex-wrap gap-2">
          {node?.manage?.length
            ? node.manage.map((m) => <LinkChip key={`${m.label}-${m.url ?? ""}`} label={m.label} url={m.url} />)
            : fallbackLinks.length
              ? fallbackLinks.map((u) => (
                  <LinkChip key={u} label={isHttpUrl(u) ? "Open check or revoke page" : u} url={u} />
                ))
              : <LinkChip label="No manage link recorded" />}
        </div>
      </section>

      {items.length ? (
        <section className="grid gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
            {node?.items_label || "Attached"} - {used.length} used of {items.length}
          </h3>
          <ul className="divide-y divide-[var(--jos-line)]">
            {orderedItems.map((item) => (
              <li key={item.name} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-2 text-sm">
                <StatusPill rung={item.used ? "ok" : "idle"}>{item.used ? "Used" : "Not used"}</StatusPill>
                <span>{item.name}</span>
                {item.note ? <span className="col-start-2 text-[12px] text-[var(--jos-muted)]">{item.note}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
          Grants through this box - {through.length}
        </h3>
        {through.length ? (
          <div className="grid gap-2">
            {through.map((g) => (
              <details key={g.id} className="group rounded-lg border border-[var(--jos-line)] px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ChevronDown className="h-4 w-4 shrink-0 text-[var(--jos-muted)] transition-transform group-open:rotate-180" />
                    <span className="truncate">{g.used_by || g.target}</span>
                  </span>
                  <StatusPill rung={statusRung(g.status)}>{STATUS_LABEL[g.status]}</StatusPill>
                </summary>
                <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
                  <dt className="text-[var(--jos-muted)]">Account</dt>
                  <dd className="break-words">{g.identity}</dd>
                  <dt className="text-[var(--jos-muted)]">Tool</dt>
                  <dd className="break-words">{g.hub}</dd>
                  <dt className="text-[var(--jos-muted)]">Reaches</dt>
                  <dd className="break-words">{g.target}</dd>
                  <dt className="text-[var(--jos-muted)]">Can do</dt>
                  <dd className="break-words">{g.access || "Not recorded"}</dd>
                  <dt className="text-[var(--jos-muted)]">Evidence</dt>
                  <dd className="break-words">{g.evidence || "Not recorded"}</dd>
                  <dt className="text-[var(--jos-muted)]">Verified</dt>
                  <dd>{formatVerified(g.verified_on)}</dd>
                  <dt className="text-[var(--jos-muted)]">Manage</dt>
                  <dd className="break-words">{g.check_at ? <CheckLink value={g.check_at} /> : "Not recorded"}</dd>
                </dl>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--jos-muted)]">No grants match the current filters.</p>
        )}
      </section>

      <Button type="button" size="sm" variant="outline" onClick={onClear} className="justify-self-start">
        Clear selection
      </Button>
    </aside>
  );
}
