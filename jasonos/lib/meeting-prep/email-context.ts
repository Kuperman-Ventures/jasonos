import "server-only";

import { callClaude } from "@/lib/ai/models";
import { isGmailConnected, searchThreadsByParticipants as searchGmailThreadsByParticipants } from "@/lib/integrations/gmail";
import { searchThreadsByParticipants as searchOutlookThreadsByParticipants } from "@/lib/integrations/outlook-mail";
import { getOutlookConnectionStatus } from "@/lib/integrations/outlook-tokens";
import {
  buildEmailContextPacket,
  collectParticipantTargets,
  emailContextIsStale,
} from "@/lib/meeting-prep/email-context-text";
import type { ParticipantMailThread } from "@/lib/meeting-prep/email-threads";
import { createServiceRoleClient } from "@/lib/supabase/server";

const EMPTY = "No email with these attendees in the last 180 days.";

function sinceIso(now = new Date()): string {
  return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
}

async function loadThreads(attendees: Array<{ email: string }>): Promise<ParticipantMailThread[]> {
  const targets = collectParticipantTargets(attendees);
  if (!targets.addresses.length && !targets.domains.length) return [];
  const since = sinceIso();
  const [gmail, outlook] = await Promise.all([
    searchGmailThreadsByParticipants({ ...targets, since }).catch((err) => {
      console.error("[email-context] gmail", err);
      return [] as ParticipantMailThread[];
    }),
    searchOutlookThreadsByParticipants({ ...targets, since }).catch((err) => {
      console.error("[email-context] outlook", err);
      return [] as ParticipantMailThread[];
    }),
  ]);
  const seen = new Set<string>();
  const threads: ParticipantMailThread[] = [];
  for (const thread of [...gmail, ...outlook]) {
    const key = `${thread.subject ?? ""}:${thread.messages[0]?.date ?? thread.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    threads.push(thread);
  }
  return threads;
}

async function summarize(packet: string): Promise<string> {
  const text = await callClaude({
    model: "claude-sonnet-4-6",
    maxTokens: 500,
    system:
      "Summarize how this meeting came about from the email threads. Four to eight lines. Say who initiated, what was promised or asked, who else is involved (for example an assistant), and any dates. Name only people who appear in the threads. Do not invent a person, a company, or a promise.",
    messages: [{ role: "user", content: packet }],
  });
  return text.replace(/\r\n/g, "\n").trim();
}

export async function buildEmailContext(prep: {
  id: string;
  attendees: Array<{ email: string; name?: string | null }>;
}): Promise<string | null> {
  const threads = await loadThreads(prep.attendees);
  const packet = buildEmailContextPacket(threads);
  let summary = EMPTY;
  if (packet) {
    summary = await summarize(packet);
    if (!summary) summary = EMPTY;
  } else {
    const [gmailOn, outlook] = await Promise.all([isGmailConnected(), getOutlookConnectionStatus()]);
    if (!gmailOn && !outlook.connected) return null;
  }
  const now = new Date().toISOString();
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("meeting_preps")
    .update({ email_context: summary, email_context_at: now, updated_at: now })
    .eq("id", prep.id);
  if (error) throw new Error(error.message);
  return summary;
}

export async function ensureEmailContext(prep: {
  id: string;
  attendees: Array<{ email: string; name?: string | null }>;
  emailContext: string | null;
  emailContextAt: string | null;
}): Promise<string | null> {
  if (!emailContextIsStale(prep.emailContextAt) && prep.emailContext?.trim()) {
    return prep.emailContext;
  }
  return buildEmailContext(prep);
}
