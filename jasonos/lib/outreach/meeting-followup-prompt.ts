/**
 * Editable guidance for post-meeting Follow Up drafts.
 * Stored on user_preferences.meeting_followup_prompt when Jason overrides
 * the default in Settings → General.
 *
 * This is a thank-you / close-the-loop email after a meeting — not an intro
 * ask (that lives on Network Screen → Draft the Ask). Same drafting shape
 * (short rules + labeled notes/transcript); different purpose.
 *
 * Placeholders filled at compose time:
 *   {{firstName}}   — recipient first name, or "Name"
 *   {{greeting}}    — "First," or "Hi,"
 *   {{whenPhrase}}  — "today" / "yesterday" / "last week" / …
 */

/** Max chars of meeting material sent to the draft model. */
export const MEETING_FOLLOWUP_SOURCE_MAX_CHARS = 12_000;

/**
 * Prefer transcript; keep a short notes preface when both exist so the model
 * still sees Granola's structured takeaways without crowding out the talk.
 * Labels match the Network Screen style (plain section headers).
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
      ? `Meeting notes:\n${summary.slice(0, notesBudget)}\n\n`
      : "";
    const label = "Meeting transcript:\n";
    const remaining = Math.max(500, maxChars - notesPart.length - label.length);
    return {
      material: `${notesPart}${label}${transcript.slice(0, remaining)}`,
      usedTranscript: true,
    };
  }
  if (summary) {
    return {
      material: `Meeting notes:\n${summary.slice(0, maxChars)}`,
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
 * Short DRAFT_RULES for a post-meeting thank-you / close-the-loop email.
 * Mirror Network Screen's brevity — long operator essays make the model
 * wander. Settings can override this whole block.
 */
export const DEFAULT_MEETING_FOLLOWUP_PROMPT = `This is a post-meeting thank-you / close-the-loop email Jason will send in Apple Mail. It is NOT an intro-request ask.

Recipient first name: {{firstName}}
Open the body with "{{greeting}}" on its own line.
The meeting was {{whenPhrase}} — never say today / this morning / this afternoon / this evening unless WHEN is exactly "today".

- Open on one specific thing they said or shared (a real detail from the notes or transcript). No "great to meet you", "good talking", "thanks for the conversation", "I hope this finds you", "I'd love to", "Enjoyed hearing you", "Also noted:", "You said you".
- Confirm what Jason owes them and when they will have it. Name the deliverable. If the source already has the link or intro, put it in this email. If not, say when you will send it. Never invent a link, name, or date. Never leave bracket placeholders like [link] or [name].
- Restate what they offered in one plain line so it is easy for them to act on. If they offered nothing, skip this.
- Include one giving line tied to something useful for them from the meeting. If the notes have nothing to give, leave it out — do not invent reciprocity.
- End with one next step and a specific time (a weekday or "by Friday"). Not "let's stay in touch".
- 120 words or fewer. Plain sentences. Hyphens, not em dashes. No exclamation points.
- Never use a product or project name the recipient would not know. Describe the work in the terms used in the meeting notes.
- State goals as goals. If Next Steps say "Review LinkedIn", write "I'll review…" — never "I reviewed…".
- If Next Steps say check out their site or a link they shared, that is Jason's owe — do not pitch their own site back to them.
- Nothing personal and no asks for third parties in this email.
- FIRST MEETING vs RECONNECT: treat as first meeting unless the source clearly shows prior relationship. Never say reconnect / catch up after years on a first meeting.
- Sign off with "Jason" on its own line.

Return STRICT JSON only:
{"subject":"...","body":"...","confirmFacts":["fact to verify before sending", "..."]}

Subject: short and specific to what they said or what you owe. Avoid "Following up:" plus the calendar title. confirmFacts may be [].`;

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
 * thank-you follow-up (the failure mode Jason keeps hitting).
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
  // Local template / stitcher leftovers — never ship these.
  if (/\byou said you\b/.test(stripped)) return true;
  if (/\bi'?ll follow through on what we discussed\b/.test(stripped)) return true;
  if (/\bi'?ll send the (concrete )?follow-up i owe you\b/.test(stripped)) return true;
  if (/\bi'?ll keep the ask on my side until i have something useful\b/.test(stripped)) {
    return true;
  }
  if (/\byou offered to offered\b/.test(stripped)) return true;
  if (/\bstuck with me\b/.test(stripped) && /:/.test(stripped) && stripped.length < 220) {
    // "You sharing anecdotes: Jeff's passport… stuck with me."
    return true;
  }
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
    /\bi'?ll send the (concrete )?follow-up i owe you\b/i.test(body) ||
    /\byou offered to offered\b/i.test(body) ||
    /\[[^\]]{1,80}\]/.test(body) ||
    /\bi reviewed (your|the) linkedin\b/i.test(body) ||
    /^[^\n]*\bgood talking\b/im.test(body)
  );
}
