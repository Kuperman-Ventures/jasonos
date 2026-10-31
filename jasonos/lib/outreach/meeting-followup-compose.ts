// Turn a Granola / Wispr transcript (preferred) or note into a short follow-up
// email Jason can send. Facts come only from that source. Nothing is sent —
// the server action opens Apple Mail via mailto only when Claude returns a
// real draft. There is no local template email path.

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
  meetingWhenPhrase,
  notesLookLikeFirstMeeting,
  pickJasonOwes,
  pickTheirOffer,
  soundsLikePitchFollowup,
  soundsLikeWrongReconnect,
} from "@/lib/outreach/meeting-followups";

export { isUnacceptableFollowupBody, soundsLikePitchFollowup };

export type MeetingFollowupComposeInput = {
  name: string | null;
  title: string;
  summary: string | null;
  transcript?: string | null;
  startsAt?: string | null;
  email?: string | null;
};

export type MeetingFollowupComposeSuccess = {
  ok: true;
  subject: string;
  body: string;
  source: "ai";
  usedTranscript: boolean;
  confirmFacts: string[];
};

export type MeetingFollowupComposeFailure = {
  ok: false;
  error: string;
  usedTranscript: boolean;
  confirmFacts: string[];
};

export type MeetingFollowupComposeResult =
  | MeetingFollowupComposeSuccess
  | MeetingFollowupComposeFailure;

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

function draftFailsChecks(
  body: string,
  summary: string,
  whenPhrase: string
): boolean {
  return (
    isUnacceptableFollowupBody(body, summary) ||
    soundsLikePitchFollowup(body) ||
    hasWrongMeetingDayLanguage(body, whenPhrase) ||
    soundsLikeWrongReconnect(body, summary) ||
    hasBannedFollowupPhrases(body) ||
    isHollowFollowupBody(body)
  );
}

function wordCount(body: string): number {
  return body
    .replace(/\n*Jason\s*$/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function looksLikeOperatorDraft(body: string): boolean {
  // Must have a greeting line + sign-off and more than one short paragraph.
  const lines = body.replace(/\r\n/g, "\n").trim().split("\n");
  if (lines.length < 4) return false;
  if (!/\bJason\s*$/i.test(body)) return false;
  if (wordCount(body) < 40) return false;
  if (wordCount(body) > 140) return false;
  return true;
}

/**
 * Draft a follow-up from the meeting material via Claude.
 * Never returns a local template email — callers must not open mailto on failure.
 */
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
  const owes = pickJasonOwes(checkSource);
  const offer = pickTheirOffer(checkSource);
  const confirmFacts = [
    ...owes.map((fact) => `Confirm you still owe: ${fact}`),
    ...(offer ? [`Confirm their offer: ${offer}`] : []),
  ].slice(0, 5);

  if (!material) {
    return {
      ok: false,
      error:
        "No Granola or Wispr notes for this meeting. Open the note first, then Draft again.",
      usedTranscript: false,
      confirmFacts,
    };
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
    ? "the meeting transcript (primary) plus short notes"
    : "the meeting notes";

  const owesBlock = owes.length
    ? `\nJason's commitments from Next Steps (name these in the email; do not invent others):\n- ${owes.join("\n- ")}\n`
    : "\nNo explicit Next Steps found - only commit to what the source clearly supports.\n";
  const offerBlock = offer
    ? `\nWhat they offered (restate in one plain line):\n- ${offer}\n`
    : "";

  const user = `Recipient first name: ${who === "there" ? "(unknown)" : who}
Meeting title: ${input.title || "Meeting"}
Meeting kind: ${meetingKind}
WHEN: ${whenPhrase}

Write the follow-up from ${sourceLabel}. Follow the system instructions exactly.
${owesBlock}${offerBlock}
${material}

Return JSON only: {"subject":"...","body":"...","confirmFacts":[...]}`;

  const providerOptions = hasDirectAnthropicKey()
    ? { anthropic: { thinking: { type: "disabled" as const } } }
    : undefined;

  const fail = (error: string): MeetingFollowupComposeFailure => ({
    ok: false,
    error,
    usedTranscript,
    confirmFacts,
  });

  const rewriteHint = `Rewrite. Open on one specific thing they said (a real detail, not a pasted note heading). Name what Jason owes and when - use "I'll…" for unfinished Next Steps, never "I reviewed…". Restate what they offered in one clean line. Include a giving line. End with one next step and a time. Max 120 words. No fluff, no bracket placeholders like [link] or [name], no "You said you", no "I'll follow through on what we discussed", no "I'll send the concrete follow-up I owe you". Meeting was ${whenPhrase}. JSON only.`;

  try {
    const { text } = await generateText({
      model: heavyModel(),
      maxOutputTokens: 900,
      system,
      messages: [{ role: "user", content: user }],
      providerOptions,
    });
    const parsed = safeParseDraft(text);
    if (!parsed) {
      return fail("Draft came back unreadable. Try Draft again.");
    }

    let draft = polish({
      subject: parsed.subject || "Quick follow-up",
      body: parsed.body,
    });
    let facts = parsed.confirmFacts.length ? parsed.confirmFacts : confirmFacts;

    const accept = (body: string, subject: string, cf: string[]) => {
      if (draftFailsChecks(body, checkSource, whenPhrase)) return null;
      if (!looksLikeOperatorDraft(body)) return null;
      return {
        ok: true as const,
        subject,
        body,
        source: "ai" as const,
        usedTranscript,
        confirmFacts: cf,
      };
    };

    const first = accept(draft.body, draft.subject, facts);
    if (first) return first;

    let lastParsed = parsed;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const why = [
        isHollowFollowupBody(draft.body) || hasBannedFollowupPhrases(draft.body)
          ? "Last draft was fluff or used banned phrases."
          : "Last draft failed quality checks.",
        wordCount(draft.body) > 120 ? "Cut to 120 words or fewer." : "",
        !/\bJason\s*$/i.test(draft.body) ? 'Sign off with "Jason" on its own line.' : "",
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
          { role: "user", content: `${rewriteHint}\n${why}` },
        ],
        providerOptions,
      });
      const retry = safeParseDraft(retryText);
      if (!retry) continue;
      lastParsed = retry;
      draft = polish({
        subject: retry.subject || draft.subject,
        body: retry.body,
      });
      facts = retry.confirmFacts.length ? retry.confirmFacts : facts;
      const ok = accept(draft.body, draft.subject, facts);
      if (ok) return ok;
    }

    return fail(
      "Couldn't get a usable follow-up from the notes. Try Draft again, or write it in Apple Mail."
    );
  } catch (err) {
    console.error("[meeting-followup-compose]", err);
    const message = err instanceof Error ? err.message : String(err);
    if (/credit balance|top-up|insufficient funds/i.test(message)) {
      return fail("AI credits are empty. Add balance or set ANTHROPIC_API_KEY, then try Draft again.");
    }
    return fail("Draft failed. Try again in a moment.");
  }
}
