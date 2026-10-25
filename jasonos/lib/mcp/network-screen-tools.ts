import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { runTool } from "./result";

export const NETWORK_SCREEN_TOOL_NAMES = [
  "import_network_screen",
  "get_network_screen",
  "list_pending_intros",
] as const;

const degree = z.enum(["1st", "2nd", "3rd"]).nullable().optional();

export function registerNetworkScreenTools(server: McpServer) {
  server.registerTool(
    "import_network_screen",
    {
      title: "Import a Network Screen",
      description:
        "Replace the captured people on a Network Screen. Call this after paging the connector's visible LinkedIn connections. Do not score, rank, or draft. Max 200 people.",
      inputSchema: z.object({
        screen_id: z.string().uuid(),
        connector_degree: degree.describe("Degree shown on the connector's profile."),
        total_count_label: z
          .string()
          .max(40)
          .nullable()
          .optional()
          .describe('Connections label on the profile, for example "500+".'),
        candidates: z
          .array(
            z.object({
              name: z.string().min(1).max(200),
              headline: z.string().max(500).nullable().optional(),
              location: z.string().max(200).nullable().optional(),
              linkedin_degree: degree,
              mutual_connections: z.string().max(500).nullable().optional(),
              linkedin_url: z.string().max(500).nullable().optional(),
            })
          )
          .max(200),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) =>
      runTool(async () => {
        const { importNetworkScreen } = await import("../server-actions/network-screen");
        const result = await importNetworkScreen(args);
        if (!result.ok) throw new Error(result.error);
        return result;
      })
  );

  server.registerTool(
    "get_network_screen",
    {
      title: "Read a Network Screen",
      description:
        "Read one Network Screen: connector, counts by bucket and tier, Tier 1 and Tier 2 lists, and the draft if one exists. Does not change anything.",
      inputSchema: z.object({
        screen_id: z.string().uuid(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ screen_id }) =>
      runTool(async () => {
        const { getNetworkScreen } = await import("../server-actions/network-screen");
        const loaded = await getNetworkScreen(screen_id);
        if (!loaded.ok) throw new Error(loaded.error);
        const screen = loaded.screen;
        const bucket: Record<string, number> = {};
        const tier: Record<string, number> = {};
        for (const person of screen.candidates) {
          bucket[person.bucket] = (bucket[person.bucket] ?? 0) + 1;
          tier[person.tier] = (tier[person.tier] ?? 0) + 1;
        }
        const slim = (person: (typeof screen.candidates)[number]) => ({
          id: person.id,
          name: person.name,
          headline: person.headline,
          title: person.title,
          company: person.company,
          bucket: person.bucket,
          tier: person.tier,
          why: person.why,
          ask: person.ask,
          next_action: person.nextAction,
          queue_status: person.queueStatus,
        });
        return {
          ok: true,
          screen: {
            id: screen.id,
            status: screen.status,
            connector_name: screen.connectorName,
            connector_linkedin_url: screen.connectorLinkedinUrl,
            connector_degree: screen.connectorDegree,
            visible_count: screen.visibleCount,
            total_count_label: screen.totalCountLabel,
            relationship_warmth: screen.relationshipWarmth,
            partner_note: screen.partnerNote,
          },
          counts: { bucket, tier },
          tier1: screen.candidates.filter((person) => person.tier === "tier1").map(slim),
          tier2: screen.candidates.filter((person) => person.tier === "tier2").map(slim),
          draft:
            screen.draftSubject || screen.draftBody
              ? { subject: screen.draftSubject, body: screen.draftBody }
              : null,
        };
      })
  );

  server.registerTool(
    "list_pending_intros",
    {
      title: "Pending intro requests",
      description:
        "Tier 1 people still queued or already requested, across every Network Screen, with the connector's name. Read-only.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      runTool(async () => {
        const { listPendingIntros } = await import("../server-actions/network-screen");
        const result = await listPendingIntros();
        if (!result.ok) throw new Error(result.error);
        return { ok: true, intros: result.intros };
      })
  );
}
