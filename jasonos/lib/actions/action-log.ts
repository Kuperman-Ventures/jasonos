/**
 * Append-only log of decisions Jason makes (snooze, skip, done, dismiss).
 * Safe to import from server actions and the JasonOS MCP. A failed write
 * must not undo the decision that just succeeded.
 */
import { jasonosDb, publicDb, hasSupabaseConfig } from "@/lib/mcp/db";
import type { ActionLogRow } from "@/lib/actions/action-log-format";

export type { ActionLogRow } from "@/lib/actions/action-log-format";

export interface UserActionInput {
  verb: string;
  area: string;
  subject: string;
  detail?: string | null;
  actor?: "jason" | "claude";
  targetTable?: string | null;
  targetId?: string | null;
}

function clean(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export async function recordUserAction(input: UserActionInput): Promise<void> {
  if (!hasSupabaseConfig()) return;
  const subject = clean(input.subject, 300);
  const verb = clean(input.verb, 80);
  const area = clean(input.area, 80);
  if (!subject || !verb || !area) return;
  const detail = input.detail ? clean(input.detail, 500) : "";
  try {
    const { error } = await jasonosDb()
      .from("action_log")
      .insert({
        verb,
        area,
        subject,
        detail: detail || null,
        actor: input.actor === "claude" ? "claude" : "jason",
        target_table: input.targetTable ?? null,
        target_id: input.targetId ?? null,
      });
    if (error) console.error("[action-log]", error.message);
  } catch (err) {
    console.error("[action-log]", err);
  }
}

export async function getActionLog(limit = 500): Promise<ActionLogRow[]> {
  if (!hasSupabaseConfig()) return [];
  try {
    const { data, error } = await jasonosDb()
      .from("action_log")
      .select("id,acted_at,verb,area,subject,detail,actor")
      .order("acted_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[action-log.get]", error.message);
      return [];
    }
    return (data ?? []) as ActionLogRow[];
  } catch (err) {
    console.error("[action-log.get]", err);
    return [];
  }
}

export async function lookupContactName(id: string): Promise<string | null> {
  if (!hasSupabaseConfig() || !id) return null;
  try {
    const { data, error } = await jasonosDb()
      .from("contacts")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    return name || null;
  } catch {
    return null;
  }
}

export async function lookupRecruiterName(id: string): Promise<string | null> {
  if (!hasSupabaseConfig() || !id) return null;
  try {
    const { data, error } = await publicDb()
      .from("rr_recruiters")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    return name || null;
  } catch {
    return null;
  }
}
