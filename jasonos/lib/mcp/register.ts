import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  addActionCard,
  addProjectLink,
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
  getMeetingPlan,
  getMorningBrief,
  getOutreachQueue,
  listAlerts,
  listInterviewPreps,
  listJasonosAreas,
  listMeetings,
  listOutreachPeople,
  listPostMasterProjects,
  listProjectLinks,
  listProjects,
  listSuggestedContacts,
  listUpcomingMeetingPreps,
  listWeeklyProvocations,
} from "./reads";
import { publishInboxDispatch, publishMorningBrief } from "./publish";
import { registerCommitmentTools } from "./commitments-tools";
import { registerConnectionsTools } from "./connections-tools";
import { registerNetworkScreenTools } from "./network-screen-tools";
import { registerFybTools } from "./fyb-tools";
import { jsonResult, runTool } from "./result";

/** Lazy-load plan tools so MCP unit tests do not pull server-only modules. */
async function plans() {
  return import("./plans");
}

export const JASONOS_MCP_INSTRUCTIONS = `JasonOS is Jason Kuperman's personal command center. Four tracks: venture, advisors, job_search, personal.

You have full read access. Start with list_jasonos_areas or get_status. get_status.alerts lists the issues behind critical_alerts; get_alerts / list_alerts return the same records. Then pick the tool for the area Jason asked about (today, outreach, inbox, jobs, projects, brief). Use search_contacts or get_contact before drafting outreach.

Writes (add_todo, complete_todo, add_action_card, update_card, pin_card, add_project_link, publish_morning_brief, publish_inbox_dispatch, build_call_sheet, set_call_sheet, create_sheet, use_sheet_for_meeting, mark_sheet_ready) change live JasonOS data — say what you changed.

Live calls run on a call sheet: one page per call, built from a playbook (Who, Why, What and how, Rapport, The conversation, Turn to me, The ask, Close, After for Browning calls). Plan the call sheet with Jason in conversation. Fill the Why and What-and-how lines in his words with set_call_sheet. Never write meeting_points or call_sheet_blocks through SQL. Start from list_upcoming_meeting_preps, get_call_sheet, and get_person or list_people for his history with the person. Write what he tells you, not your guesses, using the block keys and line labels get_call_sheet returns. build_call_sheet drafts the empty parts from research; Jason still confirms them. When he says the sheet is done, call mark_sheet_ready and tell him the refusal if it gives one. Use create_sheet for a call with no meeting yet and use_sheet_for_meeting to put it on one. The older names build_meeting_plan, set_meeting_plan, create_guide, use_guide_for_meeting, accept_meeting_plan, and get_meeting_plan still work for one release; prefer the call sheet tools.

File a plan, artifact, or doc on a project page with add_project_link. Read what is already filed with list_project_links. project_slug is the page's URL slug, for example ski-tracker.

To publish today's morning brief or inbox dispatch, use publish_morning_brief / publish_inbox_dispatch. Do not use a separate Supabase execute_sql connector.

If these tools are missing from a scheduled run, search for "jasonos" or "publish_morning_brief" first. As a fallback, POST the same payload to https://jasonos.vercel.app/api/morning-brief/publish or /api/inbox-dispatch/publish with the JasonOS Bearer password.

Connections Register (Settings -> Connections) tracks every access grant across Jason's accounts, automation tools and apps. Read it with get_connections_register and list_connection_changes. Keep it current with upsert_connection_grant, update_connection_grant, upsert_connection_node and upsert_connection_coverage; use import_connections_register for bulk loads. When access is removed, set status to revoked rather than deleting the row.

The weekday Commitment Check publishes to the Commitments panel on Home with publish_commitment_check. Call get_commitment_check first and leave out items Jason marked done or dismissed. Read it later with get_commitment_check; mark items with set_commitment_item_state.

Network Screen (Custom Comms > Email) scores a connector's visible LinkedIn network for intro requests. Jason starts a screen in JasonOS and gives Claude a capture prompt. Claude pages the connector's connections in Chrome and calls import_network_screen with the rows. JasonOS scores, tiers and drafts. Never score or draft in the import step, and never send the intro request. Jason sends from Apple Mail and marks it requested in JasonOS.

Fuck You Batman story state lives in JasonOS. Call get_fyb_state before any story work. Publish weekly decision options with upsert_fyb_decision. Record Jason's pick with record_fyb_decision only when he has stated it; never record a decision he has not made. Publish reference and later bible/drift/scene rows with upsert_fyb_entry. Entries with status changes_requested carry Jason's note in change_request; address it before saving. If these tools are missing from a scheduled run, GET or POST https://jasonos.vercel.app/api/fyb with the JasonOS Bearer password.

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
      description: "Open to-dos (soonest due first) and pinned open cards.",
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
        links: z
          .array(
            z.object({
              label: z.string().min(1).max(80),
              href: z.string().min(1).max(2000),
            })
          )
          .max(8)
          .optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => addActionCard(args))
  );

  server.registerTool(
    "update_card",
    {
      title: "Update card state",
      description:
        "Mark a card actioned, dismissed, snoozed, archived, or reopen it. Optional links replace body.links.",
      inputSchema: z.object({
        id: z.string().uuid(),
        state: z.enum(["actioned", "dismissed", "snoozed", "open", "archived"]),
        snoozed_until: z.string().describe("ISO datetime, required when state is snoozed").optional(),
        links: z
          .array(
            z.object({
              label: z.string().min(1).max(80),
              href: z.string().min(1).max(2000),
            })
          )
          .max(8)
          .optional(),
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
    "publish_morning_brief",
    {
      title: "Publish morning brief",
      description:
        "Write today's (or a given Eastern date's) morning brief markdown into JasonOS Home. Replaces that day's row if it already exists. Use this instead of Supabase execute_sql.",
      inputSchema: z.object({
        content_md: z.string().min(80).max(80_000),
        date: z.string().describe("YYYY-MM-DD America/New_York. Defaults to today.").optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => publishMorningBrief(args))
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
    "publish_inbox_dispatch",
    {
      title: "Publish inbox dispatch",
      description:
        "Write today's (or a given Eastern date's) inbox dispatch JSON into JasonOS Home. payload_json must be the InboxDispatch object (boarding, holding, noise). Replaces that day's row if it already exists. Use this instead of Supabase execute_sql.",
      inputSchema: z.object({
        payload_json: z.string().min(2).max(400_000),
        date: z.string().describe("YYYY-MM-DD America/New_York. Defaults to today.").optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => publishInboxDispatch(args))
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

  const planPointSchema = z.object({
    kind: z.enum(["agenda", "point", "question", "ask"]),
    headline: z.string().min(1).max(80),
    detail: z.string().max(400).optional(),
    listen_for: z.string().max(160).optional(),
    prepare_reactions: z.boolean().optional(),
    reactions: z.array(z.unknown()).optional(),
  });

  const sheetBlockSchema = z.object({
    key: z.string().min(1).max(80).describe("Block key from get_call_sheet, e.g. why, what_how, who, ask, close"),
    body: z.string().max(4000).nullable().optional().describe("Text blocks and the ask"),
    lines: z
      .array(
        z.object({
          label: z.string().max(120).optional().describe("Matches an existing line label; omit to fill by position"),
          text: z.string().max(2000),
        })
      )
      .max(12)
      .optional()
      .describe("Lines blocks such as Why and What and how"),
  });

  server.registerTool(
    "build_call_sheet",
    {
      title: "Build call sheet",
      description:
        "Start the meeting's call sheet from a playbook if it has none (playbook_id, or the playbook the person's status suggests), then fill empty, unconfirmed parts from research, email and the playbook. Returns the sheet with Used / Missing context. Jason confirms what Build wrote.",
      inputSchema: z.object({
        prep_id: z.string().uuid(),
        playbook_id: z.string().uuid().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).buildCallSheetTool(args))
  );

  server.registerTool(
    "set_call_sheet",
    {
      title: "Set call sheet",
      description:
        "Write a call sheet in Jason's words: blocks by key (Why and What and how as lines, labels from get_call_sheet), the outcome sentence, and points for The conversation (mode add or replace). Pass exactly one of prep_id (a meeting's sheet) or sheet_id (a sheet with no meeting). Unknown block keys and line labels are refused before anything is written. For a meeting with no sheet, starts it from playbook_id or the suggested playbook when blocks are given. Written blocks count as confirmed.",
      inputSchema: z.object({
        prep_id: z.string().uuid().optional(),
        sheet_id: z.string().uuid().optional(),
        playbook_id: z.string().uuid().optional(),
        blocks: z.array(sheetBlockSchema).max(20).optional(),
        outcome_sentence: z.string().max(400).optional(),
        points: z.array(planPointSchema).max(20).optional(),
        mode: z.enum(["add", "replace"]).optional().describe("Required with points"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).setCallSheet(args))
  );

  server.registerTool(
    "create_sheet",
    {
      title: "Create sheet",
      description:
        "Create a call sheet with no meeting yet. With playbook_id it gets the playbook's blocks (fill them with blocks); without, it needs a name and points. Returns id and /live/sheets/{id}. Put it on a meeting with use_sheet_for_meeting.",
      inputSchema: z.object({
        name: z.string().max(120).optional(),
        playbook_id: z.string().uuid().optional(),
        blocks: z.array(sheetBlockSchema).max(20).optional(),
        for: z.string().max(400).optional(),
        outcome_sentence: z.string().max(400).optional(),
        notes: z.string().max(2000).optional(),
        points: z.array(planPointSchema).max(20).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).createSheet(args))
  );

  server.registerTool(
    "use_sheet_for_meeting",
    {
      title: "Use sheet for meeting",
      description:
        "Put a sheet with no meeting onto a meeting prep. Its blocks move onto the meeting and placeholders fill from the person. Fails when the meeting already has a call sheet.",
      inputSchema: z.object({
        sheet_id: z.string().uuid(),
        prep_id: z.string().uuid(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).putSheetOnMeetingTool(args))
  );

  server.registerTool(
    "mark_sheet_ready",
    {
      title: "Mark sheet ready",
      description:
        "Mark a meeting's call sheet ready for Live. Refuses while a required block is empty or The conversation has no points, and returns the refusal to tell Jason.",
      inputSchema: z.object({
        prep_id: z.string().uuid(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).markSheetReadyTool(args))
  );

  server.registerTool(
    "get_call_sheet",
    {
      title: "Get call sheet",
      description:
        "A meeting's call sheet (prep_id) or a sheet with no meeting (sheet_id): playbook, person and call number, every block with its lines and whether it is filled, plus points and the outcome sentence for a meeting.",
      inputSchema: z.object({
        prep_id: z.string().uuid().optional(),
        sheet_id: z.string().uuid().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).getCallSheetTool(args))
  );

  server.registerTool(
    "get_person",
    {
      title: "Get person",
      description:
        "One person in Jason's networking pipeline: status, call count, next contact, to discuss next, open follow-ups, next meeting, and every held call with its debrief.",
      inputSchema: z.object({
        contact_id: z.string().uuid(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).getPersonTool(args))
  );

  server.registerTool(
    "list_people",
    {
      title: "List people",
      description:
        "Everyone in the networking pipeline (status set, not closed). Referrals past 48 hours first, then overdue next contacts, then by next contact date.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).listPeopleTool(args))
  );

  server.registerTool(
    "build_meeting_plan",
    {
      title: "Build meeting plan (earlier name)",
      description:
        "Earlier name, kept for one release; prefer build_call_sheet. Builds points from a playbook (proposal only — call accept_meeting_plan to write), a sheet (writes), or blank (AI draft). Returns Used / Missing context.",
      inputSchema: z.object({
        prep_id: z.string().uuid(),
        from: z.enum(["playbook", "guide", "blank"]),
        script_id: z.string().uuid().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).buildMeetingPlanTool(args))
  );

  server.registerTool(
    "accept_meeting_plan",
    {
      title: "Accept meeting plan (earlier name)",
      description:
        "Earlier name, kept for one release. Accept a playbook proposal from build_meeting_plan and write the kept points onto the meeting.",
      inputSchema: z.object({
        adaptation_id: z.string().uuid(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).acceptMeetingPlanTool(args))
  );

  server.registerTool(
    "set_meeting_plan",
    {
      title: "Set meeting plan (earlier name)",
      description:
        "Earlier name for set_call_sheet with points only, kept for one release. Writes the outcome sentence and points onto a meeting prep (clamps, research, email context). Never insert meeting_points via SQL.",
      inputSchema: z.object({
        prep_id: z.string().uuid(),
        outcome_sentence: z.string().max(400).optional(),
        points: z.array(planPointSchema).min(1).max(20),
        mode: z.enum(["add", "replace"]),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).setMeetingPlan(args))
  );

  server.registerTool(
    "create_guide",
    {
      title: "Create guide (earlier name)",
      description:
        "Earlier name for create_sheet without a playbook, kept for one release. Creates a sheet with points and no meeting. Returns id and /live/sheets/{id} URL.",
      inputSchema: z.object({
        name: z.string().min(1).max(120),
        for: z.string().max(400).optional(),
        outcome_sentence: z.string().max(400).optional(),
        notes: z.string().max(2000).optional(),
        points: z.array(planPointSchema).min(1).max(20),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).createGuide(args))
  );

  server.registerTool(
    "use_guide_for_meeting",
    {
      title: "Use guide for meeting (earlier name)",
      description:
        "Earlier name for use_sheet_for_meeting (script_id is the sheet id), kept for one release.",
      inputSchema: z.object({
        script_id: z.string().uuid(),
        prep_id: z.string().uuid(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(async () => (await plans()).useGuideForMeeting(args))
  );

  server.registerTool(
    "get_meeting_plan",
    {
      title: "Get meeting plan (earlier name)",
      description:
        "Earlier name, kept for one release; prefer get_call_sheet. Outcome sentence, points with live and confirmed states, review summary, and Granola URL for a meeting prep.",
      inputSchema: z.object({
        prep_id: z.string().uuid(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => getMeetingPlan(args))
  );

  server.registerTool(
    "list_upcoming_meeting_preps",
    {
      title: "Upcoming meeting preps",
      description:
        "Upcoming Live meeting preps for the next N Eastern days (default 7): id, title, starts_at, attendees, track, has_sheet, sheet_ready, sheet_status (ready, why_missing, not_ready, none), touch_number, call number, playbook, research_verified.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(30).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => listUpcomingMeetingPreps(args))
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
    "add_project_link",
    {
      title: "Add project link",
      description:
        "File a plan, artifact or doc under a JasonOS project page, keyed by the project's URL slug, e.g. ski-tracker.",
      inputSchema: z.object({
        project_slug: z.string().min(1).max(80),
        title: z.string().min(1).max(240),
        url: z.string().url().max(2000),
        kind: z.enum(["artifact", "doc", "file", "other"]).optional(),
        description: z.string().max(500).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => addProjectLink(args))
  );

  server.registerTool(
    "list_project_links",
    {
      title: "List project links",
      description: "Plans, artifacts, and docs filed under a JasonOS project page.",
      inputSchema: z.object({
        project_slug: z.string().min(1).max(80),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => listProjectLinks(args))
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
    "list_weekly_provocations",
    {
      title: "Weekly Provocation",
      description:
        "Weekly Provocation briefs from Will Duffy or Rover: subject, short brief, questions, and how many sources each question has. Not a drafted reply.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(listWeeklyProvocations)
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

  registerConnectionsTools(server);
  registerNetworkScreenTools(server);
  registerCommitmentTools(server);
  registerFybTools(server);
}
