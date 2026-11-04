import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  getWebinarDigest,
  listWebinarTopics,
  publishSessionSchema,
  publishWebinarDigest,
  publishWebinarSession,
  scanWebinarCandidates,
  setWebinarSessionStatus,
} from "../webinars/store";
import { runTool } from "./result";

export const WEBINAR_TOOL_NAMES = [
  "list_webinar_topics",
  "list_webinar_candidates",
  "publish_webinar_session",
  "set_webinar_session_status",
  "publish_webinar_digest",
  "get_webinar_digest",
] as const;

export function registerWebinarTools(server: McpServer) {
  server.registerTool(
    "list_webinar_topics",
    {
      title: "List webinar topics",
      description:
        "Webinar topics ordered by sort_order, with session_count and takeaway_count for confirmed published sessions. Archived topics are omitted unless include_archived is true. publish_webinar_session only accepts status active.",
      inputSchema: z.object({
        include_archived: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) =>
      runTool(async () => {
        const result = await listWebinarTopics({
          include_archived: args.include_archived,
        });
        return { ok: true, topics: result.topics };
      })
  );

  server.registerTool(
    "list_webinar_candidates",
    {
      title: "List webinar candidates",
      description:
        "Scan calendar + Granola/Wispr for webinar sessions in the last N days (default 3, max 21). Returns session_key, status, detection, title, session_date, transcript (null for calendar_only, dismissed, and unconfirmed note_solo_long), notes_summary, transcript_url, and topics (active slug, name, description). Confirm note_solo_long rows on /webinars before summarizing.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(21).optional(),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) =>
      runTool(async () => {
        const [result, topicList] = await Promise.all([
          scanWebinarCandidates({ daysBack: args.days ?? 3 }),
          listWebinarTopics(),
        ]);
        return {
          ok: true,
          days: result.days_back,
          errors: result.errors,
          topics: topicList.topics
            .filter((topic) => topic.status === "active")
            .map((topic) => ({
              slug: topic.slug,
              name: topic.name,
              description: topic.description,
            })),
          sessions: result.sessions.map((s) => ({
            session_key: s.session_key,
            status: s.status,
            detection: s.detection,
            title: s.title,
            session_date: s.session_date,
            started_at: s.started_at,
            duration_minutes: s.duration_minutes,
            transcript_source: s.transcript_source,
            transcript_url: s.transcript_url,
            notes_summary: s.notes_summary,
            transcript: s.transcript,
            transcript_truncated: s.transcript_truncated ?? false,
          })),
        };
      })
  );

  server.registerTool(
    "publish_webinar_session",
    {
      title: "Publish webinar session",
      description:
        "payload_json is JSON: { session_key, title, topic_slug (required, from list_webinar_topics), host_org?, speakers?, summary_md?, proposed_topic?: { slug, name, reason }, takeaways: [{ text, lead?, topic_slug?, track?, relevance_note?, is_action? }] }. lead is a 3 to 8 word bold opening; text is the full sentence without repeating it. Unknown topic_slug is rejected with the active list.",
      inputSchema: z.object({
        payload_json: z.string().min(2).max(200_000),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) =>
      runTool(async () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(args.payload_json);
        } catch {
          throw new Error("payload_json is not valid JSON.");
        }
        const input = publishSessionSchema.parse(parsed);
        return publishWebinarSession(input);
      })
  );

  server.registerTool(
    "set_webinar_session_status",
    {
      title: "Set webinar session status",
      description:
        "Mark a webinar session candidate, confirmed (waiting for summary if unpublished), or dismissed. id comes from list_webinar_candidates / the Webinars page.",
      inputSchema: z.object({
        id: z.string().uuid(),
        status: z.enum(["candidate", "confirmed", "dismissed"]),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => setWebinarSessionStatus(args))
  );

  server.registerTool(
    "publish_webinar_digest",
    {
      title: "Publish webinar digest",
      description:
        "Upsert the Friday weekly webinar digest. week_start is the Monday (YYYY-MM-DD, America/New_York). body_md is markdown. Optional session_ids lists sessions covered.",
      inputSchema: z.object({
        week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        body_md: z.string().min(1).max(100_000),
        session_ids: z.array(z.string().uuid()).max(40).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => runTool(() => publishWebinarDigest(args))
  );

  server.registerTool(
    "get_webinar_digest",
    {
      title: "Get webinar digest",
      description:
        "That week's digest plus confirmed sessions and takeaways, including topic_slug. Default: Monday of the current week in America/New_York.",
      inputSchema: z.object({
        week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => runTool(() => getWebinarDigest(args))
  );
}
