"use server";

// Email Builder — turn the answer set into a first-draft email in Jason's
// voice. Prefers Claude via the AI gateway; falls back to a locally assembled
// draft so the feature still works when the gateway isn't configured.

import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { JASON_CORE_VOICE } from "@/lib/ai/jason-identity";
import {
  firstNameFromFullName,
  stripEmDashes,
} from "@/lib/email-templates/render";
import {
  describeAnswers,
  GOAL_OPTIONS,
  LAST_SPOKE_OPTIONS,
  type BuilderAnswers,
} from "@/lib/email-builder/model";

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

function hasGoal(answers: BuilderAnswers, key: string): boolean {
  return answers.goals.includes(key);
}

function goalLabels(answers: BuilderAnswers): string[] {
  return answers.goals.map(
    (g) => GOAL_OPTIONS.find((o) => o.key === g)?.label ?? g
  );
}

function fallbackSubject(recipient: BuilderRecipient, a: BuilderAnswers): string {
  if (a.lastSpoke === "never") return "A quick note";
  if (a.closeness <= 2 || a.remember <= 2) return "A voice from the past";
  if (hasGoal(a, "sprint")) return "A GTM idea for " + (recipient.firm || "your team");
  return "Long overdue";
}

function fallbackBody(recipient: BuilderRecipient, a: BuilderAnswers): string {
  const first = firstNameFromFullName(recipient.name) || "there";

  const opener =
    a.lastSpoke === "never"
      ? "We haven't met - I'll keep this short."
      : a.remember <= 2
        ? "This is a name from a while back. Hope it's a welcome one."
        : "It's been too long. You've been on my mind lately.";

  const context = a.relationship.trim()
    ? a.relationship.trim()
    : "We crossed paths earlier in my career and I lost track of too many people I liked working with.";

  const bio =
    "Quick version: I spent eight years at OUTFRONT running marketing and product experience through their digital transformation, left last fall, and now do fractional CMO work while figuring out what's next.";

  const detail = a.detail.trim()
    ? a.detail.trim()
    : "";

  const goals = goalLabels(a);
  const ask = a.ask.trim()
    ? a.ask.trim()
    : hasGoal(a, "meeting") || hasGoal(a, "catchup")
      ? "If you've got 30 minutes in the next few weeks, I'd take it. Coffee, phone, whatever's easy."
      : hasGoal(a, "advice")
        ? "I'd value your read on a couple of things. Open to a short call?"
        : hasGoal(a, "intro")
          ? "If anyone in your orbit comes to mind, an intro would mean a lot."
          : hasGoal(a, "job")
            ? "I'm exploring CMO/CGO seats at growth-stage B2B. If you hear of anything, keep me in mind."
            : "No agenda beyond catching up. Would genuinely enjoy hearing what you're up to.";

  const parts = [
    `Hi ${first},`,
    "",
    opener,
    "",
    a.closeness <= 3 ? context : "",
    a.length === "short" ? "" : bio,
    detail,
    "",
    ask,
    "",
    "- Jason",
  ].filter((line, i, arr) => !(line === "" && arr[i - 1] === ""));

  void goals;
  return stripEmDashes(parts.join("\n").replace(/\n{3,}/g, "\n\n").trim());
}

function buildFallback(
  recipient: BuilderRecipient,
  answers: BuilderAnswers
): BuilderDraft {
  return {
    subject: stripEmDashes(fallbackSubject(recipient, answers)),
    body: fallbackBody(recipient, answers),
  };
}

function safeParseDraft(text: string): BuilderDraft | null {
  // Model is asked for strict JSON; tolerate code fences / stray prose.
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
  const fallback = buildFallback(recipient, answers);

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

  const system = `${JASON_CORE_VOICE}

You are drafting a single outbound email FROM Jason. Return STRICT JSON only:
{"subject": "...", "body": "..."}

Rules:
- Sound like Jason wrote it. Use his direct, anti-fluff voice.
- Greet by first name. Sign off "- Jason".
- No "I hope this finds you well", "circling back", "just wanted to", "touching base". No exclamation points. No em dashes.
- Calibrate warmth, familiarity, and how much reintroduction is needed to the inputs.
- Length: ${lengthGuide}
- If closeness/recall is low, briefly re-establish who Jason is; if high, skip that.
- End with the concrete ask when one is provided; otherwise keep it low-pressure.
- Do not invent facts, shared history, or numbers that aren't given.`;

  const prompt = `Recipient: ${recipientLine || recipient.name}
Last contact: ${lastSpoke}

Inputs for the draft:
${describeAnswers(answers)}

Write the email now as JSON.`;

  try {
    const { text } = await generateText({
      model: gateway("anthropic/claude-sonnet-4-6"),
      maxOutputTokens: 900,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const parsed = safeParseDraft(text);
    if (!parsed) {
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
