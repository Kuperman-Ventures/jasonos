import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  getCommitmentCheckForHome,
  listActiveItemStates,
  publishCommitmentCheck,
  setCommitmentItemState,
} from "../commitments/store";
import { runTool } from "./result";

export const COMMITMENT_TOOL_NAMES = [
  "publish_commitment_check",
  "get_commitment_check",
  "set_commitment_item_state",
] as const;

export function registerCommitmentTools(server: McpServer) {
  server.registerTool(
    "publish_commitment_check",
    {
      title: "Publish commitment check",
      description:
        "Write today's (or a given Eastern date's) Commitment Check into the JasonOS home page. payload_json is a JSON object: { generated_at?, sources?: { gmail: 'ok'|'unavailable', granola: 'ok'|'unavailable' }, delivered_count?, notes?, items: [{ key?, promise, to, due_date (YYYY-MM-DD or null), delivery?: 'not_delivered'|'possibly_delivered', evidence?, source?: 'gmail'|'granola'|'other', source_url?, context? }] }. Omit Delivered items; send only their count. Home recalculates Overdue / Due Today / Coming Up from due_date each day. Replaces that day's row if it exists.",
      inputSchema: z.object({
        payload_json: z.string().min(2).max(200_000),
        date: z.string().describe("YYYY-MM-DD America/New_York. Defaults to today.").optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => publishCommitmentCheck(args))
  );

  server.registerTool(
    "get_commitment_check",
    {
      title: "Commitment check",
      description:
        "The latest published Commitment Check as Home shows it (sections recalculated for today, items Jason marked done or dismissed removed), plus every item state Jason has set. The publisher should call this first and leave out items whose key is done or dismissed.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      runTool(async () => ({
        ok: true,
        check: await getCommitmentCheckForHome(),
        item_states: await listActiveItemStates(),
      }))
  );

  server.registerTool(
    "set_commitment_item_state",
    {
      title: "Mark a commitment",
      description:
        "Mark a commitment done, dismissed, snoozed until a date, scheduled (calendar work block set), or open again (clears the mark). item_key comes from get_commitment_check.",
      inputSchema: z.object({
        item_key: z.string().min(1).max(160),
        state: z.enum(["done", "dismissed", "snoozed", "scheduled", "open"]),
        snoozed_until: z.string().describe("YYYY-MM-DD, required when state is snoozed").optional(),
        note: z.string().max(500).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => setCommitmentItemState({ ...args, actor: "claude" }))
  );
}
