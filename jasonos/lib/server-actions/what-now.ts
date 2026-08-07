"use server";

import { unstable_cache } from "next/cache";
import { generateText } from "ai";
import { heavyModel } from "@/lib/ai/models";
import { JASON_IDENTITY, JASON_OPERATIONAL_HINTS } from "@/lib/ai/jason-identity";
import { enrichContext } from "@/lib/ai/context-enrichment";
import { getPinnedTodayCards } from "./pin";

export interface WhatNowAdvice {
  rationale: string;
  actions: WhatNowAction[];
  generated_at: string;
  data_snapshot: {
    triaged_count: number;
    high_priority_untriaged: number;
    pinned_today_count: number;
  };
}

export interface WhatNowAction {
  label: string;
  href: string;
  rank: number;
  estimated_minutes?: number;
}

/**
 * Get the current "What Now" recommendation. Cached for 30 min via
 * unstable_cache; pass forceRefresh=true to bypass cache after a state
 * change (e.g., user just triaged 5 contacts).
 */
export async function getWhatNowAdvice(forceRefresh = false): Promise<WhatNowAdvice> {
  if (forceRefresh) {
    return await computeWhatNow();
  }
  return cachedWhatNow();
}

const cachedWhatNow = unstable_cache(
  async () => computeWhatNow(),
  ["what-now-advice"],
  { revalidate: 1800 }
);

async function computeWhatNow(): Promise<WhatNowAdvice> {
  // Pull pipeline state + pins independently so a single failure (e.g. unauth,
  // missing migration, Supabase blip) doesn't cascade into a page-level 500.
  const [enrichedRes, pinnedRes] = await Promise.allSettled([
    enrichContext("What should Jason focus on right now?", { scope: "global" }),
    getPinnedTodayCards(),
  ]);

  const enriched =
    enrichedRes.status === "fulfilled" ? enrichedRes.value : null;
  const pinned = pinnedRes.status === "fulfilled" ? pinnedRes.value : [];

  if (!enriched) {
    return makeFallbackAdvice({
      reason:
        enrichedRes.status === "rejected" && enrichedRes.reason instanceof Error
          ? enrichedRes.reason.message
          : "context_unavailable",
      pinned_today_count: pinned.length,
    });
  }

  const systemPrompt = buildWhatNowSystemPrompt();
  const userPrompt = buildWhatNowUserPrompt(enriched, pinned);

  // The AI Gateway can refuse a model (e.g. 403 RestrictedModelsError when the
  // team isn't on paid credits for Opus) or be misconfigured. Either case
  // should degrade to a usable dashboard, not crash the RSC.
  let text: string;
  try {
    const result = await generateText({
      model: heavyModel(),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 800,
    });
    text = result.text;
  } catch (error) {
    console.error("[what-now] AI Gateway call failed; serving fallback", error);
    return makeFallbackAdvice({
      reason: error instanceof Error ? error.message : "ai_unavailable",
      triaged_count: enriched.global_state.triaged_count,
      high_priority_untriaged: enriched.global_state.high_priority_untriaged ?? 0,
      pinned_today_count: pinned.length,
    });
  }

  const parsed = parseWhatNowResponse(text);

  return {
    rationale: parsed.rationale,
    actions: parsed.actions,
    generated_at: new Date().toISOString(),
    data_snapshot: {
      triaged_count: enriched.global_state.triaged_count,
      high_priority_untriaged: enriched.global_state.high_priority_untriaged ?? 0,
      pinned_today_count: pinned.length,
    },
  };
}

// Static fallback so the dashboard always renders. Surfaces a short rationale
// and a couple of safe deep-links Jason can act on without waiting on AI.
function makeFallbackAdvice(args: {
  reason: string;
  triaged_count?: number;
  high_priority_untriaged?: number;
  pinned_today_count: number;
}): WhatNowAdvice {
  const isRestricted =
    /restrictedmodels|free tier|no_providers_available|gatewayinternal/i.test(
      args.reason
    );
  const rationale = isRestricted
    ? "What Now is paused — the AI Gateway is refusing the configured model (likely a billing / model-access issue on this Vercel team). Jump straight into the queue while that's sorted."
    : "What Now is temporarily unavailable. Jump straight into the queue and triage what's loudest — a fresh recommendation will return on the next refresh.";

  return {
    rationale,
    actions: [
      { rank: 1, label: "Open triage queue", href: "/runner/triage" },
      { rank: 2, label: "Outreach queue", href: "/outreach/queue" },
      { rank: 3, label: "Today's pins", href: "/today" },
    ],
    generated_at: new Date().toISOString(),
    data_snapshot: {
      triaged_count: args.triaged_count ?? 0,
      high_priority_untriaged: args.high_priority_untriaged ?? 0,
      pinned_today_count: args.pinned_today_count,
    },
  };
}

