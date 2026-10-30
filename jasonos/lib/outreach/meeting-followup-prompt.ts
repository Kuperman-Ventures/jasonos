/**
 * Editable guidance for post-meeting Follow Up drafts.
 * Stored on user_preferences.meeting_followup_prompt when Jason overrides
 * the default in Settings → General.
 *
 * Placeholders filled at compose time:
 *   {{firstName}}   — recipient first name, or "there"
 *   {{greeting}}    — "First," or "Hi,"
 *   {{whenPhrase}}  — "today" / "yesterday" / "last week" / …
 */

/** Max chars of meeting material sent to the draft model. */
export const MEETING_FOLLOWUP_SOURCE_MAX_CHARS = 12_000;

/**
 * Prefer transcript; keep a short notes preface when both exist so the model
 * still sees Granola's structured takeaways without crowding out the talk.
 */
export function buildMeetingFollowupSourceMaterial(input: {
  summary?: string | null;
  transcript?: string | null;
  maxChars?: number;
}): { material: string; usedTranscript: boolean } {
  const maxChars = Math.max(2_000, input.maxChars ?? MEETING_FOLLOWUP_SOURCE_MAX_CHARS);
  const transcript = input.transcript?.trim() || "";
  const summary = input.summary?.trim() || "";
  if (transcript) {
    const notesBudget = summary ? Math.min(1_500, Math.floor(maxChars * 0.12)) : 0;
    const notesPart = summary
      ? `MEETING NOTES (short):\n${summary.slice(0, notesBudget)}\n\n`
      : "";
    const label = "MEETING TRANSCRIPT (primary source — base the email on this):\n";
    const remaining = Math.max(500, maxChars - notesPart.length - label.length);
    return {
      material: `${notesPart}${label}${transcript.slice(0, remaining)}`,
      usedTranscript: true,
    };
  }
  if (summary) {
    return {
      material: `MEETING NOTES:\n${summary.slice(0, maxChars)}`,
      usedTranscript: false,
    };
  }
  return { material: "", usedTranscript: false };
}

export const MEETING_FOLLOWUP_PROMPT_PLACEHOLDERS = [
  "{{firstName}}",
  "{{greeting}}",
  "{{whenPhrase}}",
] as const;

/**
 * Jason's operator prompt for post-meeting follow-ups. Settings can override.
 * Output shape is fixed so compose can open Apple Mail and surface confirmFacts.
 */
export const DEFAULT_MEETING_FOLLOWUP_PROMPT = `Turn the transcript / meeting notes into a follow-up email Jason will send in Apple Mail.

Recipient first name for the greeting line: {{firstName}}
Open the body with "{{greeting}}" on its own line (comma is fine).
The meeting was {{whenPhrase}} — never say today / this morning / this afternoon / this evening unless WHEN is exactly "today".

Before writing, decide:
- What does this person know about me? Only what the meeting and our history in the source support. Nothing else may appear unexplained.
- What words do they use for their work? Write in those words.
- What is the one line where I give them something instead of asking?

Write the email:
- Open with one line about a specific thing they said. No "great to meet you", no "good talking", no "I hope this finds you", no "I'd love to", no "thanks for the conversation", no "Enjoyed hearing you…", no "Also noted:", no "You said you…", no "I'll follow through on what we discussed".
- Confirm what I owe them and when they will have it. Name the deliverable (LinkedIn intros, a link, a doc). If it is a link or an intro, put it in this email rather than promising it.
- Restate what they offered in one line so it is easy for them to act on.
- Include the giving line.
- End with one next step and a specific time. Not "let's stay in touch".
- 120 words or fewer. Plain sentences. Hyphens, not em dashes.
- No insider shorthand. No product or project names unless I explained them in the meeting (or they did).
- State goals as goals. Never describe what I am trying to do as something I have done.
- Nothing personal and no asks for third parties in this email.
- Sign off with "Jason" on its own line. No exclamation points.

Before delivering, read it line by line as the recipient: do I understand this word, is it true based on what was said, why is this person writing now, what does this ask cost me. Fix anything that fails.

FIRST MEETING vs RECONNECT:
- FIRST MEETING when the source shows an intro / first conversation / no prior working history. NEVER say reconnect, catch up after years, or "after all this time".
- RECONNECT only when the source clearly shows prior relationship.
- When unsure, treat it as a first meeting.

Return JSON only:
{"subject":"...","body":"...","confirmFacts":["fact I should verify before sending", "..."]}

Subject: short and specific to what they said or what you owe them. Avoid "Following up:" plus the calendar title. Avoid generic "Good talking" / "Good to meet you" unless nothing else is supported.
confirmFacts may be an empty array when nothing needs checking.`;

