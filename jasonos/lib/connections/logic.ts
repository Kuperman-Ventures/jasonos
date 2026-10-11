/**
 * Connections Register: pure helpers and input schemas.
 * No database or Next.js imports, so the MCP stdio process and tests can use it.
 */
import { z } from "zod";
import {
  COVERAGE_STATES,
  GRANT_STATUSES,
  type ConnectionGrant,
  type GrantStatus,
} from "./types";

export const MAP_COLUMN_LABELS = ["Your account", "Tool holding access", "App it reaches"] as const;

const text = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const slugId = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{0,119}$/, "Use lowercase letters, numbers and hyphens");

export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Create or replace a grant. Optional fields keep their stored value when omitted. */
export const GrantInputSchema = z.object({
  id: slugId.optional(),
  identity: text(200).min(1),
  hub: text(200).min(1),
  target: text(300).min(1),
  access: text(2000).optional(),
  used_by: text(1000).optional(),
  status: z.enum(GRANT_STATUSES).optional(),
  evidence: text(2000).optional(),
  check_at: text(2000).optional(),
  verified_on: isoDate.nullable().optional(),
});
export type GrantInput = z.infer<typeof GrantInputSchema>;

/** Partial update. No defaults, so only the fields sent are changed. */
export const GrantPatchSchema = z
  .object({
    identity: text(200).min(1),
    hub: text(200).min(1),
    target: text(300).min(1),
    access: text(2000),
    used_by: text(1000),
    status: z.enum(GRANT_STATUSES),
    evidence: text(2000),
    check_at: text(2000),
    verified_on: isoDate.nullable(),
  })
  .partial();
export type GrantPatch = z.infer<typeof GrantPatchSchema>;

export const ManageLinkSchema = z.object({
  label: text(120).min(1),
  url: text(2000)
    .refine((value) => isHttpUrl(value), "Must be an http or https link")
    .nullable()
    .optional(),
});

export const NodeItemSchema = z.object({
  name: text(200).min(1),
  used: z.boolean(),
  note: text(500).nullable().optional(),
});

export const NodeInputSchema = z.object({
  name: text(300).min(1),
  about: text(4000).optional(),
  manage: z.array(ManageLinkSchema).max(12).optional(),
  items: z.array(NodeItemSchema).max(200).optional(),
  items_label: text(120).nullable().optional(),
});
export type NodeInput = z.infer<typeof NodeInputSchema>;

export const CoverageInputSchema = z.object({
  id: slugId.optional(),
  source: text(300).min(1),
  state: z.enum(COVERAGE_STATES),
  note: text(2000).optional(),
  sort_order: z.number().int().min(0).max(10000).optional(),
});
export type CoverageInput = z.infer<typeof CoverageInputSchema>;

export const ImportSchema = z.object({
  grants: z.array(GrantInputSchema).max(1000).optional(),
  nodes: z.array(NodeInputSchema).max(500).optional(),
  coverage: z.array(CoverageInputSchema).max(200).optional(),
});
export type ImportPayload = z.infer<typeof ImportSchema>;

export function slugify(value: string, max = 100): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export function slugifyGrantId(parts: { hub: string; target: string; identity: string }): string {
  return slugify(`${parts.hub}-${parts.target}-${parts.identity}`) || "grant";
}

/** Today's date in America/New_York as YYYY-MM-DD. */
export function etDate(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export const STATUS_ORDER: readonly GrantStatus[] = GRANT_STATUSES;

export function sortGrants<T extends Pick<ConnectionGrant, "status" | "hub" | "target" | "identity">>(
  grants: readonly T[]
): T[] {
  return [...grants].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      a.hub.localeCompare(b.hub) ||
      a.target.localeCompare(b.target) ||
      a.identity.localeCompare(b.identity)
  );
}

export interface GrantFilter {
  query?: string;
  hub?: string;
  status?: GrantStatus | "";
}

export function filterGrants<T extends ConnectionGrant>(grants: readonly T[], filter: GrantFilter): T[] {
  const query = filter.query?.trim().toLowerCase() ?? "";
  return grants.filter((g) => {
    if (filter.status && g.status !== filter.status) return false;
    if (filter.hub && g.hub !== filter.hub) return false;
    if (!query) return true;
    return [g.identity, g.hub, g.target, g.used_by, g.access, g.evidence]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

export function countByStatus(grants: readonly Pick<ConnectionGrant, "status">[]): Record<GrantStatus, number> {
  const counts = Object.fromEntries(GRANT_STATUSES.map((s) => [s, 0])) as Record<GrantStatus, number>;
  for (const g of grants) counts[g.status] += 1;
  return counts;
}

/** Unique box names per map column, in sorted grant order. */
export function mapColumns(
  grants: readonly Pick<ConnectionGrant, "identity" | "hub" | "target">[]
): [string[], string[], string[]] {
  const unique = (values: string[]) => [...new Set(values)];
  return [
    unique(grants.map((g) => g.identity)),
    unique(grants.map((g) => g.hub)),
    unique(grants.map((g) => g.target)),
  ];
}

export function grantTouchesNode(
  grant: Pick<ConnectionGrant, "identity" | "hub" | "target">,
  name: string
): boolean {
  return grant.identity === name || grant.hub === name || grant.target === name;
}

/** Which map columns a box appears in, as plain labels. */
export function nodeRoles(
  grants: readonly Pick<ConnectionGrant, "identity" | "hub" | "target">[],
  name: string
): string[] {
  const roles = new Set<number>();
  for (const g of grants) {
    if (g.identity === name) roles.add(0);
    if (g.hub === name) roles.add(1);
    if (g.target === name) roles.add(2);
  }
  return [...roles].sort().map((i) => MAP_COLUMN_LABELS[i]);
}

/** JasonOS StatusPill rung for a grant status. */
export function statusRung(status: GrantStatus): 1 | 2 | 4 | "done" | "idle" {
  switch (status) {
    case "no_use_found":
      return 1;
    case "unverified":
      return 2;
    case "in_use":
      return "done";
    case "turned_off":
      return "idle";
    case "revoked":
      return 4;
  }
}

/** Line color on the map, from JasonOS brand tokens. */
export function statusStroke(status: GrantStatus): string {
  switch (status) {
    case "no_use_found":
      return "var(--jos-danger)";
    case "unverified":
      return "var(--jos-warn)";
    case "in_use":
      return "var(--jos-ok)";
    case "turned_off":
      return "var(--jos-muted)";
    case "revoked":
      return "var(--jos-info)";
  }
}

export function formatVerified(date: string | null): string {
  if (!date) return "Never";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
