import "server-only";

import { callClaude } from "@/lib/ai/models";
import { bodyForParsing } from "@/lib/post-master/weekly-provocation/match";

export type ParsedProvocation = {
  tldr: string;
  questions: string[];
};

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function extractJsonObject(raw: string): string {
  const text = stripFences(raw);
  try {
    JSON.parse(text);
    return text;
  } catch {
    // Model sometimes wraps the object in a sentence.
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  throw new Error("The reader returned something other than the brief.");
}

function cleanQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const prompt = item.replace(/\s+/g, " ").trim();
    if (prompt.length < 8) continue;
    const key = prompt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(prompt.slice(0, 800));
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Read the email into a short brief and the questions they want answered.
 * Does not answer them.
 */
export async function parseProvocationEmail(input: {
  fromName: string;
  subject: string;
  body: string;
}): Promise<ParsedProvocation> {
  const body = bodyForParsing(input.body).slice(0, 12_000);
  if (!body && !input.subject.trim()) {
    throw new Error("That email had no text to read.");
  }

  const text = await callClaude({
    model: "claude-sonnet-4-6",
    maxTokens: 1400,
    system: `You read a Weekly Provocation email sent to Jason Kuperman. Pull out what it is about and the questions he is being asked to answer.

Rules:
- Use only what is in the email. Do not add questions, facts, or advice.
- tldr is 3 to 5 plain sentences: the topic, why they sent it, and what they want back. No bullet list.
- questions are the actual prompts, lightly cleaned so each one can be read on its own. Keep their order.
- If they ask for a response without numbered questions, return one question that states what they want him to answer.
- If a line is logistics (deadline, word count, how to reply) and not a question, leave it out of questions. Mention a deadline in the tldr when the email gives one.

Return only JSON:
{"tldr":"...","questions":["..."]}`,
    messages: [
      {
        role: "user",
        content: `From: ${input.fromName || "Unknown"}\nSubject: ${input.subject || "(no subject)"}\n\n${body}`,
      },
    ],
  });

  const raw = JSON.parse(extractJsonObject(text)) as {
    tldr?: unknown;
    questions?: unknown;
  };
  const tldr = typeof raw.tldr === "string" ? raw.tldr.replace(/\s+\n/g, "\n").trim() : "";
  const questions = cleanQuestions(raw.questions);
  if (!tldr) throw new Error("Could not summarize that email.");
  if (!questions.length) {
    throw new Error("Could not find a question in that email.");
  }
  return { tldr: tldr.slice(0, 2000), questions };
}
