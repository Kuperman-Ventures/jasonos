/**
 * Connections Register data access. Service-role, MCP-safe (no Next.js imports),
 * so both the Settings page and the JasonOS MCP use these same functions.
 */
import { jasonosDb } from "../mcp/db";
import {
  CoverageInputSchema,
  GrantInputSchema,
  GrantPatchSchema,
  ImportSchema,
  NodeInputSchema,
  etDate,
  slugify,
  slugifyGrantId,
  sortGrants,
} from "./logic";
import type {
  Actor,
  ConnectionEvent,
  ConnectionGrant,
  ConnectionNode,
  ConnectionsRegister,
  CoverageRow,
} from "./types";

const GRANT_COLS =
  "id,identity,hub,target,access,used_by,status,evidence,check_at,verified_on,created_at,updated_at,updated_by";
const NODE_COLS = "name,about,manage,items,items_label,updated_at,updated_by";
const COVERAGE_COLS = "id,source,state,note,sort_order,updated_at,updated_by";
const EVENT_COLS = "id,grant_id,action,changes,actor,created_at";

function fail(error: { message: string }): never {
  throw new Error(error.message);
}

export async function getConnectionsRegister(): Promise<ConnectionsRegister> {
  const db = jasonosDb();
  const [grants, nodes, coverage] = await Promise.all([
    db.from("connection_grants").select(GRANT_COLS),
    db.from("connection_nodes").select(NODE_COLS),
    db.from("connection_coverage").select(COVERAGE_COLS).order("sort_order", { ascending: true }),
  ]);
  if (grants.error) fail(grants.error);
  if (nodes.error) fail(nodes.error);
  if (coverage.error) fail(coverage.error);
  return {
    grants: sortGrants((grants.data ?? []) as ConnectionGrant[]),
    nodes: (nodes.data ?? []) as ConnectionNode[],
    coverage: (coverage.data ?? []) as CoverageRow[],
    generated_at: new Date().toISOString(),
  };
}

async function getGrant(id: string): Promise<ConnectionGrant | null> {
  const { data, error } = await jasonosDb()
    .from("connection_grants")
    .select(GRANT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error);
  return (data as ConnectionGrant | null) ?? null;
}

/**
 * Create or replace a grant. Without an id, the id is a slug of hub, target and
 * identity. With createNew, an existing id gets a numeric suffix instead of
 * being replaced (used by the "Add a grant" form).
 */
export async function upsertGrant(
  raw: unknown,
  actor: Actor,
  options: { createNew?: boolean } = {}
): Promise<ConnectionGrant> {
  const input = GrantInputSchema.parse(raw);
  let id = input.id ?? slugifyGrantId(input);
  let prev = await getGrant(id);

  if (options.createNew && prev) {
    const base = id.slice(0, 110);
    for (let n = 2; n < 100; n += 1) {
      const candidate = `${base}-${n}`;
      if (!(await getGrant(candidate))) {
        id = candidate;
        prev = null;
        break;
      }
    }
  }

  const row = {
    id,
    identity: input.identity,
    hub: input.hub,
    target: input.target,
    access: input.access ?? prev?.access ?? "",
    used_by: input.used_by ?? prev?.used_by ?? "",
    status: input.status ?? prev?.status ?? "unverified",
    evidence: input.evidence ?? prev?.evidence ?? "",
    check_at: input.check_at ?? prev?.check_at ?? "",
    verified_on: input.verified_on !== undefined ? input.verified_on : prev?.verified_on ?? etDate(),
    updated_by: actor,
  };

  const { data, error } = await jasonosDb()
    .from("connection_grants")
    .upsert(row, { onConflict: "id" })
    .select(GRANT_COLS)
    .single();
  if (error) fail(error);
  return data as ConnectionGrant;
}

