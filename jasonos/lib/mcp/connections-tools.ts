import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { countByStatus, filterGrants } from "../connections/logic";
import {
  deleteGrant,
  getConnectionsRegister,
  importRegister,
  listConnectionChanges,
  updateGrant,
  upsertCoverage,
  upsertGrant,
  upsertNode,
} from "../connections/store";
import { COVERAGE_STATES, GRANT_STATUSES } from "../connections/types";
import { runTool } from "./result";

export const CONNECTIONS_TOOL_NAMES = [
  "get_connections_register",
  "list_connection_changes",
  "upsert_connection_grant",
  "update_connection_grant",
  "delete_connection_grant",
  "upsert_connection_node",
  "upsert_connection_coverage",
  "import_connections_register",
] as const;

const statusEnum = z.enum(GRANT_STATUSES);
const isoDate = z.string().describe("YYYY-MM-DD");
const grantId = z.string().min(1).max(120).describe("Lowercase slug id, e.g. zapier-gmail-advisors");

const grantFieldShape = {
  identity: z.string().min(1).max(200).describe("The account that granted access, e.g. jason@kupermanadvisors.com"),
  hub: z.string().min(1).max(200).describe("The tool holding the access, e.g. Zapier, Zapier Agent, Claude connector"),
  target: z.string().min(1).max(300).describe("The app it reaches, e.g. Gmail"),
  access: z.string().max(2000).describe("What the grant can do, in one or two plain sentences"),
  used_by: z.string().max(1000).describe("The named Zap, agent, task or app that uses it, or why nothing does"),
  status: statusEnum,
  evidence: z.string().max(2000).describe("Where this was seen and when"),
  check_at: z.string().max(2000).describe("https link (or menu path) where Jason can check or revoke it"),
  verified_on: isoDate.nullable(),
};

export function registerConnectionsTools(server: McpServer) {
  server.registerTool(
    "get_connections_register",
    {
      title: "Connections Register",
      description:
        "Every access grant across Jason's accounts, automation tools and apps (Settings -> Connections), plus map-box details and the coverage list. Filter with status, hub or query.",
      inputSchema: z.object({
        status: statusEnum.optional(),
        hub: z.string().max(200).optional(),
        query: z.string().max(120).optional(),
        include_nodes: z.boolean().optional().describe("Default true. Set false to skip map-box details."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) =>
      runTool(async () => {
        const register = await getConnectionsRegister();
        const grants = filterGrants(register.grants, {
          status: args.status ?? "",
          hub: args.hub,
          query: args.query,
        });
        return {
          ok: true,
          total_grants: register.grants.length,
          counts: countByStatus(register.grants),
          grants,
          nodes: args.include_nodes === false ? undefined : register.nodes,
          coverage: register.coverage,
        };
      })
  );

  server.registerTool(
    "list_connection_changes",
    {
      title: "Connections Register history",
      description:
        "Grant changes (created, updated with field-by-field from/to, deleted) with who made them. Use since for a monthly review.",
      inputSchema: z.object({
        since: z.string().describe("ISO date or datetime").optional(),
        grant_id: grantId.optional(),
        limit: z.number().int().min(1).max(500).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(async () => ({ ok: true, changes: await listConnectionChanges(args) }))
  );

  server.registerTool(
    "upsert_connection_grant",
    {
      title: "Add or replace a grant",
      description:
        "Create a grant, or replace the one with the same id. Without id, the id is a slug of hub, target and identity. Omitted optional fields keep their stored values.",
      inputSchema: z.object({
        id: grantId.optional(),
        identity: grantFieldShape.identity,
        hub: grantFieldShape.hub,
        target: grantFieldShape.target,
        access: grantFieldShape.access.optional(),
        used_by: grantFieldShape.used_by.optional(),
        status: statusEnum.optional(),
        evidence: grantFieldShape.evidence.optional(),
        check_at: grantFieldShape.check_at.optional(),
        verified_on: grantFieldShape.verified_on.optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => ({ ok: true, grant: await upsertGrant(args, "claude") }))
  );

  server.registerTool(
    "update_connection_grant",
    {
      title: "Update a grant",
      description: "Change only the fields given on an existing grant, e.g. status or verified_on.",
      inputSchema: z.object({
        id: grantId,
        identity: grantFieldShape.identity.optional(),
        hub: grantFieldShape.hub.optional(),
        target: grantFieldShape.target.optional(),
        access: grantFieldShape.access.optional(),
        used_by: grantFieldShape.used_by.optional(),
        status: statusEnum.optional(),
        evidence: grantFieldShape.evidence.optional(),
        check_at: grantFieldShape.check_at.optional(),
        verified_on: grantFieldShape.verified_on.optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ id, ...patch }) => runTool(async () => ({ ok: true, grant: await updateGrant(id, patch, "claude") }))
  );

  server.registerTool(
    "delete_connection_grant",
    {
      title: "Delete a grant",
      description:
        "Remove a grant row. Prefer update_connection_grant with status revoked when access was removed, so the record stays. The deletion is kept in history.",
      inputSchema: z.object({ id: grantId }),
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ id }) => runTool(async () => ({ ok: true, ...(await deleteGrant(id, "claude")) }))
  );

  server.registerTool(
    "upsert_connection_node",
    {
      title: "Set map-box details",
      description:
        "Description, manage links and attached-item list for one map box. name must match a grant's identity, hub or target exactly. Omitted fields keep their stored values.",
      inputSchema: z.object({
        name: z.string().min(1).max(300),
        about: z.string().max(4000).optional(),
        manage: z
          .array(
            z.object({
              label: z.string().min(1).max(120),
              url: z.string().max(2000).nullable().optional().describe("https link; omit for a menu path"),
            })
          )
          .max(12)
          .optional(),
        items: z
          .array(
            z.object({
              name: z.string().min(1).max(200),
              used: z.boolean(),
              note: z.string().max(500).nullable().optional(),
            })
          )
          .max(200)
          .optional(),
        items_label: z.string().max(120).nullable().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => ({ ok: true, node: await upsertNode(args, "claude") }))
  );

  server.registerTool(
    "upsert_connection_coverage",
    {
      title: "Set coverage for a source",
      description: "Record whether a source of grants has been checked (Done, Partial, Not checked).",
      inputSchema: z.object({
        id: grantId.optional(),
        source: z.string().min(1).max(300),
        state: z.enum(COVERAGE_STATES),
        note: z.string().max(2000).optional(),
        sort_order: z.number().int().min(0).max(10000).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => ({ ok: true, coverage: await upsertCoverage(args, "claude") }))
  );

  server.registerTool(
    "import_connections_register",
    {
      title: "Bulk load the register",
      description:
        "Upsert many grants, nodes and coverage rows at once. payload_json is a JSON object with optional grants[], nodes[] and coverage[] arrays using the same fields as the single-row tools.",
      inputSchema: z.object({
        payload_json: z.string().min(2).max(800_000),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ payload_json }) =>
      runTool(async () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload_json);
        } catch {
          throw new Error("payload_json is not valid JSON.");
        }
        return { ok: true, imported: await importRegister(parsed, "claude") };
      })
  );
}
