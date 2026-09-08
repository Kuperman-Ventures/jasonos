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
import {
  getConnectionStatus,
  getContact,
  getInboxDispatch,
  getJobAlerts,
  getMorningBrief,
  getOutreachQueue,
  listAlerts,
  listInterviewPreps,
  listJasonosAreas,
  listMeetings,
  listOutreachPeople,
  listPostMasterProjects,
  listProjects,
  listSuggestedContacts,
} from "./reads";
import { jsonResult, runTool } from "./result";

export const JASONOS_MCP_INSTRUCTIONS = `JasonOS is Jason Kuperman's personal command center. Four tracks: venture, advisors, job_search, personal.

You have full read access. Start with list_jasonos_areas or get_status. get_status.alerts lists the issues behind critical_alerts; get_alerts / list_alerts return the same records. Then pick the tool for the area Jason asked about (today, outreach, inbox, jobs, projects, brief). Use search_contacts or get_contact before drafting outreach.

Writes (add_todo, complete_todo, add_action_card, update_card, pin_card) change live JasonOS data — say what you changed.

Do not dump full JSON back to Jason. Summarize in plain English.`;

const trackSchema = z.enum(["venture", "advisors", "job_search", "personal"]).optional();

export function registerJasonosTools(server: McpServer) {
  server.registerTool(
    "get_status",
    {
      title: "JasonOS status",
      description:
        "Open cards, open to-dos, today's task count, and critical alerts. critical_alerts is the count; alerts[] is the actual issues. Use get_alerts or list_alerts for the full open-alert list.",
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
      description:
        "Job-application pipeline. One row per real application (NYUI follow-ups are linked, not counted twice). Status and result stay in sync.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(getScoreboard)
  );

  server.registerTool(
    "list_jasonos_areas",
    {
      title: "JasonOS map",
      description: "What Claude can see in JasonOS and which tool to use for each area.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => jsonResult(listJasonosAreas())
  );

  server.registerTool(
    "get_morning_brief",
    {
      title: "Morning brief",
      description: "Today's published morning brief, or the most recent one if today is not ready.",
      inputSchema: z.object({
        date: z.string().describe("YYYY-MM-DD").optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => getMorningBrief(args))
  );

  server.registerTool(
    "get_inbox_dispatch",
    {
      title: "Inbox dispatch",
      description: "Boarding, holding, and noise from the published inbox triage. Truncated bodies, no Gmail dump.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(getInboxDispatch)
  );

  server.registerTool(
    "get_outreach_queue",
    {
      title: "Outreach due",
      description: "Contacts whose next touch is due or overdue (America/New_York date).",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(80).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => getOutreachQueue(args))
  );

  server.registerTool(
    "list_outreach_people",
    {
      title: "Outreach people",
      description: "JasonOS people list. Filter by name/title search or intent.",
      inputSchema: z.object({
        query: z.string().max(80).optional(),
        intent: z.string().max(80).optional(),
        limit: z.number().int().min(1).max(60).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => listOutreachPeople(args))
  );

  server.registerTool(
    "get_contact",
    {
      title: "Get contact",
      description: "One contact plus recent touches. Pass id or name.",
      inputSchema: z.object({
        id: z.string().uuid().optional(),
        name: z.string().max(80).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => getContact(args))
  );

  server.registerTool(
    "list_suggested_contacts",
    {
      title: "Suggested contacts",
      description: "New contact candidates waiting to be added or dismissed.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => listSuggestedContacts(args))
  );

  server.registerTool(
    "list_meetings",
    {
      title: "Meetings",
      description: "Recent and upcoming JasonOS meeting records.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => listMeetings(args))
  );

  server.registerTool(
    "get_job_alerts",
    {
      title: "Job alerts",
      description: "Harvested job listings, keyword capsules, and last scan time.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(60).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => getJobAlerts(args))
  );

  server.registerTool(
    "list_interview_preps",
    {
      title: "Interview preps",
      description: "Saved interview prep records (company and role).",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(40).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => listInterviewPreps(args))
  );

  server.registerTool(
    "get_alerts",
    {
      title: "Alerts",
      description:
        "Open JasonOS alert records behind get_status.critical_alerts. Same data as list_alerts.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(60).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => listAlerts(args))
  );

  server.registerTool(
    "list_alerts",
    {
      title: "Alerts",
      description:
        "Open JasonOS alert records. Use this (or get_alerts) to see what get_status.critical_alerts refers to.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(60).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => listAlerts(args))
  );

  server.registerTool(
    "list_projects",
    {
      title: "Projects",
      description: "Active JasonOS projects and how many open to-dos each has.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(listProjects)
  );

  server.registerTool(
    "list_post_master_projects",
    {
      title: "Post Master",
      description: "Post Master drafts: title, step, topic. Not the full draft body.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(listPostMasterProjects)
  );

  server.registerTool(
    "get_connection_status",
    {
      title: "Connection status",
      description: "Which JasonOS integrations are connected. Never returns passwords or tokens.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(getConnectionStatus)
  );
}
