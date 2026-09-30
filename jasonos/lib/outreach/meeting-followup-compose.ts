// Turn a Granola meeting note into a short follow-up email Jason can send.
// Facts come only from the note. Nothing here is sent — the server action
// opens Apple Mail via mailto.

import "server-only";

import { generateText } from "ai";
import { hasDirectAnthropicKey, heavyModel } from "@/lib/ai/models";
import { JASON_IDENTITY } from "@/lib/ai/jason-identity";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { stripEmDashes } from "@/lib/email-templates/render";
import {
  firstName,
  hasWrongMeetingDayLanguage,
  isUnacceptableFollowupBody,
  meetingFollowupDraft,
  meetingWhenPhrase,
  soundsLikePitchFollowup,
} from "@/lib/outreach/meeting-followups";

export { isUnacceptableFollowupBody, soundsLikePitchFollowup };

export type MeetingFollowupComposeInput = {
  name: string | null;
  title: string;
  summary: string | null;
  /** Meeting start ISO — used so drafts do not say "today" for older calls. */
  startsAt?: string | null;
};

export type MeetingFollowupComposeResult = {
  subject: string;
  body: string;
  source: "ai" | "fallback";
};

function safeParseDraft(text: string): { subject: string; body: string } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      subject?: unknown;
      body?: unknown;
    };
    const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
    const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!body) return null;
    return { subject, body };
  } catch {
    return null;
  }
}

function polish(draft: { subject: string; body: string }): {
  subject: string;
  body: string;
} {
  return {
    subject: stripEmDashes(draft.subject).replace(/\s+/g, " ").trim(),
    body: stripEmDashes(draft.body)
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

export async function composeMeetingFollowupDraft(
  input: MeetingFollowupComposeInput
): Promise<MeetingFollowupComposeResult> {
  const whenPhrase = meetingWhenPhrase(input.startsAt);
  const fallback = polish(
    meetingFollowupDraft({
      name: input.name,
      title: input.title,
      summary: input.summary,
      startsAt: input.startsAt,
    })
  );
  const summary = input.summary?.trim() || "";
  if (!summary) {
    return { ...fallback, source: "fallback" };
  }

  const who = firstName(input.name);
  const greeting = who === "there" ? "Hi," : `${who},`;
  // Deliberately NOT JASON_CORE_VOICE outreach rules (metric asks / Architect
  // framing). Catch-up follow-ups should sound like a person, not a pipeline.
  const system = `${JASON_IDENTITY}

${NO_AI_SLOP_WRITING_RULES}

You write a short post-meeting follow-up email for Jason to send in Apple Mail.

This is usually a reconnect / catch-up note, not a sales email.

Tone target (match this energy, do not copy wording):
"${who === "there" ? "Name" : who}, it was so good to catch up after all these years. Hard to believe it has been a decade since we last worked together.

I really enjoyed hearing about what you are building, and your perspective on where things are headed. Our conversation left me with a lot to think about.

More than anything, it was just great to reconnect. Let's not wait another ten years to do this again.

Jason"

Hard rules:
- Use ONLY facts present in MEETING NOTES. Do not invent intros, firms, roles, asks, beers, cities, or commitments.
- Use the person's first name. Never greet with a last name alone.
- Open with "${greeting}" on its own line (comma is fine; no em dash).
- 3-5 short sentences across 2-3 short paragraphs.
- DATE AWARENESS (critical): the meeting was ${whenPhrase}. Never say "today", "this morning", "this afternoon", or "this evening" unless WHEN is exactly "today". Prefer natural phrasing that matches WHEN (e.g. "yesterday", "earlier this week", "last week", "the other day", or just "good to catch up" with no day word).
- Lead with warmth: glad to reconnect / catch up. If the notes mention shared history (old firm, years apart), reference that lightly.
- Then one human takeaway THEY said or that came out of the conversation - their work, a view they shared, something personal from the notes. Not a thesis pitch about Jason's business.
- Soft close: personal detail from the notes when present (city, family, "let's not wait N years"). Only add a concrete next step if the notes clearly support one both people owned.
- Do NOT pivot into Jason's clients, products, Equity Labs, Refactor Sprint, or "I'll keep X in mind given your role…" unless the notes show they asked for that or agreed a specific follow-up.
- Sign off with "Jason" on its own line. No exclamation points. No em dashes.
- Return JSON only: {"subject":"...","body":"..."}
- Subject: warm and short (e.g. "Good catching up", "Great to reconnect"). Avoid "Following up:" plus the calendar title.`;

  const user = `Recipient first name: ${who === "there" ? "(unknown)" : who}
Meeting title: ${input.title || "Meeting"}
WHEN the meeting happened (use this; do not invent a different day): ${whenPhrase}

MEETING NOTES (Granola — rewrite into a warm email, do not paste, do not pitch):
${summary.slice(0, 6000)}

Write the follow-up email JSON now.`;

  const providerOptions = hasDirectAnthropicKey()
    ? { anthropic: { thinking: { type: "disabled" as const } } }
    : undefined;

  try {
    const { text } = await generateText({
      model: heavyModel(),
      maxOutputTokens: 600,
      system,
      messages: [{ role: "user", content: user }],
      providerOptions,
    });
    const parsed = safeParseDraft(text);
    if (!parsed) return { ...fallback, source: "fallback" };
    const draft = polish({
      subject: parsed.subject || fallback.subject,
      body: parsed.body,
    });
    if (
      isUnacceptableFollowupBody(draft.body, summary) ||
      soundsLikePitchFollowup(draft.body) ||
      hasWrongMeetingDayLanguage(draft.body, whenPhrase)
    ) {
      // One retry with an explicit ban on the bad shape.
      const { text: retryText } = await generateText({
        model: heavyModel(),
        maxOutputTokens: 600,
        system,
        messages: [
          { role: "user", content: user },
          {
            role: "assistant",
            content: JSON.stringify(parsed),
          },
          {
            role: "user",
            content: `Rewrite. Keep it warm and personal like a real reconnect note. The meeting was ${whenPhrase} — do not say today/this morning unless that is exact. Do not paste meeting notes. Do not pitch Jason's work or clients. First name greeting. JSON only.`,
          },
        ],
        providerOptions,
      });
      const retry = safeParseDraft(retryText);
      if (
        !retry ||
        isUnacceptableFollowupBody(retry.body, summary) ||
        soundsLikePitchFollowup(retry.body) ||
        hasWrongMeetingDayLanguage(retry.body, whenPhrase)
      ) {
        return { ...fallback, source: "fallback" };
      }
      return {
        ...polish({
          subject: retry.subject || fallback.subject,
          body: retry.body,
        }),
        source: "ai",
      };
    }
    return { ...draft, source: "ai" };
  } catch (err) {
    console.error("[meeting-followup-compose]", err);
    return { ...fallback, source: "fallback" };
  }
}