export async function updateGrant(id: string, rawPatch: unknown, actor: Actor): Promise<ConnectionGrant> {
  const patch = GrantPatchSchema.parse(rawPatch);
  if (Object.keys(patch).length === 0) throw new Error("Nothing to update.");
  const { data, error } = await jasonosDb()
    .from("connection_grants")
    .update({ ...patch, updated_by: actor })
    .eq("id", id)
    .select(GRANT_COLS)
    .maybeSingle();
  if (error) fail(error);
  if (!data) throw new Error(`No grant with id "${id}".`);
  return data as ConnectionGrant;
}

export async function deleteGrant(id: string, actor: Actor): Promise<{ deleted: string }> {
  const db = jasonosDb();
  // Record who deleted it; the history trigger reads updated_by from the old row.
  const stamp = await db.from("connection_grants").update({ updated_by: actor }).eq("id", id).select("id");
  if (stamp.error) fail(stamp.error);
  if (!stamp.data?.length) throw new Error(`No grant with id "${id}".`);
  const { error } = await db.from("connection_grants").delete().eq("id", id);
  if (error) fail(error);
  return { deleted: id };
}

export async function upsertNode(raw: unknown, actor: Actor): Promise<ConnectionNode> {
  const input = NodeInputSchema.parse(raw);
  const db = jasonosDb();
  const existing = await db.from("connection_nodes").select(NODE_COLS).eq("name", input.name).maybeSingle();
  if (existing.error) fail(existing.error);
  const prev = existing.data as ConnectionNode | null;
  const row = {
    name: input.name,
    about: input.about ?? prev?.about ?? "",
    manage: input.manage ?? prev?.manage ?? [],
    items: input.items ?? prev?.items ?? [],
    items_label: input.items_label !== undefined ? input.items_label : prev?.items_label ?? null,
    updated_by: actor,
  };
  const { data, error } = await db
    .from("connection_nodes")
    .upsert(row, { onConflict: "name" })
    .select(NODE_COLS)
    .single();
  if (error) fail(error);
  return data as ConnectionNode;
}

export async function upsertCoverage(raw: unknown, actor: Actor): Promise<CoverageRow> {
  const input = CoverageInputSchema.parse(raw);
  const id = input.id ?? (slugify(input.source) || "source");
  const db = jasonosDb();
  const existing = await db.from("connection_coverage").select(COVERAGE_COLS).eq("id", id).maybeSingle();
  if (existing.error) fail(existing.error);
  const prev = existing.data as CoverageRow | null;
  const row = {
    id,
    source: input.source,
    state: input.state,
    note: input.note ?? prev?.note ?? "",
    sort_order: input.sort_order ?? prev?.sort_order ?? 0,
    updated_by: actor,
  };
  const { data, error } = await db
    .from("connection_coverage")
    .upsert(row, { onConflict: "id" })
    .select(COVERAGE_COLS)
    .single();
  if (error) fail(error);
  return data as CoverageRow;
}

export async function listConnectionChanges(input: {
  since?: string;
  grant_id?: string;
  limit?: number;
} = {}): Promise<ConnectionEvent[]> {
  let query = jasonosDb()
    .from("connection_events")
    .select(EVENT_COLS)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 500));
  if (input.since) query = query.gte("created_at", input.since);
  if (input.grant_id) query = query.eq("grant_id", input.grant_id);
  const { data, error } = await query;
  if (error) fail(error);
  return (data ?? []) as ConnectionEvent[];
}

/** Bulk load. Each row is upserted with the same rules as the single-row functions. */
export async function importRegister(
  raw: unknown,
  actor: Actor
): Promise<{ grants: number; nodes: number; coverage: number }> {
  const payload = ImportSchema.parse(raw);
  for (const grant of payload.grants ?? []) await upsertGrant(grant, actor);
  for (const node of payload.nodes ?? []) await upsertNode(node, actor);
  for (const row of payload.coverage ?? []) await upsertCoverage(row, actor);
  return {
    grants: payload.grants?.length ?? 0,
    nodes: payload.nodes?.length ?? 0,
    coverage: payload.coverage?.length ?? 0,
  };
}
