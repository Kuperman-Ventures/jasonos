"use server";

// Client-callable wrappers. Implementation lives in person-research.ts so
// other server modules can call it without a server-action import.

import {
  getContactResearch as loadContactResearch,
  runContactResearch as executeContactResearch,
  type ContactResearch,
} from "@/lib/outreach/person-research";

export type { ContactResearch };

export async function getContactResearch(contactId: string) {
  return loadContactResearch(contactId);
}

export async function runContactResearch(contactId: string) {
  return executeContactResearch(contactId);
}
