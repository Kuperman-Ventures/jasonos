"use server";

// Email Builder — turn the answer set into a first-draft email in Jason's
// voice. Prefers Claude (direct Anthropic when keyed, else Gateway). Falls
// back to a locally synthesized draft that weaves answers into prose.

import { generateText } from "ai";
import { heavyModel, hasDirectAnthropicKey } from "@/lib/ai/models";
import { JASON_CORE_VOICE } from "@/lib/ai/jason-identity";
import { stripEmDashes } from "@/lib/email-templates/render";
import {
  describeAnswers,
  GOAL_OPTIONS,
  LAST_SPOKE_OPTIONS,
  goalGuidanceForPrompt,
  type BuilderAnswers,
} from "@/lib/email-builder/model";
import {
  buildFallbackDraft,
  looksLikePastedNotes,
} from "@/lib/email-builder/fallback";
import { resolveAnswerTags } from "@/lib/server-actions/email-builder-phrases";
import { labelForTag } from "@/lib/email-builder/phrases";

export interface BuilderRecipient {
  name: string;
  firm: string | null;
  title: string | null;
  email: string | null;
}

export interface BuilderDraft {
  subject: string;
  body: string;
}

export type GenerateBuilderResult =
  | { ok: true; draft: BuilderDraft; source: "ai" | "fallback" }
  | { ok: false; error: string; draft: BuilderDraft; source: "fallback" };

function safeParseDraft(text: string): BuilderDraft | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      subject?: unknown;
      body?: unknown;
    };
    const subject = typeof parsed.subject === "string" ? parsed.subject : "";
    const body = typeof parsed.body === "string" ? parsed.body : "";
    if (!body.trim()) return null;
    return { subject: subject.trim(), body: body.trim() };
  } catch {
    return null;
  }
}

export async function generateBuilderEmail(input: {
  recipient: BuilderRecipient;
  answers: BuilderAnswers;
}): Promise<GenerateBuilderResult> {
  const { recipient, answers } = input;
  const fallback = buildFallbackDraft(recipient, answers);
  const answerTags = await resolveAnswerTags(answers);

  const structuredBits: string[] = [];
  if (answerTags.relationship.length) {
    structuredBits.push(
      `Relationship tags: ${answerTags.relationship.map(labelForTag).join(", ")}.`
    );
  }
  if (answerTags.detail.length) {
    structuredBits.push(
      `Topic tags: ${answerTags.detail.map(labelForTag).join(", ")}.`
    );
  }
  if (answerTags.ask.length) {
    structuredBits.push(
      `Ask tags: ${answerTags.ask.map(labelForTag).join(", ")}.`
    );
  }

  const lengthGuide =
    answers.length === "short"
      ? "3-4 sentences, one short paragraph."
      : answers.length === "detailed"
        ? "3 or more short paragraphs."
        : "2 short paragraphs.";

  const recipientLine = [
    recipient.name,
    recipient.title ? recipient.title : null,
    recipient.firm ? `at ${recipient.firm}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const lastSpoke =
    LAST_SPOKE_OPTIONS.find((o) => o.key === answers.lastSpoke)?.label ??
    answers.lastSpoke;

  const goalLabels = answers.goals
    .map((g) => GOAL_OPTIONS.find((o) => o.key === g)?.label ?? g)
    .join(", ");

  const system = `${JASON_CORE_VOICE}

You are drafting a single outbound email FROM Jason. Return STRICT JSON only:
{"subject": "...", "body": "..."}

Rules:
- Sound like Jason wrote it. Use his direct, anti-fluff voice.
- Greet by first name. Sign off "- Jason".
- No "I hope this finds you well", "circling back", "just wanted to", "touching base". No exclamation points. No em dashes.
- Questionnaire answers are CONTEXT ONLY. Rewrite them into natural email prose. NEVER paste the user's notes as their own lines or paragraphs (e.g. do not output a bare line "Outfront" or "They have a new job"). Weave facts into sentences Jason would actually send.
- If the user wrote in third person ("they have a new job"), rewrite in second person / Jason's voice ("saw you landed in a new role").
- HONOR THE SELECTED GOALS STRICTLY. The email's purpose is exactly those goals. Do not default to a warm-reconnect / "it's been too long" email unless "Warm reconnect" is selected.
- Warm reconnect ≠ Catch-up. Catch-up is a current check-in with someone Jason spoke to more recently. Reconnect is for a long gap. Never use reconnect framing for catch-up, follow-up, thanks, congrats, cold, or pitch unless reconnect is also selected.
- Cover the free-text points and concrete ask when provided. Prefer those over generic career bio.
- Only include a Jason reintro / bio when Warm reconnect or Cold first touch needs it (low recall / never met). Skip bio dumps for catch-up, follow-up, thanks, and congrats.
- Calibrate warmth and familiarity to the inputs.
- Length: ${lengthGuide}
- When "Book a meeting" is selected, close with a specific low-friction ask (20-30 minutes, next couple of weeks). If it is NOT selected, do not invent a meeting ask.
- Do not invent facts, shared history, or numbers that aren't given.

Goal-specific instructions:
${goalGuidanceForPrompt(answers.goals)}`;

  const prompt = `Recipient: ${recipientLine || recipient.name}
Last contact: ${lastSpoke}
Selected goals: ${goalLabels || "(none)"}

Context notes (rewrite into prose — do not paste verbatim):
${describeAnswers(answers)}
${
  structuredBits.length
    ? `\nConfirmed structured tags (use as meaning, not as labels in the email):\n${structuredBits.map((b) => `- ${b}`).join("\n")}`
    : ""
}

Write the email now as JSON. Match the selected goals. Natural sentences only.`;

  try {
    const { text } = await generateText({
      model: heavyModel(),
      maxOutputTokens: 900,
      system,
      messages: [{ role: "user", content: prompt }],
      providerOptions: hasDirectAnthropicKey()
        ? {
            anthropic: {
              thinking: { type: "disabled" },
            },
          }
        : undefined,
    });
    const parsed = safeParseDraft(text);
    if (!parsed || looksLikePastedNotes(parsed.body, answers)) {
      return { ok: true, draft: fallback, source: "fallback" };
    }
    return {
      ok: true,
      draft: {
        subject: stripEmDashes(parsed.subject) || fallback.subject,
        body: stripEmDashes(parsed.body),
      },
      source: "ai",
    };
  } catch (err) {
    console.error("[email-builder.generateBuilderEmail]", err);
    return {
      ok: false,
      error:
        "Couldn't reach the drafting model - here's a starter draft you can edit.",
      draft: fallback,
      source: "fallback",
    };
  }
}
