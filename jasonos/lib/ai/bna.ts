// Best-Next-Action engine (spec §5)
// Wired to the heavy model with a structured-output schema.

import { generateObject } from "ai";
import { z } from "zod";
import { heavyModel } from "./models";
import type { ActionCard, BestNextActionItem } from "../types";

const BnaItemSchema = z.object({
  card_id: z.string(),
  // Anthropic structured output rejects min/max on integers — clamp in runBna.
  rank: z.number().int(),
  why_now: z.string(),
  suggested_time_block: z.string().optional(),
});

export const BnaResponseSchema = z.object({
  items: z.array(BnaItemSchema),
});

const SYSTEM = `You are Jason's chief of staff. You see every open card across four
tracks (Kuperman Ventures, Kuperman Advisors, Job Search, Personal). Produce
3–7 ranked Must-Dos for today. Consider:
- Track balance (don't starve a track)
- Time-sensitivity (deadlines, replies waiting, stale stages)
- VIP-linked items
- Jason's calendar for today
- Recent dispositions (what he's been avoiding, what he's been shipping)
Output: ranked array of {card_id, rank, why_now, suggested_time_block?}`;

export interface BnaInputs {
  open_cards: ActionCard[];
  todays_calendar?: { title: string; start: string; end: string }[];
  recent_dispositions?: { card_id: string; action: string; reason_code?: string }[];
  vip_contact_ids?: string[];
}

export async function runBna(inputs: BnaInputs): Promise<BestNextActionItem[]> {
  const { object } = await generateObject({
    model: heavyModel(),
    schema: BnaResponseSchema,
    system: SYSTEM,
    prompt: JSON.stringify(inputs, null, 2),
  });
  return object.items
    .map((item, i) => ({
      ...item,
      rank: Number.isFinite(item.rank)
        ? Math.min(7, Math.max(1, Math.round(item.rank)))
        : i + 1,
      why_now: item.why_now.trim().slice(0, 280),
    }))
    .filter((item) => item.why_now.length >= 8)
    .slice(0, 7);
}
