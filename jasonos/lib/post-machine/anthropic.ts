import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { gateway } from "@ai-sdk/gateway";
import { generateText } from "ai";

const DEFAULT_MODEL = "claude-sonnet-5";

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseJson<T>(raw: string): T {
  const text = stripFences(raw);
  if (!text) {
    throw new Error("Claude returned an empty response.");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Claude returned non-JSON output: ${text.slice(0, 240)}`);
  }
}

function cleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Generation failed.";
  return raw.replace(/\u001b\[[0-9;]*m/g, "").replace(/\s+/g, " ").trim();
}

async function callViaAnthropicSdk(input: {
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: getAnthropicModel(),
    max_tokens: input.maxTokens,
    // Sonnet 5 adaptive thinking is on by default and steals from max_tokens.
    thinking: { type: "disabled" },
    system: input.system,
    messages: [{ role: "user", content: input.user }],
  });

  return extractText(message.content);
}

async function callViaGateway(input: {
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string> {
  const modelId = getAnthropicModel().replace(/^anthropic\//, "");
  const { text, finishReason } = await generateText({
    model: gateway(`anthropic/${modelId}`),
    maxOutputTokens: input.maxTokens,
    system: input.system,
    prompt: input.user,
    providerOptions: {
      anthropic: {
        thinking: { type: "disabled" },
      },
    },
  });

  const out = text.trim();
  if (!out) {
    throw new Error("Claude returned an empty response.");
  }
  if (finishReason === "length") {
    throw new Error(
      "Claude hit the output length limit before finishing. Try again, or shorten the LinkedIn length target."
    );
  }
  return out;
}

async function callClaudeRaw(input: {
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string> {
  const hasDirectKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  try {
    return hasDirectKey
      ? await callViaAnthropicSdk(input)
      : await callViaGateway(input);
  } catch (err) {
    const message = cleanErrorMessage(err);
    if (!hasDirectKey) {
      throw new Error(
        `${message} Set ANTHROPIC_API_KEY in .env.local for direct Anthropic access, or ensure AI Gateway is configured.`
      );
    }
    throw new Error(message);
  }
}

/** Structured JSON responses (hooks). Keep payloads small. */
export async function callClaudeJson<T>(input: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const text = await callClaudeRaw({
    system: input.system,
    user: input.user,
    maxTokens: input.maxTokens ?? 2048,
  });
  return parseJson<T>(text);
}

/** Plain-text responses (LinkedIn / blog drafts). */
export async function callClaudeText(input: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  return callClaudeRaw({
    system: input.system,
    user: input.user,
    maxTokens: input.maxTokens ?? 4096,
  });
}
