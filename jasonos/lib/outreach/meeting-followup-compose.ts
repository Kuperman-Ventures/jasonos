// Turn a Granola / Wispr meeting transcript (preferred) or note into a short
// follow-up email Jason can send. Facts come only from that source. Nothing
// here is sent — the server action opens Apple Mail via mailto.

import "server-only";

import { generateText } from "ai";
import { hasDirectAnthropicKey, heavyModel } from "@/lib/ai/models";
import { JASON_IDENTITY } from "@/lib/ai/jason-identity";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { stripEmDashes } from "@/lib/email-templates/render";
import {
  buildMeetingFollowupSourceMaterial,
  fillMeetingFollowupPrompt,
  isHollowFollowupBody,
} from "@/lib/outreach/meeting-followup-prompt";
import { loadMeetingFollowupPromptGuidance } from "@/lib/outreach/meeting-followup-prompt-store";
import {
  firstName,
  guessFollowupDisplayName,
  hasWrongMeetingDayLanguage,
  isUnacceptableFollowupBody,
  meetingFollowupDraft,
  meetingWhenPhrase,
  notesLookLikeFirstMeeting,
  soundsLikePitchFollowup,
  soundsLikeWrongReconnect,
} from "@/lib/outreach/meeting-followups";

export { isUnacceptableFollowupBody, soundsLikePitchFollowup };

export type MeetingFollowupComposeInput = {
  name: string | null;
  title: string;
  /** Granola / Wispr AI notes. Used when no transcript is available. */
  summary: string | null;
  /**
   * Spoken transcript (speaker lines). Preferred over summary — Home Draft
   * follow-up should read the conversation, not only the AI note.
   */
  transcript?: string | null;
  /** Meeting start ISO — used so drafts do not say "today" for older calls. */
  startsAt?: string | null;
  /** Fallback when guest display name is missing (e.g. simon@…). */
  email?: string | null;
};

export type MeetingFollowupComposeResult = {
  subject: string;
  body: string;
  source: "ai" | "fallback";
  /** True when the draft was written from spoken transcript lines. */
  usedTranscript: boolean;
};

export {
  buildMeetingFollowupSourceMaterial,
  MEETING_FOLLOWUP_SOURCE_MAX_CHARS,
} from "@/lib/outreach/meeting-followup-prompt";

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

function hardFail(
  body: string,
  summary: string,
  whenPhrase: string
): boolean {
  return (
    isUnacceptableFollowupBody(body, summary) ||
    soundsLikePitchFollowup(body) ||
    hasWrongMeetingDayLanguage(body, whenPhrase) ||
    soundsLikeWrongReconnect(body, summary)
  );
}

function draftFailsChecks(
  body: string,
  summary: string,
  whenPhrase: string
): boolean {
  return hardFail(body, summary, whenPhrase) || isHollowFollowupBody(body);
}

