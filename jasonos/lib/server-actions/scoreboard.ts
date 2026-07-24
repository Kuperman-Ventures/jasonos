"use server";

import { revalidatePath } from "next/cache";
import { createPublicServiceRoleClient } from "@/lib/supabase/server";
import {
  SCOREBOARD_STATUSES,
  shouldAgeSubmittedToNoReply,
  type ScoreboardApplication,
  type ScoreboardStatus,
} from "@/lib/scoreboard/types";

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function isScoreboardStatus(value: unknown): value is ScoreboardStatus {
  return (
    typeof value === "string" &&
    (SCOREBOARD_STATUSES as string[]).includes(value)
  );
}

function defaultStatusFromResult(result: string | null | undefined): ScoreboardStatus {
  switch (result) {
    case "Offer Received":
      return "offer";
    case "Rejected":
      return "rejected";
    case "Interview Scheduled":
      return "next_steps";
    case "Pending":
      return "no_reply";
    case "Application Submitted":
    default:
      return "submitted";
  }
}

type WorkSearchRow = {
  id: string;
  date: string;
  company_name: string;
  position_applied: string;
  contact_method: string;
  result: string;
  scoreboard_status: string | null;
  scoreboard_status_set_at: string | null;
  activity_tier: string | null;
};

function isApplicationRow(row: WorkSearchRow): boolean {
  if (isScoreboardStatus(row.scoreboard_status)) return true;
  if (row.activity_tier === "networking") return false;
  if (
    row.contact_method === "Online Portal" ||
    row.contact_method === "Direct Email"
  ) {
    return true;
  }
  return [
    "Application Submitted",
    "Rejected",
    "Offer Received",
    "Interview Scheduled",
    "Pending",
  ].includes(row.result);
}

/**
 * Persist submitted → no_reply for blues that have sat untouched for 30+ days
 * (clock starts at last manual set, or the application date if never set).
 */
async function ageStaleSubmitted(
  db: ReturnType<typeof createPublicServiceRoleClient>,
  rows: WorkSearchRow[]
): Promise<Set<string>> {
  const now = new Date();
  const staleIds = rows
    .filter((row) => {
      const status = isScoreboardStatus(row.scoreboard_status)
        ? row.scoreboard_status
        : defaultStatusFromResult(row.result);
      return shouldAgeSubmittedToNoReply({
        date: row.date,
        scoreboard_status: status,
        scoreboard_status_set_at: row.scoreboard_status_set_at,
      }, now);
    })
    .map((row) => row.id);

  if (!staleIds.length) return new Set();

  const { error } = await db
    .from("work_searches")
    .update({
      scoreboard_status: "no_reply",
      // Keep prior set_at if present so we don't pretend this was a manual click.
      // Only stamp if null so the aging rule itself is recorded once.
      scoreboard_status_set_at: now.toISOString(),
    })
    .in("id", staleIds)
    .eq("scoreboard_status", "submitted");

  // Also catch rows that never had scoreboard_status written but default to submitted.
  if (error) {
    console.error("[scoreboard.ageStaleSubmitted]", error);
  }

  // Rows with null status that age: update those too.
  const nullStale = rows
    .filter(
      (row) =>
        !row.scoreboard_status &&
        shouldAgeSubmittedToNoReply(
          {
            date: row.date,
            scoreboard_status: defaultStatusFromResult(row.result),
            scoreboard_status_set_at: row.scoreboard_status_set_at,
          },
          now
        )
    )
    .map((row) => row.id);

  if (nullStale.length) {
    const { error: nullErr } = await db
      .from("work_searches")
      .update({
        scoreboard_status: "no_reply",
        scoreboard_status_set_at: now.toISOString(),
      })
      .in("id", nullStale)
      .is("scoreboard_status", null);
    if (nullErr) console.error("[scoreboard.ageStaleSubmitted.null]", nullErr);
  }

  return new Set([...staleIds, ...nullStale]);
}

/**
 * Job applications pulled from NYUI work_searches for the Scoreboard.
 * Excludes pure networking / advisor activities — Online Portal + Direct Email
 * apps, plus anything already tagged with a scoreboard status or an
 * application-shaped result.
 *
 * Also applies the aging rule: submitted (blue) with no manual change for
 * 30+ days becomes no_reply (orange).
 */
export async function getScoreboardApplications(): Promise<ScoreboardApplication[]> {
  if (!hasConfig()) return [];

  const db = createPublicServiceRoleClient();
  let result = await db
    .from("work_searches")
    .select(
      "id,date,company_name,position_applied,contact_method,result,scoreboard_status,scoreboard_status_set_at,activity_tier"
    )
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  // Graceful fallback if migration 0041 hasn't landed yet.
  if (result.error && /scoreboard_status_set_at/i.test(result.error.message)) {
    result = (await db
      .from("work_searches")
      .select(
        "id,date,company_name,position_applied,contact_method,result,scoreboard_status,activity_tier"
      )
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })) as typeof result;
  }

  if (result.error) {
    console.error("[scoreboard.getScoreboardApplications]", result.error);
    return [];
  }

  const rows = ((result.data ?? []) as WorkSearchRow[]).map((row) => ({
    ...row,
    scoreboard_status_set_at:
      (row as { scoreboard_status_set_at?: string | null })
        .scoreboard_status_set_at ?? null,
  }));

  const apps = rows.filter(isApplicationRow);
  const agedIds = await ageStaleSubmitted(db, apps);

  return apps.map((row) => {
    let status: ScoreboardStatus = isScoreboardStatus(row.scoreboard_status)
      ? row.scoreboard_status
      : defaultStatusFromResult(row.result);

    if (agedIds.has(row.id)) status = "no_reply";

    return {
      id: row.id,
      date: row.date,
      company_name: row.company_name,
      position_applied: row.position_applied,
      contact_method: row.contact_method,
      result: row.result,
      scoreboard_status: status,
      scoreboard_status_set_at: row.scoreboard_status_set_at,
    };
  });
}

export async function setScoreboardStatus(
  id: string,
  status: ScoreboardStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (!id) return { ok: false, error: "Missing application id." };
  if (!isScoreboardStatus(status)) {
    return { ok: false, error: "Invalid scoreboard status." };
  }

  const db = createPublicServiceRoleClient();
  const now = new Date().toISOString();

  let { error } = await db
    .from("work_searches")
    .update({
      scoreboard_status: status,
      scoreboard_status_set_at: now,
    })
    .eq("id", id);

  // If set_at column isn't live yet, still save the status.
  if (error && /scoreboard_status_set_at/i.test(error.message)) {
    ({ error } = await db
      .from("work_searches")
      .update({ scoreboard_status: status })
      .eq("id", id));
  }

  if (error) return { ok: false, error: error.message };

  revalidatePath("/scoreboard");
  return { ok: true };
}
