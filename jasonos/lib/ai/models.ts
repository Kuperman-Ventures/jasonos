// Centralized model selection for JasonOS.
//
// Prefer direct Anthropic when ANTHROPIC_API_KEY is set. Vercel AI Gateway
// currently requires a positive credit balance even for BYOK / fallback, which
// blocked Resume Customizer and other features when the team balance hit $0.
// Gateway remains the fallback when no Anthropic key is configured.
//
// On Vercel deploys an OIDC token is auto-injected for Gateway and
// AI_GATEWAY_API_KEY is not needed; for local Gateway use set it in .env.local.

import "server-only";

import { anthropic } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import { generateText, type LanguageModel } from "ai";

const DEFAULT_MODEL = "claude-sonnet-4-6";

function anthropicModelId(fallback = DEFAULT_MODEL): string {
  return (process.env.ANTHROPIC_MODEL?.trim() || fallback).replace(
    /^anthropic\//,
    ""
  );
}

/** True when we can call Anthropic without going through AI Gateway. */
export function hasDirectAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Resolve a Claude model: direct Anthropic SDK provider when keyed, else Gateway.
 * Call at request time (not as a module-level constant) so env is always current.
 */
export function resolveAnthropicModel(fallback = DEFAULT_MODEL): LanguageModel {
  const id = anthropicModelId(fallback);
  if (hasDirectAnthropicKey()) {
    return anthropic(id);
  }
  return gateway(`anthropic/${id}`);
}

/** Heavy reasoning — Resume Customizer, BNA, drafts, etc. */
export function heavyModel(): LanguageModel {
  return resolveAnthropicModel(DEFAULT_MODEL);
}

/** Fast / cheap — Tell Claude command bar, light refinements. */
export function fastModel(): LanguageModel {
  return resolveAnthropicModel(DEFAULT_MODEL);
}

export async function callClaude(input: {
  model: string;
  maxTokens: number;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  try {
    const { text } = await generateText({
      model: resolveAnthropicModel(input.model),
      maxOutputTokens: input.maxTokens,
      system: input.system,
      messages: input.messages,
      providerOptions: hasDirectAnthropicKey()
        ? {
            anthropic: {
              thinking: { type: "disabled" },
            },
          }
        : undefined,
    });
    return text;
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Claude request failed.";
    const message = raw.replace(/\u001b\[[0-9;]*m/g, "").replace(/\s+/g, " ").trim();
    if (
      !hasDirectAnthropicKey() &&
      /credit balance|top-up|insufficient funds/i.test(message)
    ) {
      throw new Error(
        `${message} Set ANTHROPIC_API_KEY on Vercel to call Anthropic directly, or top up AI Gateway credits.`
      );
    }
    throw new Error(message);
  }
}