export async function composeMeetingFollowupDraft(
  input: MeetingFollowupComposeInput
): Promise<MeetingFollowupComposeResult> {
  const whenPhrase = meetingWhenPhrase(input.startsAt);
  const resolvedName =
    guessFollowupDisplayName({
      name: input.name,
      email: input.email,
      title: input.title,
    }) ?? input.name;
  const { material, usedTranscript } = buildMeetingFollowupSourceMaterial({
    summary: input.summary,
    transcript: input.transcript,
  });
  // Checks + first-meet detection can use notes or a transcript excerpt.
  const checkSource =
    input.summary?.trim() ||
    input.transcript?.trim()?.slice(0, 4_000) ||
    "";
  const fallback = polish(
    meetingFollowupDraft({
      name: resolvedName,
      title: input.title,
      summary: checkSource || input.summary,
      startsAt: input.startsAt,
    })
  );
  if (!material) {
    return { ...fallback, source: "fallback", usedTranscript: false };
  }

  const who = firstName(resolvedName);
  const greeting = who === "there" ? "Hi," : `${who},`;
  const displayName = who === "there" ? "Name" : who;
  const firstMeet = notesLookLikeFirstMeeting(checkSource);
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

  const meetingKind = firstMeet
    ? "FIRST MEETING (do not say reconnect / catch up after years)"
    : "RECONNECT / catch-up (notes show prior relationship)";
  const sourceLabel = usedTranscript
    ? "the meeting transcript (what people said)"
    : "the meeting notes";
  const takeawayHint = usedTranscript
    ? "something said in the transcript"
    : "the notes";
  const user = `Recipient first name: ${who === "there" ? "(unknown)" : who}
Meeting title: ${input.title || "Meeting"}
Meeting kind: ${meetingKind}
WHEN the meeting happened (use this; do not invent a different day): ${whenPhrase}

Source: ${sourceLabel}. Rewrite into a warm email. Do not paste. Do not pitch.

${material}

Write the follow-up email JSON now. Include one concrete takeaway from ${takeawayHint}.`;

  const providerOptions = hasDirectAnthropicKey()
    ? { anthropic: { thinking: { type: "disabled" as const } } }
    : undefined;

  const rewriteHint = firstMeet
    ? `Rewrite. This was a first meeting — never say reconnect or catch up after years. Keep it warm like a real thank-you after meeting someone. The meeting was ${whenPhrase} — do not say today/this morning unless that is exact. Include one concrete takeaway from ${takeawayHint}. Do not send hollow fluff. Do not paste ${
        usedTranscript ? "transcript lines" : "meeting notes"
      }. Do not pitch Jason's work or clients. First name greeting ("${greeting}"). JSON only.`
    : `Rewrite. Keep it warm and personal like a real catch-up note. The meeting was ${whenPhrase} — do not say today/this morning unless that is exact. Include one concrete takeaway from ${takeawayHint}. Do not send hollow "good to reconnect / thanks for the conversation" fluff. Do not paste ${
        usedTranscript ? "transcript lines" : "meeting notes"
      }. Do not pitch Jason's work or clients. First name greeting ("${greeting}"). JSON only.`;

  try {
    const { text } = await generateText({
      model: heavyModel(),
      maxOutputTokens: 700,
      system,
      messages: [{ role: "user", content: user }],
      providerOptions,
    });
    const parsed = safeParseDraft(text);
    if (!parsed) return { ...fallback, source: "fallback", usedTranscript };
    let draft = polish({
      subject: parsed.subject || fallback.subject,
      body: parsed.body,
    });
    if (!draftFailsChecks(draft.body, checkSource, whenPhrase)) {
      return { ...draft, source: "ai", usedTranscript };
    }

    // Up to two rewrites when notes/transcript exist — never hand back the
    // empty template just because the first pass was hollow.
    let lastParsed = parsed;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { text: retryText } = await generateText({
        model: heavyModel(),
        maxOutputTokens: 700,
        system,
        messages: [
          { role: "user", content: user },
          {
            role: "assistant",
            content: JSON.stringify(lastParsed),
          },
          { role: "user", content: rewriteHint },
        ],
        providerOptions,
      });
      const retry = safeParseDraft(retryText);
      if (!retry) continue;
      lastParsed = retry;
      draft = polish({
        subject: retry.subject || fallback.subject,
        body: retry.body,
      });
      if (!draftFailsChecks(draft.body, checkSource, whenPhrase)) {
        return { ...draft, source: "ai", usedTranscript };
      }
      // Hard failures (paste / pitch / wrong day) keep rewriting.
      // Hollow-only: accept if the body has more substance than the template.
      if (
        !hardFail(draft.body, checkSource, whenPhrase) &&
        draft.body.trim().length > fallback.body.trim().length + 40
      ) {
        return { ...draft, source: "ai", usedTranscript };
      }
    }

    // Last resort with notes: still prefer a non-hard-fail AI body over fluff.
    if (!hardFail(draft.body, checkSource, whenPhrase) && !isHollowFollowupBody(draft.body)) {
      return { ...draft, source: "ai", usedTranscript };
    }
    if (
      !hardFail(draft.body, checkSource, whenPhrase) &&
      draft.body.trim().length > fallback.body.trim().length
    ) {
      return { ...draft, source: "ai", usedTranscript };
    }
    return { ...fallback, source: "fallback", usedTranscript };
  } catch (err) {
    console.error("[meeting-followup-compose]", err);
    return { ...fallback, source: "fallback", usedTranscript };
  }
}