function buildWhatNowSystemPrompt(): string {
  return `You are Claude, Jason's chief of staff. Given a snapshot of his current pipeline state and what he's pinned for today, identify the SINGLE highest-leverage thing for him to do right now and explain why in 2-3 sentences.

${JASON_IDENTITY}

${JASON_OPERATIONAL_HINTS}

OUTPUT FORMAT — strict JSON:
{
  "rationale": "1-2 short paragraphs explaining the highest-leverage move and why. Direct, anti-fluff voice. No 'I think' or 'you might want to'. State it.",
  "actions": [
    { "rank": 1, "label": "Triage 13 priority contacts (~30 min)", "href": "/runner/triage", "estimated_minutes": 30 },
    { "rank": 2, "label": "Optional alternative action", "href": "/some-route" }
  ]
}

PRIORITIZATION RULES:
1. If pinned items exist, defer to them — Jason told us they matter today. Recommend execution paths for those.
2. If high-priority untriaged contacts (strat >= 80, no intent) > 5, that's almost always #1 — triage unlocks downstream decisions.
3. If sent_count < 5 this week and triaged_count > 0, recommend sending to triaged contacts.
4. If replied_count > 0, recommend handling replies before new outreach.
5. If a critical alert exists, that beats everything else.
6. Time-of-day awareness: it's morning right now. Favor activities that benefit from fresh focus over reactive work.

Generate at most 3 actions. Rank by what should happen next.`;
}

function buildWhatNowUserPrompt(enriched: Awaited<ReturnType<typeof enrichContext>>, pinned: Awaited<ReturnType<typeof getPinnedTodayCards>>): string {
  const lines: string[] = [];
  lines.push(`Current date: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`Hour of day: ${new Date().getHours()} (24h, local)`);
  lines.push("");

  lines.push("PIPELINE STATE:");
  lines.push(`- Total recruiters in pipeline: ${enriched.global_state.total_recruiters}`);
  lines.push(`- Triaged (intent set): ${enriched.global_state.triaged_count}`);
  lines.push(`- High-priority untriaged (strat >= 80, no intent): ${enriched.global_state.high_priority_untriaged ?? 0}`);
  lines.push(`- Sent this week: ${enriched.global_state.sent_count}`);
  lines.push(`- Replied this week: ${enriched.global_state.replied_count}`);
  lines.push(`- Open critical alerts: ${enriched.global_state.open_alerts}`);
  if (Object.keys(enriched.global_state.active_intents_breakdown).length > 0) {
    lines.push(`- Triaged intent breakdown: ${JSON.stringify(enriched.global_state.active_intents_breakdown)}`);
  }
  lines.push("");

  lines.push(`PINNED FOR TODAY: ${pinned.length} cards`);
  if (pinned.length > 0) {
    for (const card of pinned.slice(0, 5)) {
      lines.push(`- "${card.title}" (${card.module}/${card.object_type}, track=${card.track})`);
    }
  } else {
    lines.push("(nothing pinned — Jason hasn't told us his agenda for today)");
  }
  lines.push("");

  lines.push("AVAILABLE ROUTES (use these as href values):");
  lines.push("- /runner/triage — triage queue");
  lines.push("- /outreach/queue — outreach queue (relationships, search, advisors, prospects, personal)");
  lines.push("- /outreach/queue?intent=triaged_ready — only triaged-ready contacts");
  lines.push("- /outreach/queue?intent=door — only door-opener contacts");
  lines.push("- /outreach/people — full people directory (classify, set cadence, draft)");
  lines.push("- /outreach/schedule — time-grouped cadence view");
  lines.push("- /todos — initiative dashboard");
  lines.push("- /contacts — Tier 1 ranker (bulk-rank-and-promote)");
  lines.push("");

  lines.push("Output the JSON only, no preamble.");
  return lines.join("\n");
}

function parseWhatNowResponse(text: string): { rationale: string; actions: WhatNowAction[] } {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleaned);
    return {
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : "Unable to parse advice.",
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch {
    return { rationale: text, actions: [] };
  }
}