export type MeetingFollowupPromptVars = {
  firstName: string;
  greeting: string;
  whenPhrase: string;
};

/** Trimmed override, or null when empty (use default). */
export function normalizeMeetingFollowupPrompt(
  value: string | null | undefined
): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

export function resolveMeetingFollowupPrompt(
  stored: string | null | undefined
): string {
  return normalizeMeetingFollowupPrompt(stored) ?? DEFAULT_MEETING_FOLLOWUP_PROMPT;
}

export function fillMeetingFollowupPrompt(
  template: string,
  vars: MeetingFollowupPromptVars
): string {
  return template
    .replaceAll("{{firstName}}", vars.firstName)
    .replaceAll("{{greeting}}", vars.greeting)
    .replaceAll("{{whenPhrase}}", vars.whenPhrase);
}

/**
 * True when the body is empty fluff / stitched-note fallback with no real
 * operator follow-up (the failure mode Jason keeps hitting).
 */
export function isHollowFollowupBody(body: string): boolean {
  const stripped = body
    .replace(/\r\n/g, "\n")
    .replace(/^Hi,?\s*/i, "")
    .replace(/^[A-Za-z][A-Za-z'’.-]{0,40},\s*/u, "")
    .replace(/\n*Jason\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!stripped) return true;
  if (stripped.length < 48) return true;

  // Mechanical notes-stitcher leftovers.
  if (/\benjoyed hearing you\b/.test(stripped)) return true;
  if (/\balso noted:\b/.test(stripped)) return true;
  // Local fallback that only pastes a bio bullet + a vague owe.
  if (/\byou said you\b/.test(stripped)) return true;
  if (/\bi'?ll follow through on what we discussed\b/.test(stripped)) return true;
  if (/\bi'?ll send the follow-up i owe you\b/.test(stripped)) return true;
  if (
    /\byou (said|mentioned)\b/.test(stripped) &&
    /\bfollow through on what we discussed\b/.test(stripped)
  ) {
    return true;
  }

  const withoutBoilerplate = stripped
    .replace(
      /\bit was (so )?good to (reconnect|catch up|talk|speak|meet( you)?)( (to you|with you))?( (today|yesterday|last week|earlier this week|this week|recently|a few weeks ago|a while back|the other day))?\b\.?/g,
      " "
    )
    .replace(
      /\bgood talking( through)?( (today|yesterday|last week|earlier this week|this week|recently|a few weeks ago|a while back|the other day))?\b\.?/g,
      " "
    )
    .replace(/\bthanks again for the conversation\b\.?/g, " ")
    .replace(/\bthanks for the conversation\b\.?/g, " ")
    .replace(/\bthanks for (your )?time\b\.?/g, " ")
    .replace(/\bgood (catching|to catch) up\b\.?/g, " ")
    .replace(/\bgreat to (reconnect|meet you)\b\.?/g, " ")
    .replace(/\bi always enjoy our conversations\b\.?/g, " ")
    .replace(/\blooking forward to staying in touch\b\.?/g, " ")
    .replace(/\blet'?s stay in touch\b\.?/g, " ")
    .replace(/\bi'?d love to\b\.?/g, " ")
    .replace(/\bi hope this finds you\b\.?/g, " ")
    .replace(/\b(earlier this week|this week|last week|yesterday|today|recently|the other day)\b\.?/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutBoilerplate.length < 28;
}

/** Phrases Jason's prompt bans in openings / filler. */
export function hasBannedFollowupPhrases(body: string): boolean {
  return (
    /\bgreat to meet you\b/i.test(body) ||
    /\bi hope this finds you\b/i.test(body) ||
    /\bi'?d love to\b/i.test(body) ||
    /\blet'?s stay in touch\b/i.test(body) ||
    /\bthanks again for the conversation\b/i.test(body) ||
    /\benjoyed hearing you\b/i.test(body) ||
    /\balso noted:\b/i.test(body) ||
    /\byou said you\b/i.test(body) ||
    /\bi'?ll follow through on what we discussed\b/i.test(body) ||
    /^[^\n]*\bgood talking\b/im.test(body)
  );
}
