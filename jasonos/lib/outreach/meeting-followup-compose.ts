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
  fillMeetingFollowupPrompt,
  isHollowFollowupBody,
} from "@/lib/outreach/meeting-followup-prompt";
import { loadMeetingFollowupPromptGuidance } from "@/lib/outreach/meeting-followup-prompt-store";
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

function draftFailsChecks(
  body: string,
  summary: string,
  whenPhrase: string
): boolean {
  return (
    isUnacceptableFollowupBody(body, summary) ||
    soundsLikePitchFollowup(body) ||
    hasWrongMeetingDayLanguage(body, whenPhrase) ||
    isHollowFollowupBody(body)
  );
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
  const displayName = who === "there" ? "Name" : who;
  const guidance = fillMeetingFollowupPrompt(
    await loadMeetingFollowupPromptGuidance(),
    {
      firstName: displayName,
      greeting,
      whenPhrase,
    }
  );
  // Deliberately NOT JASON_CORE_VOICE outreach rules (metric asks / Architect
  // framing). Catch-up follow-ups should sound like a person, not a pipeline.
  // Guidance text is editable in Settings → General.
  const system = `${JASON_IDENTITY}

${NO_AI_SLOP_WRITING_RULES}

${guidance}`;

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
    if (draftFailsChecks(draft.body, summary, whenPhrase)) {
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
            content: `Rewrite. Keep it warm and personal like a real reconnect note. The meeting was ${whenPhrase} — do not say today/this morning unless that is exact. Include one concrete takeaway from the meeting notes (something they said or that came up). Do not send hollow "good to reconnect / thanks for the conversation" fluff. Do not paste meeting notes. Do not pitch Jason's work or clients. First name greeting. JSON only.`,
          },
        ],
        providerOptions,
      });
      const retry = safeParseDraft(retryText);
      if (!retry || draftFailsChecks(retry.body, summary, whenPhrase)) {
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
