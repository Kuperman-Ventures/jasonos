"use server";

import { revalidatePath } from "next/cache";
import { createPublicServiceRoleClient } from "@/lib/supabase/server";
import {
  SCOREBOARD_STATUSES,
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

/**
 * Job applications pulled from NYUI work_searches for the Scoreboard.
 * Excludes pure networking / advisor activities — Online Portal + Direct Email
 * apps, plus anything already tagged with a scoreboard status or an
 * application-shaped result.
 */
export async function getScoreboardApplications(): Promise<ScoreboardApplication[]> {
  if (!hasConfig()) return [];

  const db = createPublicServiceRoleClient();
  const { data, error } = await db
    .from("work_searches")
    .select(
      "id,date,company_name,position_applied,contact_method,result,scoreboard_status,activity_tier"
    )
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[scoreboard.getScoreboardApplications]", error);
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    date: string;
    company_name: string;
    position_applied: string;
    contact_method: string;
    result: string;
    scoreboard_status: string | null;
    activity_tier: string | null;
  }>;

  return rows
    .filter((row) => {
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
    })
    .map((row) => ({
      id: row.id,
      date: row.date,
      company_name: row.company_name,
      position_applied: row.position_applied,
      contact_method: row.contact_method,
      result: row.result,
      scoreboard_status: isScoreboardStatus(row.scoreboard_status)
        ? row.scoreboard_status
        : defaultStatusFromResult(row.result),
    }));
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
  const { error } = await db
    .from("work_searches")
    .update({ scoreboard_status: status })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/scoreboard");
  return { ok: true };
}
