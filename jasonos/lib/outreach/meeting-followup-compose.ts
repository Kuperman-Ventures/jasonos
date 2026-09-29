// Turn a Granola meeting note into a short follow-up email Jason can send.
// Facts come only from the note. Nothing here is sent — the server action
// opens Apple Mail via mailto.

import "server-only";

import { generateText } from "ai";
import { hasDirectAnthropicKey, heavyModel } from "@/lib/ai/models";
import { JASON_CORE_VOICE } from "@/lib/ai/jason-identity";
import { stripEmDashes } from "@/lib/email-templates/render";
import {
  firstName,
  isUnacceptableFollowupBody,
  meetingFollowupDraft,
} from "@/lib/outreach/meeting-followups";

export { isUnacceptableFollowupBody };

export type MeetingFollowupComposeInput = {
  name: string | null;
  title: string;
  summary: string | null;
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
  const fallback = polish(
    meetingFollowupDraft({
      name: input.name,
      title: input.title,
      summary: input.summary,
    })
  );
  const summary = input.summary?.trim() || "";
  if (!summary) {
    return { ...fallback, source: "fallback" };
  }

  const who = firstName(input.name);
  const greeting = who === "there" ? "Hi," : `${who},`;
  const system = `${JASON_CORE_VOICE}

You write a short post-meeting follow-up email for Jason to send in Apple Mail.

Hard rules:
- Use ONLY facts present in MEETING NOTES. Do not invent intros, firms, roles, asks, or commitments.
- Rewrite notes into natural first-person email prose. Never paste action-item fragments, parenthetical name tags, or third-person note lines (bad: "Shawn to reciprocate with relevant introductions (Shawn)").
- Open with "${greeting}" on its own line.
- 2-4 short sentences. Thank them, reference one concrete thing from the notes, close with a clear next step when the notes support one.
- Sign off with "Jason" on its own line. No exclamation points. No em dashes.
- Return JSON only: {"subject":"...","body":"..."}`;

  const user = `Recipient first name: ${who === "there" ? "(unknown)" : who}
Meeting title: ${input.title || "Meeting"}

MEETING NOTES (Granola — rewrite, do not paste):
${summary.slice(0, 6000)}

Write the follow-up email JSON now.`;

  const providerOptions = hasDirectAnthropicKey()
    ? { anthropic: { thinking: { type: "disabled" as const } } }
    : undefined;

  try {
    const { text } = await generateText({
      model: heavyModel(),
      maxOutputTokens: 500,
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
    if (isUnacceptableFollowupBody(draft.body, summary)) {
      // One retry with an explicit ban on the bad shape.
      const { text: retryText } = await generateText({
        model: heavyModel(),
        maxOutputTokens: 500,
        system,
        messages: [
          { role: "user", content: user },
          {
            role: "assistant",
            content: JSON.stringify(parsed),
          },
          {
            role: "user",
            content:
              "Rewrite. The previous body still sounded like pasted meeting notes (action items, parenthetical names, or third-person fragments). Write a real email Jason would send. JSON only.",
          },
        ],
        providerOptions,
      });
      const retry = safeParseDraft(retryText);
      if (!retry || isUnacceptableFollowupBody(retry.body, summary)) {
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
