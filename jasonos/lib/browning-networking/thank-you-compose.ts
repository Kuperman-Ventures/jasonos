// Turn a Granola (or pasted) call note into a short Browning thank-you email.
// Facts come only from the note. Nothing here is sent.

import "server-only";

import { generateText } from "ai";
import { hasDirectAnthropicKey, heavyModel } from "@/lib/ai/models";
import { JASON_IDENTITY } from "@/lib/ai/jason-identity";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { stripEmDashes } from "@/lib/email-templates/render";
import {
  isHollowFollowupBody,
  isUnacceptableFollowupBody,
  looksLikeGranolaNoteFragment,
} from "@/lib/outreach/meeting-followups";
import { firstName, thankYouDraft } from "./draft";

export type ThankYouComposeResult = {
  body: string;
  source: "ai" | "fallback";
};

function polishBody(body: string): string {
  return stripEmDashes(body)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractBody(text: string): string | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { body?: unknown };
      if (typeof parsed.body === "string" && parsed.body.trim()) {
        return polishBody(parsed.body);
      }
    } catch {
      // fall through to plain text
    }
  }
  const plain = polishBody(text);
  if (!plain || plain.startsWith("{")) return null;
  // Model sometimes returns the email without JSON wrapping.
  if (/^Hi,|^[A-Z][a-zA-Z'’.-]{1,40},/m.test(plain) && /\nJason\s*$/i.test(plain)) {
    return plain;
  }
  return null;
}

function thankYouFails(body: string, summary: string): boolean {
  if (!body.trim()) return true;
  if (isUnacceptableFollowupBody(body, summary)) return true;
  if (looksLikeGranolaNoteFragment(body)) return true;
  if (isHollowFollowupBody(body)) return true;
  // Browning drafts must not paste third-person note voice.
  if (/\bJason (hadn'?t|had not|will|should|to)\b/i.test(body)) return true;
  if (/\([^)]{0,40}\bJason\b[^)]{0,40}\)/i.test(body)) return true;
  if (/\bConnect on LinkedIn with\b/i.test(body)) return true;
  if (!/\nJason\s*$/i.test(body)) return true;
  return false;
}

/**
 * Write a sendable Browning post-call thank-you from meeting notes.
 * Falls back to the deterministic draft when the model is unavailable or fails checks.
 */
export async function composeThankYouDraft(input: {
  name: string | null;
  summary: string;
}): Promise<ThankYouComposeResult> {
  const summary = input.summary.trim();
  const fallback = {
    body: thankYouDraft({ name: input.name, summary }),
    source: "fallback" as const,
  };
  if (summary.length < 20) return fallback;

  const who = firstName(input.name);
  const greeting = who === "there" ? "Hi," : `${who},`;

  const system = `${JASON_IDENTITY}

${NO_AI_SLOP_WRITING_RULES}

You write a short thank-you email Jason sends after a first Browning networking call.

Hard rules:
- Use ONLY facts in MEETING NOTES. Do not invent intros, firms, roles, cities, or commitments.
- Open with "${greeting}" on its own line.
- 3-5 short sentences across 2-3 short paragraphs.
- Lead with thanks for the call (not "catch up after years" unless the notes say you knew each other).
- Include one concrete takeaway THEY said or shared — their background, a view on the market, something specific from the notes. Prefer what they talked about over Jason's action items.
- Soft close: only mention a next step if the notes clearly say Jason owns it (LinkedIn connect, a named intro). Write it in first person ("I'll connect on LinkedIn", "I'll make the intro to Eddie"). Never paste note syntax like "Connect on LinkedIn with Matt (Jason)".
- Do not write in third person about Jason. Do not paste markdown headings, bullets, or action-item fragments.
- Sign off with "Jason" on its own line. No exclamation points. No em dashes.
- Return JSON only: {"body":"..."}`;

  const user = `Recipient first name: ${who === "there" ? "(unknown)" : who}

MEETING NOTES (rewrite into a warm thank-you email; do not paste):
${summary.slice(0, 6000)}

Write the thank-you email JSON now.`;

  const rewriteHint = `Rewrite. Keep Jason's voice: blunt, concrete, short. Include one takeaway from what they said. Any next step must be first person and grounded in the notes. Do not paste Granola action items or write "Jason hadn't…". Greeting must be "${greeting}". JSON only.`;

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
    let body = extractBody(text);
    if (body && !thankYouFails(body, summary)) {
      return { body, source: "ai" };
    }

    let lastAssistant = text;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { text: retryText } = await generateText({
        model: heavyModel(),
        maxOutputTokens: 500,
        system,
        messages: [
          { role: "user", content: user },
          { role: "assistant", content: lastAssistant },
          { role: "user", content: rewriteHint },
        ],
        providerOptions,
      });
      lastAssistant = retryText;
      body = extractBody(retryText);
      if (body && !thankYouFails(body, summary)) {
        return { body, source: "ai" };
      }
      if (
        body &&
        !isUnacceptableFollowupBody(body, summary) &&
        body.trim().length > fallback.body.trim().length + 40
      ) {
        return { body, source: "ai" };
      }
    }
    return fallback;
  } catch (err) {
    console.error("[browning-thank-you-compose]", err);
    return fallback;
  }
}
