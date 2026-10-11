/**
 * Commitment Check data access. Service-role, MCP-safe (no Next.js imports),
 * so the home page, server actions and the JasonOS MCP share it.
 */
import { jasonosDb } from "../mcp/db";
import { buildViews, etDate, parseCommitmentPayload } from "./logic";
import {
  ITEM_STATES,
  type CommitmentCheckForHome,
  type CommitmentCheckPayload,
  type CommitmentItemStateRow,
  type ItemState,
} from "./types";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const STATE_COLS = "item_key,state,snoozed_until,note,updated_at,updated_by";

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
  const items = Array.isArray(payload.items) ? payload.items : [];
  const states = await listStates(items.map((i) => i.key));
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
  return { ok: true, item_key: key, state: input.state };
}
