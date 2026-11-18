// Turn a Granola / Wispr transcript (preferred) or note into a short
// thank-you / close-the-loop follow-up email. Same drafting shape as Network
// Screen "Draft the Ask" (JASON_CORE_VOICE + short rules + labeled sections +
// one generateText) — different purpose: post-meeting follow-up, not an intro ask.
// Facts come from the approved Follow-up Plan card. Nothing is sent — the
// server action opens Apple Mail via mailto only when Claude returns a real draft.

import "server-only";

import { generateText } from "ai";
import { hasDirectAnthropicKey, heavyModel } from "@/lib/ai/models";
import { JASON_CORE_VOICE } from "@/lib/ai/jason-identity";
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
  draftViolatesApprovedPlan,
  formatPlanForComposePrompt,
  type MeetingFollowupDraftPlan,
} from "@/lib/outreach/meeting-followup-draft-plan";
import {
  firstName,
  guessFollowupDisplayName,
  hasWrongMeetingDayLanguage,
  isUnacceptableFollowupBody,
  meetingWhenPhrase,
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
  /** Approved plan card — required for mailto. Compose writes only from this. */
  plan: MeetingFollowupDraftPlan;
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
  whenPhrase: string,
  plan: MeetingFollowupDraftPlan
): boolean {
  return (
    isUnacceptableFollowupBody(body, summary) ||
    soundsLikePitchFollowup(body) ||
    hasWrongMeetingDayLanguage(body, whenPhrase) ||
    soundsLikeWrongReconnect(body, summary) ||
    hasBannedFollowupPhrases(body) ||
    isHollowFollowupBody(body) ||
    draftViolatesApprovedPlan(body, plan)
  );
}

function wordCount(body: string): number {
  return body
    .replace(/\n*(Best,?\s*)?Jason\s*$/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function looksLikeThankYouFollowup(body: string): boolean {
  // Greeting + sign-off + real paragraphs; ~90–150 words (prompt target).
  const lines = body.replace(/\r\n/g, "\n").trim().split("\n");
  if (lines.length < 4) return false;
  if (!/\bJason\s*$/i.test(body)) return false;
  if (wordCount(body) < 40) return false;
  if (wordCount(body) > 170) return false;
  return true;
}

function confirmFactsFromPlan(plan: MeetingFollowupDraftPlan): string[] {
  const facts = [
    ...plan.jasonOwes.map((fact) => `Confirm you still owe: ${fact}`),
    ...(plan.theirOffer ? [`Confirm their offer: ${plan.theirOffer}`] : []),
    ...(plan.nextStep.kind === "schedule_call"
      ? ["Confirm the follow-up times you are offering"]
      : []),
  ];
  return facts.slice(0, 5);
}

/**
 * Draft a post-meeting thank-you / close-the-loop email via Claude from an
 * approved plan card. Never returns a local template — callers must not open
 * mailto on failure.
 */
export async function composeMeetingFollowupDraft(
  input: MeetingFollowupComposeInput
): Promise<MeetingFollowupComposeResult> {
  const whenPhrase = input.plan.whenPhrase || meetingWhenPhrase(input.startsAt);
  const resolvedName =
    guessFollowupDisplayName({
      name: input.name,
      email: input.email,
      title: input.title,
    }) ?? input.name;
  const notes = input.summary?.trim() || "";
  const transcript = input.transcript?.trim() || "";
  const { material, usedTranscript } = buildMeetingFollowupSourceMaterial({
    summary: notes,
    transcript,
  });
  const checkSource = notes || transcript.slice(0, 4_000) || "";
  const plan = input.plan;
  const confirmFacts = confirmFactsFromPlan(plan);

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
  const guidance = fillMeetingFollowupPrompt(
    await loadMeetingFollowupPromptGuidance(),
    {
      firstName: displayName,
      greeting,
      whenPhrase,
    }
  );

  const system = `${JASON_CORE_VOICE}

${NO_AI_SLOP_WRITING_RULES}

${guidance}

Greet by first name. Close with Best, then Jason on its own line. Hyphens, not em dashes.
Return STRICT JSON only: {"subject":"...","body":"...","confirmFacts":[...]}`;

  const meetingKind = plan.firstMeeting
    ? "FIRST MEETING (do not say reconnect / catch up after years)"
    : "RECONNECT only if the source clearly supports prior relationship";

  const user = `Write the personal relationship follow-up FROM Jason TO ${who === "there" ? "the recipient" : who}.
Write less. Do not narrate their stories back to them. Do not manufacture insight.
Meeting title: ${input.title || "Meeting"}
Meeting kind: ${meetingKind}
WHEN: ${whenPhrase}

${formatPlanForComposePrompt(plan)}

Meeting notes (grounding only — do not invent beyond notes + approved plan):
${notes ? notes.slice(0, 1_500) : "(none)"}

Meeting transcript (preferred source — pick sparingly what belongs in the email):
${transcript ? transcript.slice(0, 10_000) : "(none)"}`;

  const providerOptions = hasDirectAnthropicKey()
    ? { anthropic: { thinking: { type: "disabled" as const } } }
    : undefined;

  const fail = (error: string): MeetingFollowupComposeFailure => ({
    ok: false,
    error,
    usedTranscript,
    confirmFacts,
  });

  try {
    const { text } = await generateText({
      model: heavyModel(),
      maxOutputTokens: 1_000,
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
      if (draftFailsChecks(body, checkSource, whenPhrase, plan)) return null;
      if (!looksLikeThankYouFollowup(body)) return null;
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

    const why = [
      isHollowFollowupBody(draft.body) ||
      hasBannedFollowupPhrases(draft.body) ||
      draftViolatesApprovedPlan(draft.body, plan)
        ? "Last draft broke the approved plan (invented owes, asked them for times, or used banned phrases)."
        : "Last draft failed quality checks.",
      wordCount(draft.body) > 150 ? "Cut to 90-150 words. Write less." : "",
      wordCount(draft.body) < 60
        ? "Add one genuine personal or mutual connection — not commentary on what they said."
        : "",
      !/\bJason\s*$/i.test(draft.body)
        ? "Close with Best, then Jason on its own line."
        : "",
      "No narration ('you mentioned', 'the story you told'). No artificial insight ('stuck with me', 'the gap between', 'mental models'). Ordinary spoken language — should feel like a 3-minute note. Skip owe sentences when owes are none. If times are listed, offer those times — never ask them for windows.",
    ]
      .filter(Boolean)
      .join(" ");

    const { text: retryText } = await generateText({
      model: heavyModel(),
      maxOutputTokens: 1_000,
      system,
      messages: [
        { role: "user", content: user },
        { role: "assistant", content: JSON.stringify(parsed) },
        { role: "user", content: why },
      ],
      providerOptions,
    });
    const retry = safeParseDraft(retryText);
    if (retry) {
      draft = polish({
        subject: retry.subject || draft.subject,
        body: retry.body,
      });
      facts = retry.confirmFacts.length ? retry.confirmFacts : facts;
      const ok = accept(draft.body, draft.subject, facts);
      if (ok) return ok;
    }

    return fail(
      "Couldn't get a usable follow-up from the approved plan. Edit the plan and try again, or write it in Apple Mail."
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
