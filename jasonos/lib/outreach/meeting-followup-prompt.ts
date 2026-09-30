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

export const MEETING_FOLLOWUP_PROMPT_PLACEHOLDERS = [
  "{{firstName}}",
  "{{greeting}}",
  "{{whenPhrase}}",
] as const;

export const DEFAULT_MEETING_FOLLOWUP_PROMPT = `You write a short post-meeting follow-up email for Jason to send in Apple Mail.

This is usually a reconnect / catch-up note, not a sales email.

Tone target (match this energy, do not copy wording):
"{{firstName}}, it was so good to catch up after all these years. Hard to believe it has been a decade since we last worked together.

I really enjoyed hearing about what you are building, and your perspective on where things are headed. Our conversation left me with a lot to think about.

More than anything, it was just great to reconnect. Let's not wait another ten years to do this again.

Jason"

Hard rules:
- Use ONLY facts present in MEETING NOTES. Do not invent intros, firms, roles, asks, beers, cities, or commitments.
- Use the person's first name. Never greet with a last name alone.
- Open with "{{greeting}}" on its own line (comma is fine; no em dash).
- 3-5 short sentences across 2-3 short paragraphs.
- DATE AWARENESS (critical): the meeting was {{whenPhrase}}. Never say "today", "this morning", "this afternoon", or "this evening" unless WHEN is exactly "today". Prefer natural phrasing that matches WHEN (e.g. "yesterday", "earlier this week", "last week", "the other day", or just "good to catch up" with no day word).
- Lead with warmth: glad to reconnect / catch up. If the notes mention shared history (old firm, years apart), reference that lightly.
- Then one human takeaway THEY said or that came out of the conversation — their work, a view they shared, something personal from the notes. Not a thesis pitch about Jason's business. When the notes have any substance, this takeaway is required. Do not send a hollow "good to reconnect / thanks for the conversation" note.
- Soft close: personal detail from the notes when present (city, family, "let's not wait N years"). Only add a concrete next step if the notes clearly support one both people owned.
- Do NOT pivot into Jason's clients, products, Equity Labs, Refactor Sprint, or "I'll keep X in mind given your role…" unless the notes show they asked for that or agreed a specific follow-up.
- Sign off with "Jason" on its own line. No exclamation points. No em dashes.
- Return JSON only: {"subject":"...","body":"..."}
- Subject: warm and short (e.g. "Good catching up", "Great to reconnect"). Avoid "Following up:" plus the calendar title.`;

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
      /\bit was (so )?good to (reconnect|catch up|talk|speak)( (to you|with you))?( (today|yesterday|last week|earlier this week|recently|a few weeks ago|a while back|the other day))?\b\.?/g,
      " "
    )
    .replace(/\bthanks again for the conversation\b\.?/g, " ")
    .replace(/\bgood (catching|to catch) up\b\.?/g, " ")
    .replace(/\bgreat to reconnect\b\.?/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutBoilerplate.length < 24;
}
