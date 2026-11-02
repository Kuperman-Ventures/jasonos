/**
 * Things Jason snoozed or set for a later day that are still waiting.
 * Reads current rows, not the history log, so a later dismiss drops off.
 */
import { etToday } from "@/lib/dates";
import { hasSupabaseConfig, jasonosDb, publicDb } from "@/lib/mcp/db";
import { scheduledDay, type UpcomingItem } from "@/lib/actions/upcoming-format";

const LIMIT = 200;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function push(
  items: UpcomingItem[],
  row: Omit<UpcomingItem, "dueOn" | "href"> & {
    dueRaw: string | null;
    href: string | null;
    /** Person pages still show a future date. Queue pages hide it until that day. */
    alwaysLink?: boolean;
  }
) {
  const subject = row.subject.replace(/\s+/g, " ").trim();
  if (!subject) return;
  const dueOn = scheduledDay(row.dueRaw);
  const today = etToday();
  const href =
    row.href && (row.alwaysLink || (dueOn != null && dueOn <= today)) ? row.href : null;
  const detail = row.detail?.replace(/\s+/g, " ").trim() ?? "";
  items.push({
    id: row.id,
    dueOn,
    area: row.area,
    subject: subject.slice(0, 300),
    detail: detail.slice(0, 300) || null,
    href,
  });
}

async function meetingFollowups(): Promise<UpcomingItem[]> {
  const { data, error } = await jasonosDb()
    .from("meeting_followups")
    .select("id,title,snooze_until")
    .eq("status", "snoozed")
    .limit(LIMIT);
  if (error) throw new Error(error.message);
  const items: UpcomingItem[] = [];
  for (const row of data ?? []) {
    push(items, {
      id: `meeting:${row.id}`,
      dueRaw: text(row.snooze_until) || null,
      area: "Meeting follow-up",
      subject: text(row.title) || "Meeting",
      detail: null,
      href: "/outreach/sent",
    });
  }
  return items;
}

async function emailFollowups(): Promise<UpcomingItem[]> {
  const { data, error } = await jasonosDb()
    .from("sent_email_followups")
    .select("id,subject,to_line,follow_up_due")
    .eq("status", "scheduled")
    .limit(LIMIT);
  if (error) throw new Error(error.message);
  const items: UpcomingItem[] = [];
  for (const row of data ?? []) {
    const subject = text(row.subject);
    const to = text(row.to_line);
    push(items, {
      id: `email:${row.id}`,
      dueRaw: text(row.follow_up_due) || null,
      area: "Email follow-up",
      subject: subject || to || "Email",
      detail: subject && to ? `To ${to}` : null,
      href: "/outreach/sent",
    });
  }
  return items;
}

async function commitments(): Promise<UpcomingItem[]> {
  const db = jasonosDb();
  const [{ data: states, error: stateError }, { data: checks, error: checkError }] = await Promise.all([
    db
      .from("commitment_item_states")
      .select("item_key,snoozed_until")
      .eq("state", "snoozed")
      .limit(LIMIT),
    db
      .from("commitment_checks")
      .select("check_date,payload")
      .order("check_date", { ascending: false })
      .limit(40),
  ]);
  if (stateError) throw new Error(stateError.message);
  if (checkError) throw new Error(checkError.message);
  const byKey = new Map<string, { promise: string; to: string }>();
  for (const check of checks ?? []) {
    const items = (check.payload as { items?: { key?: string; promise?: string; to?: string }[] } | null)
      ?.items;
    for (const item of items ?? []) {
      const key = text(item.key);
      const promise = text(item.promise);
      if (!key || !promise || byKey.has(key)) continue;
      byKey.set(key, { promise, to: text(item.to) });
    }
  }
  const items: UpcomingItem[] = [];
  for (const row of states ?? []) {
    const key = text(row.item_key);
    const known = byKey.get(key);
    push(items, {
      id: `commitment:${key}`,
      dueRaw: text(row.snoozed_until) || null,
      area: "Commitment",
      subject: known?.promise || "Commitment",
      detail: known?.to ? `To ${known.to}` : null,
      href: "/",
    });
  }
  return items;
}

async function cards(): Promise<UpcomingItem[]> {
  const { data, error } = await jasonosDb()
    .from("cards")
    .select("id,title,snoozed_until")
    .eq("state", "snoozed")
    .limit(LIMIT);
  if (error) throw new Error(error.message);
  const items: UpcomingItem[] = [];
  for (const row of data ?? []) {
    push(items, {
      id: `card:${row.id}`,
      dueRaw: text(row.snoozed_until) || null,
      area: "Card",
      subject: text(row.title) || "Card",
      detail: null,
      href: "/",
    });
  }
  return items;
}

async function manualTouches(): Promise<UpcomingItem[]> {
  const { data, error } = await jasonosDb()
    .from("contacts")
    .select("id,name,next_touch_date")
    .eq("next_touch_is_manual", true)
    .not("next_touch_date", "is", null)
    .limit(LIMIT);
  if (error) throw new Error(error.message);
  const items: UpcomingItem[] = [];
  for (const row of data ?? []) {
    const id = text(row.id);
    push(items, {
      id: `touch:${id}`,
      dueRaw: text(row.next_touch_date) || null,
      area: "Next touch",
      subject: text(row.name) || "Contact",
      detail: null,
      href: `/outreach/people?id=${encodeURIComponent(id)}`,
      alwaysLink: true,
    });
  }
  return items;
}

async function reconnectSnoozes(): Promise<UpcomingItem[]> {
  const { data, error } = await publicDb()
    .from("rr_contact_state")
    .select("contact_id,next_action_due_date")
    .eq("status", "snoozed")
    .limit(LIMIT);
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((row) => text(row.contact_id)).filter(Boolean);
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people, error: nameError } = await publicDb()
      .from("rr_recruiters")
      .select("id,name")
      .in("id", ids);
    if (nameError) throw new Error(nameError.message);
    for (const person of people ?? []) {
      const name = text(person.name);
      if (name) names.set(text(person.id), name);
    }
  }
  const items: UpcomingItem[] = [];
  for (const row of data ?? []) {
    const id = text(row.contact_id);
    push(items, {
      id: `reconnect:${id}`,
      dueRaw: text(row.next_action_due_date) || null,
      area: "Reconnect",
      subject: names.get(id) || "Contact",
      detail: null,
      href: "/reconnect",
    });
  }
  return items;
}

const LOADERS = [
  meetingFollowups,
  emailFollowups,
  commitments,
  cards,
  manualTouches,
  reconnectSnoozes,
];

export async function getUpcoming(): Promise<UpcomingItem[]> {
  if (!hasSupabaseConfig()) return [];
  const batches = await Promise.all(
    LOADERS.map(async (load) => {
      try {
        return await load();
      } catch (err) {
        console.error("[upcoming]", err);
        return [];
      }
    })
  );
  return batches.flat();
}
