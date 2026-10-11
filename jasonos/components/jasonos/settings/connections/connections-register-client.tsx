"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banner } from "@/components/jasonos/brand/status";
import { PageHeader } from "@/components/jasonos/brand/page-header";
import { cn } from "@/lib/utils";
import {
  STATUS_ORDER,
  countByStatus,
  filterGrants,
  sortGrants,
  statusStroke,
} from "@/lib/connections/logic";
import {
  STATUS_HINT,
  STATUS_LABEL,
  type ConnectionGrant,
  type ConnectionsRegister,
  type GrantStatus,
} from "@/lib/connections/types";
import { ConnectionsMap } from "./connections-map";
import { CoverageList } from "./coverage-list";
import { GrantForm } from "./grant-form";
import { NodeDetailPanel } from "./node-detail-panel";
import { RegisterTable } from "./register-table";

type Tab = "register" | "map" | "coverage";

const TABS: { id: Tab; label: string }[] = [
  { id: "register", label: "Register" },
  { id: "map", label: "Map" },
  { id: "coverage", label: "Coverage" },
];

export function ConnectionsRegisterClient({
  register,
  loadError,
}: {
  register: ConnectionsRegister | null;
  loadError: string | null;
}) {
  const [tab, setTab] = useState<Tab>("register");
  const [query, setQuery] = useState("");
  const [hub, setHub] = useState("");
  const [status, setStatus] = useState<GrantStatus | "">("");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<{ kind: "create" } | { kind: "edit"; grant: ConnectionGrant } | null>(
    null
  );

  const grants = useMemo(() => register?.grants ?? [], [register]);
  const nodesByName = useMemo(
    () => new Map((register?.nodes ?? []).map((node) => [node.name, node])),
    [register]
  );
  const filtered = useMemo(
    () => sortGrants(filterGrants(grants, { query, hub, status })),
    [grants, query, hub, status]
  );
  const counts = useMemo(() => countByStatus(grants), [grants]);
  const hubs = useMemo(() => [...new Set(grants.map((g) => g.hub))].sort(), [grants]);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 px-4 py-6">
      <PageHeader
        kicker="Settings"
        title="Connections"
        description="One row per access grant: which of your accounts gave which tool access to which app, and what uses it. A grant with nothing using it is a candidate to revoke."
      />

      {loadError ? (
        <Banner rung={1}>
          The register could not be loaded: {loadError}. Check that migration 0085 has been applied.
        </Banner>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Connections views">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
              tab === t.id
                ? "border-[var(--jos-action)] bg-[var(--jos-action)] text-[var(--color-on-action)]"
                : "border-[var(--jos-line)] text-[var(--jos-muted)] hover:bg-[var(--jos-surface)]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "coverage" ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatusTile
              label="All grants"
              count={grants.length}
              active={status === ""}
              onClick={() => setStatus("")}
            />
            {STATUS_ORDER.map((s) => (
              <StatusTile
                key={s}
                label={`${STATUS_LABEL[s]} - ${STATUS_HINT[s]}`}
                count={counts[s]}
                color={statusStroke(s)}
                active={status === s}
                onClick={() => setStatus(status === s ? "" : s)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="connections-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search account, tool, app or task"
              aria-label="Search grants"
              className="min-w-0 flex-[1_1_240px]"
            />
            <select
              id="connections-hub-filter"
              value={hub}
              onChange={(e) => setHub(e.target.value)}
              aria-label="Filter by tool"
              className="h-10 rounded-[2px] border border-[var(--jos-line)] bg-transparent px-3 text-sm"
            >
              <option value="">All tools</option>
              {hubs.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            {tab === "register" ? (
              <Button type="button" variant="outline" onClick={() => setFormMode({ kind: "create" })}>
                <Plus /> Add a grant
              </Button>
            ) : null}
          </div>
        </>
      ) : null}

      {tab === "register" ? (
        <div className="space-y-4">
          {formMode ? (
            <GrantForm
              key={formMode.kind === "edit" ? formMode.grant.id : "new"}
              grant={formMode.kind === "edit" ? formMode.grant : null}
              onDone={() => setFormMode(null)}
            />
          ) : null}
          {grants.length === 0 && !loadError ? (
            <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-[var(--jos-muted)]">
              No grants recorded yet. Use Add a grant, or ask Claude to load the register through the
              JasonOS connection.
            </p>
          ) : (
            <RegisterTable grants={filtered} onEdit={(g) => setFormMode({ kind: "edit", grant: g })} />
          )}
        </div>
      ) : null}

      {tab === "map" ? (
        <div className="space-y-3">
          <p className="max-w-[75ch] text-sm text-[var(--jos-muted)]">
            Left: your accounts. Middle: the tools that hold access and act on their own. Right: the apps
            they reach. Line color is the grant&apos;s status. Select a box for details and manage links. A
            number on a box means it holds a list you can open. The search, tool and status filters apply
            here too.
          </p>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <ConnectionsMap
              grants={filtered}
              nodesByName={nodesByName}
              selected={selectedNode}
              onSelect={(name) => setSelectedNode((cur) => (cur === name ? null : name))}
            />
            <NodeDetailPanel
              name={selectedNode}
              node={selectedNode ? nodesByName.get(selectedNode) ?? null : null}
              grants={filtered}
              onClear={() => setSelectedNode(null)}
            />
          </div>
        </div>
      ) : null}

      {tab === "coverage" ? <CoverageList rows={register?.coverage ?? []} /> : null}
    </div>
  );
}

function StatusTile({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid gap-1 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:bg-[var(--jos-surface)]",
        active && "border-[var(--jos-action)] ring-1 ring-[var(--jos-action)]"
      )}
    >
      <span className="num-mono text-2xl font-semibold leading-none" style={color ? { color } : undefined}>
        {count}
      </span>
      <span className="text-[12px] leading-snug text-[var(--jos-muted)]">{label}</span>
    </button>
  );
}
