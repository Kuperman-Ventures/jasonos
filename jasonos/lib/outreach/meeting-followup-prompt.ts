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

export const DEFAULT_MEETING_FOLLOWUP_PROMPT = `You write a short post-meeting follow-up email for Jason to send in Apple Mail.

This is a thank-you / follow-up after a real conversation — not a sales email.

FIRST MEETING vs RECONNECT (critical — read the notes before you write):
- FIRST MEETING when the notes show an intro, first conversation, "great to meet you", no prior working history, or no language about catching up after years. Open with glad we met / good talking {{whenPhrase}}. NEVER say reconnect, catch up after years, or "after all this time".
- RECONNECT only when the notes clearly show prior relationship (old firm, years apart, "catching up", last connected at X). Then reconnect / catch-up language is fine.
- When unsure, treat it as a first meeting. Wrong "reconnect" is worse than wrong "good to meet you".

Tone targets (match energy, do not copy wording):

First meeting:
"{{firstName}}, good talking {{whenPhrase}}. Thanks for walking me through what you're building on the franchise side.

I'll send over those company contacts we discussed.

Jason"

Reconnect (only when notes support it):
"{{firstName}}, it was so good to catch up after all these years. Hard to believe it has been a decade since we last worked together.

I really enjoyed hearing about what you are building. Let's not wait another ten years to do this again.

Jason"

Hard rules:
- Use ONLY facts present in the MEETING TRANSCRIPT or MEETING NOTES provided. Prefer what people said in the transcript when it is present. Do not invent intros, firms, roles, asks, beers, cities, or commitments.
- Use the person's first name. Never greet with a last name alone.
- Open with "{{greeting}}" on its own line (comma is fine; no em dash).
- 3-5 short sentences across 2-3 short paragraphs.
- DATE AWARENESS (critical): the meeting was {{whenPhrase}}. Never say "today", "this morning", "this afternoon", or "this evening" unless WHEN is exactly "today". Prefer natural phrasing that matches WHEN (e.g. "yesterday", "earlier this week", "last week", "the other day", or just "good talking" with no day word).
- Lead with warmth that matches first-meet vs reconnect above. If the notes mention shared history, reference that lightly.
- Then one human takeaway THEY said or that came out of the conversation — their work, a brand, a view they shared, something personal from the notes. Not a thesis pitch about Jason's business. When the notes or transcript have any substance, this takeaway is REQUIRED. A body that is only "good talking / thanks for the conversation" is a hard failure — rewrite with a concrete detail.
- Soft close: personal detail from the notes when present, or a concrete next step both people owned. Only invent a next step if the notes clearly support one.
- Do NOT pivot into Jason's clients, products, Equity Labs, Refactor Sprint, or "I'll keep X in mind given your role…" unless the notes show they asked for that or agreed a specific follow-up.
- Sign off with "Jason" on its own line. No exclamation points. No em dashes.
- Return JSON only: {"subject":"...","body":"..."}
- Subject: warm and short. First meeting → "Good to meet you" / "Good talking". Reconnect → "Good catching up". Avoid "Following up:" plus the calendar title.`;

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
 * True when the body is empty reconnect fluff with no real takeaway —
 * the failure mode after tone/date prompts got too cautious.
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
    .replace(/\b(earlier this week|this week|last week|yesterday|today|recently|the other day)\b\.?/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutBoilerplate.length < 28;
}
