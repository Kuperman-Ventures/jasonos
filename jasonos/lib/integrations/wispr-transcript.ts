/** Wispr get_meeting pages transcripts at ~12k chars with this marker. */
export const WISPR_TRUNCATION_MARKER_RE =
  /\(\.\.\.truncated, (\d+) chars remaining; continue with view_transcript\.start_char=(\d+)\.\.\.\)/;

export const WISPR_TRANSCRIPT_MAX_CHARS = 400_000;
export const WISPR_TRANSCRIPT_MAX_PAGES = 40;

export function transcriptHasPagingMarker(text: string): boolean {
  return WISPR_TRUNCATION_MARKER_RE.test(text);
}

export function stripPagingMarker(text: string): {
  text: string;
  nextStart: number | null;
  remaining: number | null;
} {
  const trimmed = text.trimEnd();
  const match = trimmed.match(WISPR_TRUNCATION_MARKER_RE);
  if (!match || match.index == null) {
    // Drop Wispr wrapper noise when present without a marker.
    return {
      text: trimmed
        .replace(/<<<END TRANSCRIPT>>>\s*$/i, "")
        .replace(/^<<<START TRANSCRIPT>>>\s*/i, "")
        .trimEnd(),
      nextStart: null,
      remaining: null,
    };
  }
  const remaining = Number(match[1]);
  const nextStart = Number(match[2]);
  // Keep only the transcript body before the marker; ignore wrappers after it.
  const body = trimmed
    .slice(0, match.index)
    .replace(/^<<<START TRANSCRIPT>>>\s*/i, "")
    .trimEnd();
  return {
    text: body,
    nextStart: Number.isFinite(nextStart) ? nextStart : null,
    remaining: Number.isFinite(remaining) ? remaining : null,
  };
}

/**
 * Join pre-fetched Wispr transcript pages (each may end with the paging marker).
 * Pure — used by unit tests and by getWisprTranscript.
 */
export function joinWisprTranscriptPages(pages: string[]): {
  text: string;
  complete: boolean;
} {
  const chunks: string[] = [];
  let complete = true;
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index] ?? "";
    const stripped = stripPagingMarker(page);
    if (stripped.text) chunks.push(stripped.text);
    const joined = chunks.join("\n").trim();
    if (joined.length >= WISPR_TRANSCRIPT_MAX_CHARS) {
      return {
        text: joined.slice(0, WISPR_TRANSCRIPT_MAX_CHARS),
        complete: false,
      };
    }
    if (stripped.nextStart != null) {
      if (index === pages.length - 1) {
        // More pages were indicated but not provided.
        complete = false;
      }
      continue;
    }
  }
  if (pages.length >= WISPR_TRANSCRIPT_MAX_PAGES) {
    const last = pages[pages.length - 1] ?? "";
    if (transcriptHasPagingMarker(last)) complete = false;
  }
  return { text: chunks.join("\n").trim(), complete };
}

export type WisprToolCaller = (
  name: string,
  args: Record<string, unknown>
) => Promise<{ text: string; json: unknown; isError: boolean }>;

function transcriptFromMeetingPayload(
  json: unknown,
  fallbackText: string
): string {
  const root =
    json && typeof json === "object" && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : null;
  if (typeof root?.transcript === "string" && root.transcript.trim()) {
    return root.transcript.trim();
  }
  if (typeof root?.text === "string" && root.text.trim()) {
    return root.text.trim();
  }
  // Sometimes the tool returns the transcript body as plain text with a marker.
  return fallbackText.trim();
}

/**
 * Fetch the full Wispr transcript by paging view_transcript.start_char.
 */
export async function fetchWisprTranscriptPages(
  meetingId: string,
  callTool: WisprToolCaller
): Promise<{ text: string; complete: boolean }> {
  const id = meetingId.trim();
  if (!id) return { text: "", complete: false };

  const pages: string[] = [];
  let startChar = 0;
  let complete = true;

  for (let page = 0; page < WISPR_TRANSCRIPT_MAX_PAGES; page += 1) {
    const result = await callTool("get_meeting", {
      meeting_id: id,
      view_transcript: { start_char: startChar },
    });
    if (result.isError) {
      complete = pages.length > 0 ? false : false;
      break;
    }
    const chunk = transcriptFromMeetingPayload(result.json, result.text);
    if (!chunk) {
      if (page === 0) return { text: "", complete: false };
      break;
    }
    pages.push(chunk);
    const stripped = stripPagingMarker(chunk);
    const joinedSoFar = joinWisprTranscriptPages(pages);
    if (joinedSoFar.text.length >= WISPR_TRANSCRIPT_MAX_CHARS) {
      return { text: joinedSoFar.text, complete: false };
    }
    if (stripped.nextStart == null) {
      return { text: joinedSoFar.text, complete: true };
    }
    if (stripped.nextStart <= startChar) {
      // Guard against a stuck cursor.
      return { text: joinedSoFar.text, complete: false };
    }
    startChar = stripped.nextStart;
    if (page === WISPR_TRANSCRIPT_MAX_PAGES - 1) {
      complete = false;
    }
  }

  const joined = joinWisprTranscriptPages(pages);
  return { text: joined.text, complete: complete && joined.complete };
}
