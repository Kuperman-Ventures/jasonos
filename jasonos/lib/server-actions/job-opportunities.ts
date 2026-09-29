"use server";

import { revalidatePath } from "next/cache";
import { harvestJobAlertsFromGmail } from "@/lib/data/job-alert-harvest";
import { createServiceRoleClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function scanJobAlerts(runId?: string): Promise<
  | { ok: true; inserted: number; scanned: number; listed: number }
  | { ok: false; error: string }
> {
  const result = await harvestJobAlertsFromGmail(runId);
  revalidatePath("/job-alerts");
  if (!result.ok) return { ok: false, error: result.error || "Job alert scan failed." };
  return {
    ok: true,
    inserted: result.inserted,
    scanned: result.scanned,
    listed: result.listed,
  };
}

export async function deleteJobOpportunity(id: string): Promise<Result> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (!UUID_RE.test(id)) return { ok: false, error: "Invalid listing." };
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("job_opportunities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/job-alerts");
  return { ok: true };
}
