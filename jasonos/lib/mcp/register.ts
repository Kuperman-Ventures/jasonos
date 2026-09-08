import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  addActionCard,
  addTodo,
  completeTodo,
  getMustDos,
  getScoreboard,
  getStatus,
  getToday,
  listActionCards,
  listTodos,
  pinCard,
  searchContacts,
  updateCard,
} from "./operations";
import { runTool } from "./result";

export const JASONOS_MCP_INSTRUCTIONS = `JasonOS is Jason Kuperman's personal command center. Four tracks: venture, advisors, job_search, personal.

Start with get_status, then get_today or list_action_cards. Use search_contacts before drafting outreach. Writes (add_todo, complete_todo, add_action_card, update_card, pin_card) change live JasonOS data — say what you changed.

Do not dump full JSON back to Jason. Summarize in plain English.`;

const trackSchema = z.enum(["venture", "advisors", "job_search", "personal"]).optional();

export function registerJasonosTools(server: McpServer) {
  server.registerTool(
    "get_status",
    {
      title: "JasonOS status",
      description: "Open cards, open to-dos, today's task count, and critical alerts.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(getStatus)
  );

  server.registerTool(
    "get_today",
    {
      title: "Today queue",
      description: "Today's scheduled tasks and timer state (America/New_York date).",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(getToday)
  );

  server.registerTool(
    "list_action_cards",
    {
      title: "List action cards",
      description: "Action queue cards. Defaults to open cards, highest priority first.",
      inputSchema: z.object({
        track: trackSchema,
        state: z.enum(["open", "actioned", "dismissed", "snoozed", "archived"]).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => listActionCards(args))
  );

  server.registerTool(
    "get_must_dos",
    {
      title: "Must-dos",
      description: "Latest Best Next Action ranking plus the linked cards.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(getMustDos)
  );

  server.registerTool(
    "list_todos",
    {
      title: "List to-dos",
      description: "JasonOS to-dos. Defaults to open items.",
      inputSchema: z.object({
        track: trackSchema,
        state: z.enum(["open", "done"]).optional(),
        limit: z.number().int().min(1).max(80).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => listTodos(args))
  );

  server.registerTool(
    "add_todo",
    {
      title: "Add to-do",
      description: "Create an open to-do in JasonOS.",
      inputSchema: z.object({
        title: z.string().min(1).max(240),
        track: trackSchema,
        notes: z.string().max(4000).optional(),
        due_date: z.string().describe("YYYY-MM-DD").optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => addTodo(args))
  );

  server.registerTool(
    "complete_todo",
    {
      title: "Complete to-do",
      description: "Mark a JasonOS to-do done.",
      inputSchema: z.object({
        id: z.string().uuid(),
        completion_note: z.string().max(2000).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => completeTodo(args))
  );

  server.registerTool(
    "add_action_card",
    {
      title: "Add action card",
      description: "Push a card onto the JasonOS action queue.",
      inputSchema: z.object({
        title: z.string().min(1).max(240),
        track: trackSchema,
        subtitle: z.string().max(280).optional(),
        why_now: z.string().max(280).optional(),
        draft: z.string().max(4000).optional(),
        module: z.string().max(80).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => addActionCard(args))
  );

  server.registerTool(
    "update_card",
    {
      title: "Update card state",
      description: "Mark a card actioned, dismissed, snoozed, archived, or reopen it.",
      inputSchema: z.object({
        id: z.string().uuid(),
        state: z.enum(["actioned", "dismissed", "snoozed", "open", "archived"]),
        snoozed_until: z.string().describe("ISO datetime, required when state is snoozed").optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => updateCard(args))
  );

  server.registerTool(
    "pin_card",
    {
      title: "Pin or unpin card",
      description: "Pin a card to Today, or unpin it.",
      inputSchema: z.object({
        id: z.string().uuid(),
        pin: z.boolean(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => pinCard(args))
  );

  server.registerTool(
    "search_contacts",
    {
      title: "Search contacts",
      description: "Find JasonOS contacts by name, title, or notes.",
      inputSchema: z.object({
        query: z.string().min(1).max(80),
        limit: z.number().int().min(1).max(40).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => searchContacts(args))
  );

  server.registerTool(
    "get_scoreboard",
    {
      title: "Job scoreboard",
      description: "Job-application pipeline counts and the most recent applications.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(getScoreboard)
  );
}
