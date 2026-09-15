"use server";

import { runContactResearch as executeContactResearch } from "@/lib/outreach/person-research";

export async function runContactResearch(contactId: string) {
  return executeContactResearch(contactId);
}
