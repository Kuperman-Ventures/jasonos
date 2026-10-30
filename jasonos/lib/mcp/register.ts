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
import {
  attachMeetingMcp,
  createDeckMcp,
  createPlaybookFromDeckMcp,
  getDeckMcp,
  getDefaultRubricMcp,
  getReviewMcp,
  getTranscriptMcp,
  listDecksMcp,
  listPlaybooksMcp,
  attachTranscriptMcp,
  pasteTranscriptMcp,
  listRecentNotesMcp,
  reviewRunMcp,
  getPersonContextMcp,
  runAiHelpMcp,
  setDeckSlidesMcp,
  setDefaultRubricMcp,
  setGoalMcp,
  setRubricMcp,
  updatePlaybookFromDeckMcp,
} from "./decks-tools";
import { publishInboxDispatch, publishMorningBrief } from "./publish";
import { registerCommitmentTools } from "./commitments-tools";
import { registerWebinarTools } from "./webinars-tools";
import { registerConnectionsTools } from "./connections-tools";
import { registerNetworkScreenTools } from "./network-screen-tools";
import { registerFybTools } from "./fyb-tools";
import { getProfessorRoadmap } from "@/lib/professor-roadmap/store";
import { jsonResult, runTool } from "./result";

export const JASONOS_MCP_INSTRUCTIONS = `JasonOS is Jason Kuperman's personal command center. Four tracks: venture, advisors, job_search, personal.

You have full read access. Start with list_jasonos_areas or get_status. get_status.alerts lists the issues behind critical_alerts; get_alerts / list_alerts return the same records. Then pick the tool for the area Jason asked about (today, outreach, inbox, jobs, projects, brief). Use search_contacts or get_contact before drafting outreach.

Writes (add_todo, complete_todo, add_action_card, update_card, pin_card, add_project_link, publish_morning_brief, publish_inbox_dispatch) change live JasonOS data — say what you changed.

Live flow: start on /live (blank deck, from a playbook, or Library). Work the deck — edit slides, rubric, Save as, AI help from people/playbook/open text/transcripts/meeting context, attach a calendar meeting anytime. Rehearse, then Run. Review scores slides, goal, and a Browning-style rubric. Held meetings lists past calendar meetings (10 days); attach_transcript from Granola/Wispr (full spoken transcript, not notes), paste_transcript as fallback, then review_run. list_recent_notes merges both sources. list_upcoming_meeting_preps returns deck_id when linked. Tools: list_playbooks / list_decks / get_deck, create_deck, set_deck_slides, set_goal, set_rubric, get_default_rubric / set_default_rubric, get_person_context, run_ai_help (optional preset why|rapport|what_how|tailor), attach_meeting, get_transcript, attach_transcript, paste_transcript, list_recent_notes, review_run / get_review, update_playbook_from_deck / create_playbook_from_deck.

File a plan, artifact, or doc on a project page with add_project_link. Read what is already filed with list_project_links. project_slug is the page's URL slug, for example ski-tracker.

To publish today's morning brief or inbox dispatch, use publish_morning_brief / publish_inbox_dispatch. Do not use a separate Supabase execute_sql connector.

If these tools are missing from a scheduled run, search for "jasonos" or "publish_morning_brief" first. As a fallback, POST the same payload to https://jasonos.vercel.app/api/morning-brief/publish or /api/inbox-dispatch/publish with the JasonOS Bearer password.

Connections Register (Settings -> Connections) tracks every access grant across Jason's accounts, automation tools and apps. Read it with get_connections_register and list_connection_changes. Keep it current with upsert_connection_grant, update_connection_grant, upsert_connection_node and upsert_connection_coverage; use import_connections_register for bulk loads. When access is removed, set status to revoked rather than deleting the row.

The weekday Commitment Check publishes to the Commitments panel on Home with publish_commitment_check. Call get_commitment_check first and leave out items Jason marked done or dismissed. Read it later with get_commitment_check; mark items with set_commitment_item_state.

Webinars: the weekday webinar run calls list_webinar_candidates, summarizes each session that has a transcript, and publishes with publish_webinar_session. Fridays it also calls publish_webinar_digest for the week. note_solo_long candidates wait for Jason to confirm on the Webinars page. If these tools are missing from a scheduled run, POST to https://jasonos.vercel.app/api/webinars/publish with the JasonOS Bearer password.

Network Screen (Custom Comms > Email) reads one person's visible LinkedIn connections and recommends three people Jason should ask that person to introduce him to, based on the job search. Jason starts a screen in JasonOS and gives Claude a capture prompt. Claude pages the connections in Chrome and calls import_network_screen with the rows. JasonOS chooses the three and drops the rest. Never score, rank, or draft in the import step, and never send the intro request. Jason sends from Apple Mail and marks it requested in JasonOS. Each recommended person can carry a forwardable intro blurb written in the connector's voice; Jason copies it or includes it in the email.

Fuck You Batman story state lives in JasonOS. Call get_fyb_state before any story work. Publish weekly decision options with upsert_fyb_decision. Record Jason's pick with record_fyb_decision only when he has stated it; never record a decision he has not made. Publish reference and later bible/drift/scene rows with upsert_fyb_entry. Entries with status changes_requested carry Jason's note in change_request; address it before saving. If these tools are missing from a scheduled run, GET or POST https://jasonos.vercel.app/api/fyb with the JasonOS Bearer password.

Professor Roadmap (Projects) tracks the path to teaching marketing, Seton Hall first. Read it with get_professor_roadmap. list_professor_open_questions returns what still needs research or a person to confirm. Research runs inside JasonOS; when Jason asks Claude to go deeper on a question, give the finding in chat and file the source doc with add_project_link using project_slug professor-roadmap. Never record a decision Jason has not stated.

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

  server.registerTool(
    "list_upcoming_meeting_preps",
    {
      title: "Upcoming meeting preps",
      description:
        "Upcoming calendar meeting preps for the next N Eastern days (default 7): id, title, starts_at, ends_at, attendees, deck_id when a deck is linked.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(30).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => listUpcomingMeetingPreps(args))
  );

  server.registerTool(
    "list_playbooks",
    {
      title: "Live playbooks",
      description: "Playbook templates: id, name, slide_count, updated_at.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(listPlaybooksMcp)
  );

  server.registerTool(
    "list_decks",
    {
      title: "Live decks",
      description: "Decks: id, name, meeting_prep_id, slide_count, updated_at.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(listDecksMcp)
  );

  server.registerTool(
    "get_deck",
    {
      title: "Get deck",
      description: "One deck with ordered headlines and bullets.",
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => getDeckMcp(args))
  );

  server.registerTool(
    "create_deck",
    {
      title: "Create deck",
      description:
        "Create a deck from a Playbook (playbook_id) or blank (omit playbook_id). Optional meeting_prep_id links the meeting.",
      inputSchema: z.object({
        playbook_id: z.string().uuid().optional(),
        meeting_prep_id: z.string().uuid().optional(),
        name: z.string().max(200).optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => createDeckMcp(args))
  );

  server.registerTool(
    "set_deck_slides",
    {
      title: "Set deck slides",
      description: "Replace all slides in a deck (headline + bullets per slide). Reorder by array order.",
      inputSchema: z.object({
        id: z.string().uuid(),
        slides: z.array(
          z.object({
            headline: z.string().max(240),
            bullets: z.array(z.string().max(800)),
          })
        ),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => setDeckSlidesMcp(args))
  );

  server.registerTool(
    "update_playbook_from_deck",
    {
      title: "Update playbook from deck",
      description:
        "Replace a source playbook's slides with copies of this deck's slides. Deck must have source_playbook_id.",
      inputSchema: z.object({ deck_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => updatePlaybookFromDeckMcp(args))
  );

  server.registerTool(
    "create_playbook_from_deck",
    {
      title: "Create playbook from deck",
      description:
        "Copy a deck's slides into a new playbook and set the deck's source_playbook_id to it.",
      inputSchema: z.object({
        deck_id: z.string().uuid(),
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => createPlaybookFromDeckMcp(args))
  );

  server.registerTool(
    "get_transcript",
    {
      title: "Get meeting transcript",
      description: "Fetch and store transcript for a deck (Granola first, then Wispr).",
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => getTranscriptMcp(args))
  );

  server.registerTool(
    "set_goal",
    {
      title: "Set deck or playbook goal",
      description: "One-line goal for the conversation.",
      inputSchema: z.object({
        deck_id: z.string().uuid(),
        goal: z.string().max(500),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => setGoalMcp(args))
  );

  server.registerTool(
    "get_person_context",
    {
      title: "Get person context for Live AI help",
      description:
        "Assemble labelled CRM/Browning sections for a contact (who they are, referral, why they agreed, brief, research, past conversations, said/committed, email, notes). Same payload Live AI help sends to the model.",
      inputSchema: z.object({
        contact_id: z.string().uuid(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => getPersonContextMcp(args))
  );

  server.registerTool(
    "run_ai_help",
    {
      title: "Run AI help on a deck",
      description:
        "Draft or edit slides from instructions plus optional sources (people, playbook, open text, transcripts, meeting context). mode add keeps existing slides; replace starts over. Pass preset why|rapport|what_how|tailor instead of free instructions for Browning one-click fills.",
      inputSchema: z.object({
        deck_id: z.string().uuid(),
        instructions: z.string().max(8000).optional(),
        mode: z.enum(["add", "replace"]).optional(),
        preset: z.enum(["why", "rapport", "what_how", "tailor"]).nullable().optional(),
        sources: z
          .object({
            people: z.array(z.string().uuid()).optional(),
            playbook_id: z.string().uuid().nullable().optional(),
            open_text: z.string().max(12000).nullable().optional(),
            transcript_deck_ids: z.array(z.string().uuid()).max(3).optional(),
            meeting: z
              .object({
                calendar: z.boolean().optional(),
                email: z.boolean().optional(),
                website: z.boolean().optional(),
              })
              .nullable()
              .optional(),
          })
          .default({}),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => runAiHelpMcp(args))
  );

  server.registerTool(
    "review_run",
    {
      title: "Review a deck run",
      description:
        "Mark each slide and the goal against the stored transcript; fill said / committed / next_time lists.",
      inputSchema: z.object({ deck_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => reviewRunMcp(args))
  );

  server.registerTool(
    "get_review",
    {
      title: "Get deck review",
      description: "Return stored review JSON and reviewed_at for a deck.",
      inputSchema: z.object({ deck_id: z.string().uuid() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => getReviewMcp(args))
  );

  server.registerTool(
    "attach_meeting",
    {
      title: "Attach or detach a meeting",
      description:
        "Link a deck to a meeting_prep_id, or pass null to detach. A meeting can only have one deck.",
      inputSchema: z.object({
        deck_id: z.string().uuid(),
        meeting_prep_id: z.string().uuid().nullable(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => attachMeetingMcp(args))
  );

  server.registerTool(
    "set_rubric",
    {
      title: "Set deck or playbook rubric",
      description: "Replace the plain-language rubric lines on a deck or playbook.",
      inputSchema: z.object({
        deck_id: z.string().uuid(),
        lines: z.array(z.string().max(500)).max(40),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => setRubricMcp(args))
  );

  server.registerTool(
    "get_default_rubric",
    {
      title: "Get default Live rubric",
      description: "The seeded default rubric used by new playbooks and blank decks.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(getDefaultRubricMcp)
  );

  server.registerTool(
    "set_default_rubric",
    {
      title: "Set default Live rubric",
      description:
        "Update the global default rubric. Does not change existing decks or playbooks.",
      inputSchema: z.object({
        lines: z.array(z.string().max(500)).max(40),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => setDefaultRubricMcp(args))
  );

  server.registerTool(
    "attach_transcript",
    {
      title: "Attach a transcript to a Live deck or meeting",
      description:
        "Attach the full spoken Granola or Wispr transcript (not AI meeting notes). Pass exactly one of meeting_prep_id or deck_id; with neither, pass name to create a deck with no meeting. Creates a slide-less deck when the meeting has none. Clears an existing review when clear_review is true. If the API only has notes/summary, use paste_transcript instead.",
      inputSchema: z.object({
        note_id: z.string().min(1),
        source: z.enum(["granola", "wispr"]),
        meeting_prep_id: z.string().uuid().nullable().optional(),
        deck_id: z.string().uuid().nullable().optional(),
        name: z.string().min(1).max(200).nullable().optional(),
        clear_review: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => attachTranscriptMcp(args))
  );

  server.registerTool(
    "paste_transcript",
    {
      title: "Paste a transcript onto a Live deck or meeting",
      description:
        "Save a full spoken transcript the user pasted (fallback when Granola/Wispr pull fails or returns notes only). Pass exactly one of meeting_prep_id or deck_id; with neither, pass name to create a deck with no meeting.",
      inputSchema: z.object({
        text: z.string().min(40).max(500_000),
        meeting_prep_id: z.string().uuid().nullable().optional(),
        deck_id: z.string().uuid().nullable().optional(),
        name: z.string().min(1).max(200).nullable().optional(),
        clear_review: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => pasteTranscriptMcp(args))
  );

  server.registerTool(
    "list_recent_notes",
    {
      title: "List recent Granola and Wispr notes",
      description:
        "Merged notes from Granola and Wispr for attaching transcripts. Newest first. Default days=10.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(45).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => runTool(() => listRecentNotesMcp(args))
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
    "get_professor_roadmap",
    {
      title: "Professor Roadmap",
      description:
        "Full Professor Roadmap payload: schools, people, postings, questions with findings and sources, next steps, and decisions.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => runTool(getProfessorRoadmap)
  );

  server.registerTool(
    "list_professor_open_questions",
    {
      title: "Professor open questions",
      description:
        "Professor Roadmap questions that are still open, or researched findings that still need a person to confirm.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      runTool(async () => {
        const roadmap = await getProfessorRoadmap();
        const personLine =
          /Still needs a person:\s*(.+)/i;
        return roadmap.questions
          .filter((q) => {
            if (q.status === "open") return true;
            if (q.status === "confirmed") return false;
            return personLine.test(q.findingMd) && !/No person needed/i.test(q.findingMd);
          })
          .map((q) => {
            const match = q.findingMd.match(personLine);
            return {
              id: q.id,
              sort_order: q.sortOrder,
              question: q.question,
              status: q.status,
              still_needs_a_person: match?.[1]?.trim() || null,
              finding_md: q.findingMd || null,
            };
          });
      })
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
  registerWebinarTools(server);
  registerFybTools(server);
}
