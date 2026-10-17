/** Compose one email per recipient and persist the nudge record. */

import { randomUUID } from "node:crypto";
import { resendConfigured, sendNudgeEmail } from "@/lib/nudge-mail";
import { generateNudgeBlurb } from "@/lib/nudge-ai";
import { appendNudge, markNudgeSent, patchNudge, saveNudgeBlurb } from "@/lib/nudge-store";
import {
  catalogWithBlurbs,
  composeRecipientEmails,
  scheduleFromChoice,
  stillCurrentIds,
  type NudgeCatalog,
  type NudgeRecord,
  type NudgeScheduleChoice,
} from "@/lib/nudge";

export type NudgeSendInput = {
  createdBy: string;
  recipients: string[];
  stageIds: string[];
  todoIds: string[];
  note: string;
  choice: NudgeScheduleChoice;
  catalog: NudgeCatalog;
  now?: Date;
};

export type NudgeSendResult = {
  ok: boolean;
  status: "sent" | "scheduled";
  nudgeId: string;
  sent: number;
  skipped: { id: string; reason: string }[];
  error?: string;
};

async function blurbFor(
  id: string,
  title: string,
  context: string,
  stored: string,
  cache: Map<string, string>,
): Promise<string> {
  const hit = cache.get(id) || stored.trim();
  if (hit) return hit;
  const generated = await generateNudgeBlurb(title, context);
  cache.set(id, generated);
  await saveNudgeBlurb(id, generated);
  return generated;
}

export async function fillBlurbs(input: NudgeSendInput): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  const stageIds = new Set(input.stageIds);
  const todoIds = new Set(input.todoIds);
  for (const stage of input.catalog.stages) {
    if (!stageIds.has(stage.id)) continue;
    cache.set(stage.id, await blurbFor(stage.id, stage.title, stage.sub, stage.blurb, cache));
  }
  for (const todo of input.catalog.todos) {
    if (!todoIds.has(todo.id) || !input.recipients.includes(todo.ownerId)) continue;
    cache.set(todo.id, await blurbFor(todo.id, todo.title, todo.dueLabel, todo.blurb, cache));
  }
  return cache;
}

export function buildNudgeRecord(input: NudgeSendInput, now = new Date()): NudgeRecord {
  const choice = input.choice;
  return {
    id: randomUUID(),
    createdBy: input.createdBy,
    recipients: input.recipients,
    stageIds: input.stageIds,
    todoIds: input.todoIds,
    note: input.note.trim(),
    schedule: scheduleFromChoice(choice, now),
    status: choice === "now" ? "sent" : "scheduled",
    createdAt: now.toISOString(),
    sentAt: choice === "now" ? now.toISOString() : null,
    lastError: null,
  };
}

export async function executeNudgeSend(input: NudgeSendInput): Promise<NudgeSendResult> {
  const now = input.now ?? new Date();
  const blurbs = await fillBlurbs(input);
  const { emails, skipped } = composeRecipientEmails({ ...input, catalog: catalogWithBlurbs(input.catalog, blurbs) });
  const record = buildNudgeRecord(input, now);

  if (!emails.length) {
    return {
      ok: false,
      status: input.choice === "now" ? "sent" : "scheduled",
      nudgeId: record.id,
      sent: 0,
      skipped,
      error: skipped[0]?.reason || "Select recipients and at least one item",
    };
  }

  if (input.choice !== "now") {
    await appendNudge(record);
    return { ok: true, status: "scheduled", nudgeId: record.id, sent: 0, skipped };
  }

  if (!resendConfigured()) {
    return {
      ok: false,
      status: "sent",
      nudgeId: record.id,
      sent: 0,
      skipped,
      error: "Email is not configured. Add RESEND_API_KEY to send nudges.",
    };
  }

  const failures: string[] = [];
  let sent = 0;
  for (const row of emails) {
    const result = await sendNudgeEmail(row.email);
    if (result.ok) sent += 1;
    else failures.push(`${row.email.toName}: ${result.error}`);
  }
  if (sent === 0) {
    return {
      ok: false,
      status: "sent",
      nudgeId: record.id,
      sent: 0,
      skipped,
      error: failures[0] || "Could not send",
    };
  }
  record.lastError = failures.length ? failures.join("; ") : null;
  record.sentAt = now.toISOString();
  await appendNudge(record);
  return {
    ok: failures.length === 0,
    status: "sent",
    nudgeId: record.id,
    sent,
    skipped,
    error: failures.length ? failures.join("; ") : undefined,
  };
}

/** Re-evaluate a stored scheduled nudge against a fresh catalog and send it. */
export async function dispatchStoredNudge(record: NudgeRecord, catalog: NudgeCatalog, now = new Date()): Promise<NudgeSendResult> {
  const input: NudgeSendInput = {
    createdBy: record.createdBy,
    recipients: record.recipients,
    stageIds: stillCurrentIds(record.stageIds, catalog.stages.map((stage) => stage.id)),
    todoIds: stillCurrentIds(record.todoIds, catalog.todos.map((todo) => todo.id)),
    note: record.note,
    choice: "now",
    catalog,
    now,
  };
  const blurbs = await fillBlurbs(input);
  const { emails, skipped } = composeRecipientEmails({ ...input, catalog: catalogWithBlurbs(input.catalog, blurbs) });
  if (!emails.length) {
    const closed = markNudgeSent({ ...record, stageIds: input.stageIds, todoIds: input.todoIds }, now);
    await patchNudge(record.id, { ...closed, lastError: "Nothing left to send" });
    return { ok: true, status: "scheduled", nudgeId: record.id, sent: 0, skipped };
  }
  const failures: string[] = [];
  let sent = 0;
  for (const row of emails) {
    const result = await sendNudgeEmail(row.email);
    if (result.ok) sent += 1;
    else failures.push(`${row.email.toName}: ${result.error}`);
  }
  if (sent === 0) {
    const error = resendConfigured()
      ? failures[0] || "Could not send"
      : "Mail provider is not set up, so this Friday nudge was not sent.";
    await patchNudge(record.id, { lastError: error });
    return { ok: false, status: "scheduled", nudgeId: record.id, sent: 0, skipped, error };
  }
  const next = markNudgeSent(
    { ...record, stageIds: input.stageIds, todoIds: input.todoIds, lastError: failures.join("; ") || null },
    now,
  );
  await patchNudge(record.id, next);
  return { ok: failures.length === 0, status: next.status === "sent" ? "sent" : "scheduled", nudgeId: record.id, sent, skipped };
}
