"use server";

import { generateText } from "ai";
import { heavyModel, hasDirectAnthropicKey } from "@/lib/ai/models";
import { getEmailTemplate, type TemplateField } from "@/lib/email-templates/templates";
import {
  copiesNoteWording,
  fitTemplateValues,
  restoreBrandCaps,
} from "@/lib/email-templates/render";

function parseText(raw: string): string | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { text?: unknown };
    return typeof parsed.text === "string" ? parsed.text.trim() : null;
  } catch {
    return null;
  }
}

async function recastOne(
  field: TemplateField,
  notes: string
): Promise<string | null> {
  const slot = field.slot ?? "phrase";
  if (slot === "phrase") return null;

  const shape =
    slot === "sentence"
      ? "one standalone email sentence (period at the end)"
      : "a short mid-sentence phrase, no period, no leading capital We";

  const system = `You rewrite Jason Kuperman's form notes into email copy.
Direct, no fluff. Preserve brand caps: Chiat/Day, OUTFRONT, TBWA, Omnicom.
Do not copy five or more words in a row from the notes.
Return STRICT JSON only: {"text":"..."}`;

  const prompt = `Field: ${field.label}
Slot: ${shape}
Notes: ${JSON.stringify(notes)}

Rewrite the notes into ${shape}. Keep the facts. New wording.`;

  const providerOptions = hasDirectAnthropicKey()
    ? { anthropic: { thinking: { type: "disabled" as const } } }
    : undefined;

  const run = async (content: string) => {
    const { text } = await generateText({
      model: heavyModel(),
      maxOutputTokens: 220,
      system,
      messages: [{ role: "user", content }],
      providerOptions,
    });
    return parseText(text);
  };

  try {
    let text = await run(prompt);
    if (text && copiesNoteWording(text, notes)) {
      const retry = await run(
        `${prompt}\n\nYour last answer copied the notes. New wording only.\nPrevious: ${JSON.stringify(text)}`
      );
      if (retry) text = retry;
    }
    if (!text) return null;
    if (copiesNoteWording(text, notes)) return null;
    return restoreBrandCaps(text);
  } catch (err) {
    console.error("[email-templates.recastOne]", err);
    return null;
  }
}

/**
 * Turn template fill-ins into copy that can sit in the email.
 * Name stays as typed. Sentence/clause fields are rewritten when the model
 * is available; otherwise they are fitted locally (clause lowercase, etc.).
 */
export async function recastTemplateValues(input: {
  templateId: string;
  values: Record<string, string>;
}): Promise<{ values: Record<string, string> }> {
  const tmpl = getEmailTemplate(input.templateId);
  if (!tmpl) return { values: input.values };

  const fitted = fitTemplateValues(tmpl, input.values);
  const out = { ...fitted };

  await Promise.all(
    tmpl.fields.map(async (field) => {
      if (field.fromContactFirstName) return;
      if (field.slot !== "sentence" && field.slot !== "clause") return;
      const notes = (input.values[field.key] ?? "").trim();
      if (!notes) return;
      const recast = await recastOne(field, notes);
      if (recast) out[field.key] = recast;
    })
  );

  return { values: out };
}
