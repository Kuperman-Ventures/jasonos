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
  // Prefer direct Anthropic when configured; otherwise reuse JasonOS AI Gateway.
  const modelId = getAnthropicModel().replace(/^anthropic\//, "");
  const { text } = await generateText({
    model: gateway(`anthropic/${modelId}`),
    maxOutputTokens: input.maxTokens,
    system: input.system,
    prompt: input.user,
  });
  return text.trim();
}

export async function callClaudeJson<T>(input: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const maxTokens = input.maxTokens ?? 4096;
  const hasDirectKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  try {
    const text = hasDirectKey
      ? await callViaAnthropicSdk({ ...input, maxTokens })
      : await callViaGateway({ ...input, maxTokens });
    return parseJson<T>(text);
  } catch (err) {
    // If direct key path fails for auth reasons and gateway might work, surface clearly.
    if (!hasDirectKey) {
      const message = err instanceof Error ? err.message : "Generation failed.";
      throw new Error(
        `${message} Set ANTHROPIC_API_KEY in .env.local for direct Anthropic access, or ensure AI Gateway is configured.`
      );
    }
    throw err;
  }
}
