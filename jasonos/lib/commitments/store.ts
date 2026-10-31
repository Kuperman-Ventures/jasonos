/**
 * Commitment Check data access. Service-role, MCP-safe (no Next.js imports),
 * so the home page, server actions and the JasonOS MCP share it.
 */
import { recordUserAction } from "../actions/action-log";
import { untilDetail } from "../actions/action-log-format";
import { jasonosDb } from "../mcp/db";
import { applyCommitmentOverrides, buildViews, etDate, parseCommitmentPayload } from "./logic";
import {
  ITEM_STATES,
  type CommitmentCheckForHome,
  type CommitmentCheckPayload,
  type CommitmentItemOverride,
  type CommitmentItemStateRow,
  type ItemState,
} from "./types";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const STATE_COLS = "item_key,state,snoozed_until,note,updated_at,updated_by";
const OVERRIDE_COLS = "item_key,promise,to,due_date,updated_at,updated_by";

function fail(error: { message: string }): never {
  throw new Error(error.message);
}

/** YYYY-MM-DD in America/New_York, defaulting to today; up to 1 day ahead or 21 days back. */
export function resolveCheckDate(raw?: string | null): string {
  const today = etDate();
  const value = raw?.trim();
  if (!value) return today;
  if (!YMD.test(value)) throw new Error("date must be YYYY-MM-DD (America/New_York).");
  const days = Math.round((Date.parse(`${value}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  if (days > 1) throw new Error("date cannot be more than 1 day in the future.");
  if (days < -21) throw new Error("date cannot be more than 21 days in the past.");
  return value;
}

export async function publishCommitmentCheck(input: { date?: string; payload_json: string }) {
  const check_date = resolveCheckDate(input.date);
  const payload = parseCommitmentPayload(input.payload_json);
  const { data, error } = await jasonosDb()
    .from("commitment_checks")
    .upsert({ check_date, payload }, { onConflict: "check_date" })
    .select("check_date,created_at,updated_at")
    .single();
  if (error) fail(error);
  return {
    ok: true,
    published: "commitment_check",
    check_date: data.check_date as string,
    items: payload.items.length,
    delivered_count: payload.delivered_count,
    home: "https://jasonos.vercel.app/",
  };
}

async function listStates(keys: string[]): Promise<CommitmentItemStateRow[]> {
  if (!keys.length) return [];
  const { data, error } = await jasonosDb()
    .from("commitment_item_states")
    .select(STATE_COLS)
    .in("item_key", keys.slice(0, 500));
  if (error) fail(error);
  return (data ?? []) as CommitmentItemStateRow[];
}

async function listOverrides(keys: string[]): Promise<CommitmentItemOverride[]> {
  if (!keys.length) return [];
  const { data, error } = await jasonosDb()
    .from("commitment_item_overrides")
    .select(OVERRIDE_COLS)
    .in("item_key", keys.slice(0, 500));
  if (error) fail(error);
  return ((data ?? []) as Array<{
    item_key: string;
    promise: string;
    to: string;
    due_date: string | null;
    updated_at: string;
    updated_by: string;
  }>).map((row) => ({
    item_key: row.item_key,
    promise: row.promise,
    to: row.to,
    due_date: row.due_date,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  }));
}

/** Latest published check, merged with Home actions, sections recalculated for today. */
export async function getCommitmentCheckForHome(): Promise<CommitmentCheckForHome> {
  const today = etDate();
  const { data, error } = await jasonosDb()
    .from("commitment_checks")
    .select("check_date,payload")
    .order("check_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(error);
  if (!data) {
    return {
      check_date: null,
      today,
      is_stale: false,
      generated_at: null,
      sources: null,
      delivered_count: 0,
      notes: null,
      items: [],
      hidden_count: 0,
    };
  }
  const payload = data.payload as CommitmentCheckPayload;
  const published = Array.isArray(payload.items) ? payload.items : [];
  const keys = published.map((i) => i.key);
  const [states, overrides] = await Promise.all([listStates(keys), listOverrides(keys)]);
  const items = applyCommitmentOverrides(published, overrides);
  const { visible, hidden } = buildViews(items, states, today);
  return {
    check_date: data.check_date as string,
    today,
    is_stale: data.check_date !== today,
    generated_at: payload.generated_at ?? null,
    sources: payload.sources ?? null,
    delivered_count: payload.delivered_count ?? 0,
    notes: payload.notes ?? null,
    items: visible,
    hidden_count: hidden,
  };
}

/**
 * Save a Home edit to the quoted promise (and to / due date). Key stays the same
 * so Done / Scheduled state still matches after the next publish.
 */
export async function updateCommitmentItem(input: {
  item_key: string;
  promise: string;
  to: string;
  due_date: string | null;
  actor?: "jasonos" | "claude";
}): Promise<{ ok: true; item_key: string }> {
  const key = input.item_key.trim();
  if (!key || key.length > 160) throw new Error("item_key is required.");
  const promise = input.promise.replace(/\s+/g, " ").trim();
  const to = input.to.replace(/\s+/g, " ").trim();
  if (!promise) throw new Error("Enter the commitment text.");
  if (promise.length > 600) throw new Error("Commitment text is too long.");
  if (!to) throw new Error("Enter who it was promised to.");
  if (to.length > 300) throw new Error("Recipient name is too long.");
  const due_date = input.due_date?.trim() || null;
  if (due_date && !YMD.test(due_date)) throw new Error("Due date must be YYYY-MM-DD.");

  const actor = input.actor ?? "jasonos";
  const db = jasonosDb();
  const { error: overrideError } = await db.from("commitment_item_overrides").upsert(
    {
      item_key: key,
      promise,
      to,
      due_date,
      updated_by: actor,
    },
    { onConflict: "item_key" }
  );
  if (overrideError) fail(overrideError);

  // Keep the latest published payload in sync so action-log lookups see the edit.
  const { data: latest, error: latestError } = await db
    .from("commitment_checks")
    .select("check_date,payload")
    .order("check_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) fail(latestError);
  if (latest) {
    const payload = latest.payload as CommitmentCheckPayload;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const nextItems = items.map((item) =>
      item.key === key ? { ...item, promise, to, due_date } : item
    );
    if (nextItems.some((item, i) => item !== items[i])) {
      const { error: patchError } = await db
        .from("commitment_checks")
        .update({ payload: { ...payload, items: nextItems } })
        .eq("check_date", latest.check_date as string);
      if (patchError) fail(patchError);
    }
  }

  await recordUserAction({
    verb: "Edited",
    area: "Commitment",
    subject: promise,
    detail: [to ? `To ${to}` : null, due_date ? `Due ${due_date}` : "No date"].filter(Boolean).join(" · "),
    actor: actor === "claude" ? "claude" : "jason",
    targetTable: "commitment_item_overrides",
    targetId: key,
  });

  return { ok: true, item_key: key };
}

/** Every item key Jason has marked done or dismissed, plus active snoozes, for the publisher to skip. */
export async function listActiveItemStates(): Promise<CommitmentItemStateRow[]> {
  const { data, error } = await jasonosDb()
    .from("commitment_item_states")
    .select(STATE_COLS)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) fail(error);
  return (data ?? []) as CommitmentItemStateRow[];
}

export async function setCommitmentItemState(input: {
  item_key: string;
  state: ItemState | "open";
  snoozed_until?: string | null;
  note?: string | null;
  actor: "jasonos" | "claude";
}): Promise<{ ok: true; item_key: string; state: ItemState | "open" }> {
  const key = input.item_key.trim();
  if (!key || key.length > 160) throw new Error("item_key is required.");
  const db = jasonosDb();
  if (input.state === "open") {
    const { error } = await db.from("commitment_item_states").delete().eq("item_key", key);
    if (error) fail(error);
    await logCommitmentDecision(key, "open", null, input.actor);
    return { ok: true, item_key: key, state: "open" };
  }
  if (!(ITEM_STATES as readonly string[]).includes(input.state)) throw new Error("Unknown state.");
  if (input.state === "snoozed" && !(input.snoozed_until && YMD.test(input.snoozed_until))) {
    throw new Error("snoozed_until (YYYY-MM-DD) is required when snoozing.");
  }
  const { error } = await db.from("commitment_item_states").upsert(
    {
      item_key: key,
      state: input.state,
      snoozed_until: input.state === "snoozed" ? input.snoozed_until : null,
      note: input.note ?? null,
      updated_by: input.actor,
    },
    { onConflict: "item_key" }
  );
  if (error) fail(error);
  await logCommitmentDecision(
    key,
    input.state,
    input.state === "snoozed" ? input.snoozed_until ?? null : null,
    input.actor
  );
  return { ok: true, item_key: key, state: input.state };
}

async function logCommitmentDecision(
  key: string,
  state: ItemState | "open",
  snoozedUntil: string | null,
  actor: "jasonos" | "claude"
) {
  let subject = key;
  let to: string | null = null;
  try {
    const { data } = await jasonosDb()
      .from("commitment_checks")
      .select("payload")
      .order("check_date", { ascending: false })
      .limit(8);
    for (const row of data ?? []) {
      const items = (
        row.payload as { items?: { key?: string; promise?: string; to?: string }[] } | null
      )?.items;
      const hit = items?.find((item) => item.key === key);
      if (hit?.promise?.trim()) {
        subject = hit.promise.trim();
        to = hit.to?.trim() || null;
        break;
      }
    }
  } catch {
    // The key is enough if the published check cannot be read.
  }
  const verb =
    state === "done"
      ? "Done"
      : state === "dismissed"
        ? "Not a commitment"
        : state === "snoozed"
          ? "Snoozed"
          : state === "scheduled"
            ? "Scheduled"
            : "Reopened";
  const detail = [state === "snoozed" && snoozedUntil ? untilDetail(snoozedUntil) : null, to ? `To ${to}` : null]
    .filter(Boolean)
    .join(" · ");
  await recordUserAction({
    verb,
    area: "Commitment",
    subject,
    detail: detail || null,
    actor: actor === "claude" ? "claude" : "jason",
    targetTable: "commitment_item_states",
    targetId: key,
  });
}
