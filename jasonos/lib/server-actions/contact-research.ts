"use server";

import { runContactResearch as executeContactResearch } from "@/lib/outreach/person-research";

export async function runContactResearch(contactId: string) {
  try {
    return await executeContactResearch(contactId);
  } catch (err) {
    console.error("[runContactResearch]", err);
    const message =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "Couldn't run the web search.";
    return { ok: false as const, error: message };
  }
}
