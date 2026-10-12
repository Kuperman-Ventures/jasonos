import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { parseDecisionInput } from "../fuck-you-batman/logic";
import {
  approveEntry,
  getSnapshot,
  recordDecision,
  upsertDecision,
  upsertEntry,
} from "../fuck-you-batman/store";
import { FYB_ENTRY_KINDS } from "../fuck-you-batman/types";
import { runTool } from "./result";

export const FYB_TOOL_NAMES = [
  "get_fyb_state",
  "upsert_fyb_decision",
  "record_fyb_decision",
  "upsert_fyb_entry",
  "approve_fyb_entry",
] as const;

const kindEnum = z.enum(FYB_ENTRY_KINDS);

export function registerFybTools(server: McpServer) {
  server.registerTool(
    "get_fyb_state",
    {
      title: "Fuck You Batman story state",
      description:
        "Current week and phase, every story decision, story entries, and a markdown snapshot. Call this before any Fuck You Batman story work. Optional kind filter: reference, bible_character, bible_world, bible_rule, bible_timeline, drift_stage, drift_clue, drift_pattern, scene.",
      inputSchema: z.object({
        kind: kindEnum.optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => getSnapshot({ kind: args.kind }))
  );

  server.registerTool(
    "upsert_fyb_decision",
    {
      title: "Publish a Fuck You Batman decision",
      description:
        "Create or update a story decision and its options. Does not record Jason's pick. On a decided row, question/context/options can still be edited; chosen_option_key, custom_answer, jason_note and status are left alone unless reopen is true (which opens the decision again). decision_json is a JSON object: { decision_key (slug, e.g. ending), week, phase, question, context?, options: [{ key, label, summary, strengths: string[], holes: string[] }], sort_order? }. HTTP fallback: POST https://jasonos.vercel.app/api/fyb { action: 'upsert_decision', payload }.",
      inputSchema: z.object({
        decision_json: z.string().min(2).max(200_000),
        reopen: z.boolean().optional().describe("Set true to clear Jason's pick and mark the decision open again."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) =>
      runTool(() => {
        const input = parseDecisionInput(args.decision_json);
        return upsertDecision({ ...input, reopen: args.reopen ?? input.reopen });
      })
  );

  server.registerTool(
    "record_fyb_decision",
    {
      title: "Record Jason's Fuck You Batman pick",
      description:
        "Record the option Jason chose, or his own answer. Only call this when Jason has stated the pick in this chat. chosen_option_key is an option key from get_fyb_state, or 'custom' with custom_answer. Never invent a decision Jason has not made.",
      inputSchema: z.object({
        decision_key: z.string().min(1).max(80),
        chosen_option_key: z.string().min(1).max(80),
        custom_answer: z.string().max(8000).optional(),
        jason_note: z.string().max(4000).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => recordDecision({ ...args, actor: "claude" }))
  );

  server.registerTool(
    "upsert_fyb_entry",
    {
      title: "Publish a Fuck You Batman entry",
      description:
        "Create or update one story entry (reference, bible, drift, or scene). Does not approve it. entry_json is a JSON object: { kind, entry_key, title, body_md?, data?: object, links?: string[] (kind:entry_key), sort_order? }. HTTP fallback: POST https://jasonos.vercel.app/api/fyb { action: 'upsert_entry', payload }.",
      inputSchema: z.object({
        entry_json: z.string().min(2).max(200_000),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => upsertEntry(args.entry_json, "claude"))
  );

  server.registerTool(
    "approve_fyb_entry",
    {
      title: "Approve a Fuck You Batman entry",
      description:
        "Mark one story entry approved. kind and entry_key come from get_fyb_state. Only call this when Jason has signed off.",
      inputSchema: z.object({
        kind: kindEnum,
        entry_key: z.string().min(1).max(80),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => approveEntry({ ...args, actor: "claude" }))
  );
}
