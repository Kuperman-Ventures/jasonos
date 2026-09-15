"use server";

// Load-only. Do not import the AI research runner from this file — opening
// the Meetings tab calls this action, and a generator-module failure should
// not take down the tab.

import { getContactResearch as loadContactResearch } from "@/lib/outreach/contact-research-store";
import type { ContactResearch } from "@/lib/outreach/contact-research-store";

export type { ContactResearch };

export async function getContactResearch(contactId: string) {
  try {
    return await loadContactResearch(contactId);
  } catch (err) {
    console.error("[getContactResearch]", err);
    return { brief: null, researchedAt: null };
  }
}
