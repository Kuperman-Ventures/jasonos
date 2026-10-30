/**
 * Wispr Notetaker via remote MCP (https://api.wisprflow.ai/connect/mcp).
 * Settings OAuth tokens first. Parallel to Granola while Jason shifts over.
 */
import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  resolveWisprAccessToken,
  WISPR_MCP_URL,
  saveWisprConfig,
  loadWisprConnectionRow,
  wisprIsConnected,
} from "@/lib/integrations/wispr-oauth";
import { fetchWisprTranscriptPages } from "@/lib/integrations/wispr-transcript";

export {
  transcriptHasPagingMarker,
  stripPagingMarker,
  WISPR_TRUNCATION_MARKER_RE,
} from "@/lib/integrations/wispr-transcript";

export interface WisprSearchResult {
  found: boolean;
  summary?: string;
  url?: string;
  meetingId?: string;
  error?: string;
}

export type WisprNote = {
  id: string;
  title: string;
  createdAt: string;
  summary: string | null;
  transcript: string | null;
  url: string | null;
  attendeeEmails: string[];
  attendeeNames: string[];
  calendarEventId: string | null;
  scheduledStart: string | null;
  folders: string[];
  durationMinutes: number | null;
  participantCount: number;
};

type ToolContent = { type?: string; text?: string };

function toolText(result: { content?: ToolContent[]; isError?: boolean }): string {
  const parts = (result.content ?? [])
    .filter((c) => c?.type === "text" && typeof c.text === "string")
    .map((c) => c.text!.trim())
    .filter(Boolean);
  return parts.join("\n\n").trim();
}

function tryParseJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function withWisprClient<T>(
  fn: (client: Client) => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const token = await resolveWisprAccessToken();
  if (!token) {
    return {
      ok: false,
      error: "Wispr Notetaker is not connected. Open Settings and click Connect Wispr.",
    };
  }
  const transport = new StreamableHTTPClientTransport(new URL(WISPR_MCP_URL), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const client = new Client({ name: "jasonos", version: "1.0.0" }, { capabilities: {} });
  try {
    await client.connect(transport);
    const value = await fn(client);
    return { ok: true, value };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wispr MCP request failed.";
    if (/401|unauthorized|invalid_token|forbidden/i.test(message)) {
      return {
        ok: false,
        error: "Wispr rejected the session. Reconnect Wispr Notetaker in Settings.",
      };
    }
    return { ok: false, error: message };
  } finally {
    try {
      await client.close();
    } catch {
      // ignore
    }
  }
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<{ text: string; json: unknown; isError: boolean }> {
  const result = await client.callTool({ name, arguments: args });
  const text = toolText(result as { content?: ToolContent[] });
  return {
    text,
    json: tryParseJson(text),
    isError: Boolean((result as { isError?: boolean }).isError),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function meetingIdFrom(row: Record<string, unknown>): string | null {
  const id = row.meeting_id ?? row.id ?? row.meetingId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function pickMeetings(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) {
    return json.filter((row): row is Record<string, unknown> => Boolean(asRecord(row)));
  }
  const root = asRecord(json);
  if (!root) return [];
  for (const key of ["meetings", "results", "items", "data"]) {
    const value = root[key];
    if (Array.isArray(value)) {
      return value.filter((row): row is Record<string, unknown> => Boolean(asRecord(row)));
    }
  }
  if (meetingIdFrom(root)) return [root];
  return [];
}

function titleOf(row: Record<string, unknown>): string {
  const title = row.title ?? row.name ?? row.meeting_title;
  return typeof title === "string" && title.trim() ? title.trim() : "Untitled meeting";
}

function summaryOf(row: Record<string, unknown>): string | null {
  for (const key of ["summary", "notes_excerpt", "excerpt", "preview", "content"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function urlOf(row: Record<string, unknown>): string | null {
  for (const key of ["share_link", "url", "web_url", "link"]) {
    const value = row[key];
    if (typeof value === "string" && value.startsWith("http")) return value;
  }
  return null;
}

function startOf(row: Record<string, unknown>): string | null {
  for (const key of ["start", "starts_at", "started_at", "scheduled_start", "created_at"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function endOf(row: Record<string, unknown>): string | null {
  for (const key of ["end", "ends_at", "ended_at", "scheduled_end"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function foldersOf(row: Record<string, unknown>): string[] {
  const raw = row.folders;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) out.push(item.trim());
    else if (item && typeof item === "object") {
      const name = (item as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) out.push(name.trim());
    }
  }
  return out;
}

function attendeesOf(row: Record<string, unknown>): {
  emails: string[];
  names: string[];
} {
  const raw = row.attendees ?? row.participants ?? row.people;
  if (!Array.isArray(raw)) return { emails: [], names: [] };
  const emails: string[] = [];
  const names: string[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.email === "string" && rec.email.includes("@")) {
      emails.push(rec.email.trim().toLowerCase());
    }
    if (typeof rec.name === "string" && rec.name.trim()) names.push(rec.name.trim());
  }
  return { emails, names };
}

function durationMinutesOf(row: Record<string, unknown>): number | null {
  const explicit =
    row.duration_minutes ?? row.durationMinutes ?? row.duration;
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return Math.round(explicit);
  }
  const start = startOf(row);
  const end = endOf(row);
  if (!start || !end) return null;
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60_000);
}

/** Health check for Settings — calls get_account_info. */
export async function testWisprConnection(): Promise<{
  ok: boolean;
  message: string;
  accountName?: string;
}> {
  if (!(await wisprIsConnected())) {
    return {
      ok: false,
      message: "Wispr Notetaker is not connected. Click Connect Wispr to sign in.",
    };
  }
  const result = await withWisprClient(async (client) => {
    const account = await callTool(client, "get_account_info", {});
    return account;
  });
  if (!result.ok) return { ok: false, message: result.error };
  if (result.value.isError) {
    return { ok: false, message: result.value.text || "Wispr returned an error." };
  }
  const json = asRecord(result.value.json);
  const name =
    (typeof json?.name === "string" && json.name) ||
    (typeof json?.display_name === "string" && json.display_name) ||
    (typeof json?.email === "string" && json.email) ||
    undefined;
  const email = typeof json?.email === "string" ? json.email : null;
  const row = await loadWisprConnectionRow();
  if (row?.user_id) {
    await saveWisprConfig(
      row.user_id,
      { account_name: name ?? null, account_email: email },
      { status: "connected", message: name ? `Signed in as ${name}.` : "Wispr Notetaker connected." }
    );
  }
  return {
    ok: true,
    message: name ? `Wispr Notetaker connected as ${name}.` : "Wispr Notetaker connected.",
    accountName: name,
  };
}

/**
 * Find a Wispr meeting for a person / calendar event.
 * Prefer calendar id match; else search by name/email.
 */
export async function searchWisprForContact(input: {
  contactName: string;
  email?: string | null;
  emails?: string[] | null;
  aroundIso?: string | null;
  calendarEventId?: string | null;
  calendarEventIds?: string[] | null;
  meetingTitle?: string | null;
  lookbackDays?: number;
  includeTranscript?: boolean;
}): Promise<WisprSearchResult> {
  const name = input.contactName.trim();
  if (!name) return { found: false };
  if (!(await wisprIsConnected())) {
    return { found: false, error: "Wispr Notetaker is not connected." };
  }

  const eventIds = [input.calendarEventId, ...(input.calendarEventIds ?? [])].filter(
    (value): value is string => Boolean(value?.trim())
  );
  const emails = [
    ...(input.email ? [input.email] : []),
    ...((input.emails ?? []).filter(Boolean) as string[]),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));

  const around = input.aroundIso ? Date.parse(input.aroundIso) : NaN;
  const backDays = Number.isFinite(around)
    ? 2
    : Math.max(3, Math.min(60, input.lookbackDays ?? 30));
  const since = new Date(
    (Number.isFinite(around) ? around : Date.now()) - backDays * 86_400_000
  ).toISOString();
  const until = new Date(
    (Number.isFinite(around) ? around : Date.now()) + 86_400_000
  ).toISOString();

  const result = await withWisprClient(async (client) => {
    // Calendar-linked recording first.
    for (const calendarId of eventIds) {
      try {
        const byCal = await callTool(client, "get_meeting_by_calendar_id", {
          calendar_id: calendarId,
        });
        if (!byCal.isError) {
          const detail = asRecord(byCal.json) ?? {};
          const meetingId = meetingIdFrom(detail);
          const summary =
            (typeof detail.summary === "string" && detail.summary.trim()) ||
            (typeof detail.content === "string" && detail.content.trim()) ||
            byCal.text;
          let fullTranscript: string | null = null;
          if (input.includeTranscript && meetingId) {
            const paged = await fetchWisprTranscriptPages(meetingId, (name, args) =>
              callTool(client, name, args)
            );
            fullTranscript = paged.text || null;
          }
          if (summary || fullTranscript) {
            return {
              found: true as const,
              summary: appendTranscript(
                summary || fullTranscript || "",
                detail,
                input.includeTranscript,
                fullTranscript
              ),
              url: urlOf(detail) ?? undefined,
              meetingId: meetingId ?? undefined,
            };
          }
        }
      } catch {
        // try next id / fall through to search
      }
    }

    const query = [name, input.meetingTitle?.trim()].filter(Boolean).join(" ");
    const search = await callTool(client, "search_meetings", {
      query,
      since,
      until,
      ...(emails.length ? { attendee_emails: emails.slice(0, 8) } : {}),
      limit: 10,
    });
    if (search.isError) {
      return { found: false as const, error: search.text || "Wispr search failed." };
    }
    const meetings = pickMeetings(search.json);
    if (!meetings.length && search.text) {
      // Free-text search hit with no structured payload — still useful.
      return { found: true as const, summary: search.text.slice(0, 12_000) };
    }
    if (!meetings.length) {
      return { found: false as const, error: "No Wispr note for this call yet." };
    }

    const ranked = meetings
      .map((row) => ({
        row,
        score:
          (titleOf(row).toLowerCase().includes(name.toLowerCase()) ? 2 : 0) +
          (input.meetingTitle &&
          titleOf(row).toLowerCase().includes(input.meetingTitle.toLowerCase())
            ? 2
            : 0) +
          (summaryOf(row) ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0]!.row;
    const id = meetingIdFrom(best);
    if (!id) {
      const summary = summaryOf(best) ?? titleOf(best);
      return {
        found: true as const,
        summary,
        url: urlOf(best) ?? undefined,
      };
    }

    const detailCall = await callTool(client, "get_meeting", {
      meeting_id: id,
    });
    const detail = asRecord(detailCall.json) ?? best;
    const summary =
      (typeof detail.summary === "string" && detail.summary.trim()) ||
      (typeof detail.content === "string" && detail.content.trim()) ||
      summaryOf(best) ||
      detailCall.text ||
      titleOf(best);
    let fullTranscript: string | null = null;
    if (input.includeTranscript) {
      const paged = await fetchWisprTranscriptPages(id, (name, args) =>
        callTool(client, name, args)
      );
      fullTranscript = paged.text || null;
    }
    return {
      found: true as const,
      summary: appendTranscript(summary, detail, input.includeTranscript, fullTranscript),
      url: urlOf(detail) ?? urlOf(best) ?? undefined,
      meetingId: id,
    };
  });

  if (!result.ok) return { found: false, error: result.error };
  return result.value;
}

function appendTranscript(
  summary: string,
  detail: Record<string, unknown>,
  include?: boolean,
  fullTranscript?: string | null
): string {
  if (!include) return summary.slice(0, 12_000);
  const transcript =
    (fullTranscript?.trim() ||
      (typeof detail.transcript === "string" ? detail.transcript.trim() : "")) ||
    "";
  if (!transcript) return summary.slice(0, 12_000);
  if (summary.includes(transcript.slice(0, 80))) return transcript;
  return `${summary}\n\n--- Transcript ---\n${transcript}`;
}

/** Full Wispr transcript with paging; no truncation markers in the result. */
export async function getWisprTranscript(
  meetingId: string
): Promise<{ text: string; complete: boolean } | null> {
  const id = meetingId.trim();
  if (!id) return null;
  if (!(await wisprIsConnected())) return null;
  const result = await withWisprClient(async (client) =>
    fetchWisprTranscriptPages(id, (name, args) => callTool(client, name, args))
  );
  if (!result.ok) return null;
  if (!result.value.text.trim()) return null;
  return result.value;
}

/** Recent meetings for Sync scanners (commitments, enrich). */
export async function listRecentWisprNotes(opts?: {
  daysBack?: number;
  limit?: number;
  includeTranscript?: boolean;
}): Promise<{ ok: true; notes: WisprNote[] } | { ok: false; error: string }> {
  if (!(await wisprIsConnected())) {
    return { ok: false, error: "Wispr Notetaker is not connected." };
  }
  const daysBack = Math.max(1, Math.min(45, opts?.daysBack ?? 14));
  const limit = Math.max(1, Math.min(25, opts?.limit ?? 12));
  const since = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const until = new Date(Date.now() + 86_400_000).toISOString();

  const result = await withWisprClient(async (client) => {
    const search = await callTool(client, "search_meetings", {
      query: "",
      since,
      until,
      limit,
    });
    // Empty query may fail — fall back to a broad recent query.
    const listed =
      search.isError || !pickMeetings(search.json).length
        ? await callTool(client, "search_meetings", {
            query: "meeting",
            since,
            until,
            limit,
          })
        : search;
    const meetings = pickMeetings(listed.json).slice(0, limit);
    const notes: WisprNote[] = [];
    for (const row of meetings) {
      const id = meetingIdFrom(row);
      let summary = summaryOf(row);
      let transcript: string | null = null;
      let url = urlOf(row);
      let title = titleOf(row);
      let scheduledStart = startOf(row);
      let merged: Record<string, unknown> = { ...row };
      if (id) {
        try {
          const detailCall = await callTool(client, "get_meeting", {
            meeting_id: id,
          });
          const detail = asRecord(detailCall.json) ?? {};
          merged = { ...row, ...detail };
          summary =
            (typeof detail.summary === "string" && detail.summary.trim()) ||
            (typeof detail.content === "string" && detail.content.trim()) ||
            summary;
          if (opts?.includeTranscript) {
            const paged = await fetchWisprTranscriptPages(id, (name, args) =>
              callTool(client, name, args)
            );
            transcript = paged.text || null;
          }
          url = urlOf(detail) ?? url;
          title = titleOf(merged);
          scheduledStart = startOf(detail) ?? scheduledStart;
        } catch {
          // keep search stub
        }
      }
      if (!summary && !transcript) continue;
      const people = attendeesOf(merged);
      notes.push({
        id: id ?? `wispr:${title}:${scheduledStart ?? ""}`,
        title,
        createdAt: scheduledStart ?? new Date().toISOString(),
        summary,
        transcript,
        url,
        attendeeEmails: people.emails,
        attendeeNames: people.names,
        calendarEventId: null,
        scheduledStart,
        folders: foldersOf(merged),
        durationMinutes: durationMinutesOf(merged),
        participantCount: people.emails.length || people.names.length,
      });
    }
    return notes;
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, notes: result.value };
}
