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
  hasBannedFollowupPhrases,
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
  pickMeetingFollowupFacts,
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
  /** Facts Jason should verify before sending. */
  confirmFacts: string[];
};

export {
  buildMeetingFollowupSourceMaterial,
  MEETING_FOLLOWUP_SOURCE_MAX_CHARS,
} from "@/lib/outreach/meeting-followup-prompt";

function safeParseDraft(text: string): {
  subject: string;
  body: string;
  confirmFacts: string[];
} | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      subject?: unknown;
      body?: unknown;
      confirmFacts?: unknown;
    };
    const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
    const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!body) return null;
    const confirmFacts = Array.isArray(parsed.confirmFacts)
      ? parsed.confirmFacts
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];
    return { subject, body, confirmFacts };
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
    soundsLikeWrongReconnect(body, summary) ||
    hasBannedFollowupPhrases(body)
  );
}

function draftFailsChecks(
  body: string,
  summary: string,
  whenPhrase: string
): boolean {
  return hardFail(body, summary, whenPhrase) || isHollowFollowupBody(body);
}

function wordCount(body: string): number {
  return body
    .replace(/\n*Jason\s*$/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
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
  const checkSource =
    input.summary?.trim() ||
    input.transcript?.trim()?.slice(0, 4_000) ||
    "";
  const fallbackBase = polish(
    meetingFollowupDraft({
      name: resolvedName,
      title: input.title,
      summary: checkSource || input.summary,
      startsAt: input.startsAt,
    })
  );
  const fallback: MeetingFollowupComposeResult = {
    ...fallbackBase,
    source: "fallback",
    usedTranscript: false,
    confirmFacts: pickMeetingFollowupFacts(checkSource, 3).map(
      (fact) => `Confirm before sending: ${fact}`
    ),
  };
  if (!material) {
    return fallback;
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
  const system = `${JASON_IDENTITY}

${NO_AI_SLOP_WRITING_RULES}

${guidance}`;

  const meetingKind = firstMeet
    ? "FIRST MEETING (do not say reconnect / catch up after years)"
    : "RECONNECT only if the source clearly supports prior relationship";
  const sourceLabel = usedTranscript
    ? "the meeting transcript (what people said)"
    : "the meeting notes";
  const mustUseFacts = pickMeetingFollowupFacts(checkSource, 4);
  const factsBlock = mustUseFacts.length
    ? `\nCandidate facts from the source (paraphrase; do not invent):\n- ${mustUseFacts.join("\n- ")}\n`
    : "";

  const user = `Recipient first name: ${who === "there" ? "(unknown)" : who}
Meeting title: ${input.title || "Meeting"}
Meeting kind: ${meetingKind}
WHEN: ${whenPhrase}

Source: ${sourceLabel}. Follow the system instructions exactly.
${factsBlock}
${material}

Return the JSON now (subject, body, confirmFacts).`;

  const providerOptions = hasDirectAnthropicKey()
    ? { anthropic: { thinking: { type: "disabled" as const } } }
    : undefined;

  const rewriteHint = `Rewrite against the system rules. Open on a specific thing they said. Include what Jason owes, what they offered, a giving line, and one next step with a time. Max 120 words. No banned fluff. Meeting was ${whenPhrase}. ${factsBlock}JSON only.`;

  try {
    const { text } = await generateText({
      model: heavyModel(),
      maxOutputTokens: 900,
      system,
      messages: [{ role: "user", content: user }],
      providerOptions,
    });
    const parsed = safeParseDraft(text);
    if (!parsed) return { ...fallback, usedTranscript };
    let draft = polish({
      subject: parsed.subject || fallback.subject,
      body: parsed.body,
    });
    let confirmFacts = parsed.confirmFacts;
    if (
      !draftFailsChecks(draft.body, checkSource, whenPhrase) &&
      wordCount(draft.body) <= 140
    ) {
      return { ...draft, source: "ai", usedTranscript, confirmFacts };
    }

    let lastParsed = parsed;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const nudge = [
        isHollowFollowupBody(draft.body) || hasBannedFollowupPhrases(draft.body)
          ? "Last draft was fluff or used banned phrases. Open on a specific thing they said."
          : "",
        wordCount(draft.body) > 120 ? "Cut to 120 words or fewer." : "",
      ]
        .filter(Boolean)
        .join(" ");
      const { text: retryText } = await generateText({
        model: heavyModel(),
        maxOutputTokens: 900,
        system,
        messages: [
          { role: "user", content: user },
          { role: "assistant", content: JSON.stringify(lastParsed) },
          { role: "user", content: `${rewriteHint}\n${nudge}` },
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
      confirmFacts = retry.confirmFacts;
      if (
        !draftFailsChecks(draft.body, checkSource, whenPhrase) &&
        wordCount(draft.body) <= 140
      ) {
        return { ...draft, source: "ai", usedTranscript, confirmFacts };
      }
    }

    if (
      !hardFail(draft.body, checkSource, whenPhrase) &&
      !isHollowFollowupBody(draft.body) &&
      wordCount(draft.body) <= 160
    ) {
      return { ...draft, source: "ai", usedTranscript, confirmFacts };
    }
    return { ...fallback, usedTranscript };
  } catch (err) {
    console.error("[meeting-followup-compose]", err);
    return { ...fallback, usedTranscript };
  }
}
