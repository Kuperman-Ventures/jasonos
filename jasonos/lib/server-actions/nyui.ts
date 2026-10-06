"use server";

import { revalidatePath } from "next/cache";
import {
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { getOutreachPeople } from "@/lib/outreach/data";
import {
  buildAuditNetworkingRows,
  type AuditNetworkingRow,
  type NetworkingContactInput,
  type NetworkingTouchInput,
} from "@/lib/nyui/audit-networking";
import {
  applicationKey,
  defaultStatusFromResult,
  isApplicationWorkSearch,
} from "@/lib/scoreboard/types";

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkSearch {
  id: string;
  date: string;
  company_name: string;
  company_location: string;
  contact_method: string;
  contact_person: string | null;
  position_applied: string;
  result: string;
  created_at: string;
  // Proof-of-effort fields (migration 0022). Nullable for rows logged before
  // the columns existed; the UI derives a fallback tier from contact_method.
  activity_tier: string | null;
  outcome_next_step: string | null;
  next_contact_date: string | null;
  parent_activity_id: string | null;
}

export interface BusinessHour {
  id: string;
  date: string;
  entity: string;
  activity_description: string;
  hours: number;
  minutes: number;
  created_at: string;
  // Category for hourly breakdowns (migration 0042). Nullable for older rows.
  activity_category: string | null;
  // Client the hours were for (migration 0043). Nullable for older rows.
  client_name: string | null;
}

export interface NyuiWeekData {
  workSearches: WorkSearch[];
  businessHours: BusinessHour[];
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getWeekData(weekStart: string, weekEnd: string): Promise<NyuiWeekData> {
  if (!hasConfig()) return { workSearches: [], businessHours: [] };

  const db = createPublicServiceRoleClient();
  const [wsRes, bhRes] = await Promise.all([
    db.from("work_searches").select("*").gte("date", weekStart).lte("date", weekEnd).order("date"),
    db.from("business_hours").select("*").gte("date", weekStart).lte("date", weekEnd).order("date"),
  ]);

  return {
    workSearches: (wsRes.data ?? []) as WorkSearch[],
    businessHours: (bhRes.data ?? []) as BusinessHour[],
  };
}

/**
 * All work-search activities across all time, newest first. Powers the
 * "All Activity" history view (grouped by claim week in the client).
 */
export async function getAllWorkSearches(): Promise<WorkSearch[]> {
  if (!hasConfig()) return [];

  const db = createPublicServiceRoleClient();
  const { data } = await db
    .from("work_searches")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []) as WorkSearch[];
}

/**
 * All business-hours entries across all time, newest first. Shown under each
 * claim week in the All Activity view alongside work searches.
 */
export async function getAllBusinessHours(): Promise<BusinessHour[]> {
  if (!hasConfig()) return [];

  const db = createPublicServiceRoleClient();
  const { data } = await db
    .from("business_hours")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []) as BusinessHour[];
}

/**
 * NYS Work Search ID (format "NY" + 9 digits). Sensitive config — stamped on
 * audit exports so an auditor can match the claimant, NEVER the SSN. Stored in
 * the NYUI_WORK_SEARCH_ID env var (server-only); the SSN is never stored or
 * surfaced anywhere in this tool.
 */
export async function getWorkSearchId(): Promise<string | null> {
  return process.env.NYUI_WORK_SEARCH_ID?.trim() || null;
}

/**
 * Pull JasonOS networking activity (meetings + fresh outreach) into Tier B
 * shapes for the audit ledger. Dedupes against work_searches already logged
 * as Tier B in the same range. Failures here never block the rest of the
 * export — networking is additive fill.
 */
async function loadNetworkingTierB(
  startDate: string,
  endDate: string,
  workSearches: WorkSearch[]
): Promise<AuditNetworkingRow[]> {
  try {
    const sb = createServiceRoleClient();
    // Pad lookback so the 90-day "fresh outreach" window is accurate.
    const lookback = new Date(`${startDate}T12:00:00Z`);
    lookback.setUTCDate(lookback.getUTCDate() - 100);
    const touchSince = lookback.toISOString();

    // getOutreachPeople already resolves firm / title / LinkedIn / intent with
    // schema fallbacks — reuse it instead of a fragile parallel contacts select.
    const [people, touchesRes] = await Promise.all([
      getOutreachPeople(),
      sb
        .from("contact_touches")
        .select("id,contact_id,channel,direction,touched_at,brief,outcome")
        .gte("touched_at", touchSince)
        .order("touched_at", { ascending: false })
        .limit(12000),
    ]);

    if (touchesRes.error) {
      console.error(
        "[nyui.loadNetworkingTierB] contact_touches",
        touchesRes.error.message
      );
      return [];
    }

    const contactsById = new Map<string, NetworkingContactInput>();
    for (const p of people) {
      contactsById.set(p.id, {
        id: p.id,
        name: p.name,
        title: p.title,
        firm: p.firm,
        linkedin_url: p.linkedin_url,
        phone: p.phone,
        primary_email: p.primary_email,
        intent: p.intent,
        is_networking: p.is_networking,
      });
    }

    const touches: NetworkingTouchInput[] = (touchesRes.data ?? []).map(
      (t) => ({
        id: t.id as string,
        contact_id: t.contact_id as string,
        channel: (t.channel as string | null) ?? null,
        direction: (t.direction as string | null) ?? null,
        touched_at: (t.touched_at as string) ?? "",
        brief: (t.brief as string | null) ?? null,
        outcome: (t.outcome as string | null) ?? null,
      })
    );

    const existingTierB = workSearches
      .filter(
        (w) =>
          w.activity_tier === "networking" ||
          ["LinkedIn", "Networking Event", "Networking Contact", "Career-Center Advisor Meeting"].includes(
            w.contact_method
          )
      )
      .map((w) => ({
        date: w.date,
        contact_person: w.contact_person,
        company_name: w.company_name,
      }));

    return buildAuditNetworkingRows({
      startDate,
      endDate,
      touches,
      contactsById,
      existingTierB,
    });
  } catch (err) {
    console.error("[nyui.loadNetworkingTierB]", err);
    return [];
  }
}

export async function getExportData(startDate: string, endDate: string): Promise<{
  workSearches: WorkSearch[];
  businessHours: BusinessHour[];
  /** JasonOS networking activity shaped as Tier B rows (additive fill). */
  networkingTierB: AuditNetworkingRow[];
  workSearchId: string | null;
  error?: string;
}> {
  const workSearchId = await getWorkSearchId();
  if (!hasConfig())
    return {
      workSearches: [],
      businessHours: [],
      networkingTierB: [],
      workSearchId,
      error: "Not configured",
    };

  const db = createPublicServiceRoleClient();
  const [wsRes, bhRes] = await Promise.all([
    db.from("work_searches").select("*").gte("date", startDate).lte("date", endDate).order("date"),
    db.from("business_hours").select("*").gte("date", startDate).lte("date", endDate).order("date"),
  ]);

  if (wsRes.error)
    return {
      workSearches: [],
      businessHours: [],
      networkingTierB: [],
      workSearchId,
      error: wsRes.error.message,
    };
  if (bhRes.error)
    return {
      workSearches: [],
      businessHours: [],
      networkingTierB: [],
      workSearchId,
      error: bhRes.error.message,
    };

  const workSearches = (wsRes.data ?? []) as WorkSearch[];
  const networkingTierB = await loadNetworkingTierB(
    startDate,
    endDate,
    workSearches
  );

  return {
    workSearches,
    businessHours: (bhRes.data ?? []) as BusinessHour[],
    networkingTierB,
    workSearchId,
  };
}

// ─── Writes ───────────────────────────────────────────────────────────────────

async function findExistingApplicationRoot(
  db: ReturnType<typeof createPublicServiceRoleClient>,
  company: string,
  role: string
): Promise<string | null> {
  const companyName = company.trim();
  const position = role.trim();
  if (!companyName || !position) return null;

  const { data, error } = await db
    .from("work_searches")
    .select(
      "id,date,company_name,position_applied,parent_activity_id,scoreboard_status,activity_tier,contact_method,result"
    )
    .ilike("company_name", companyName)
    .ilike("position_applied", position)
    .order("date", { ascending: true })
    .limit(20);

  if (error || !data?.length) return null;

  const key = applicationKey(companyName, position);
  const matches = data.filter(
    (row) =>
      applicationKey(row.company_name ?? "", row.position_applied ?? "") ===
        key && isApplicationWorkSearch(row)
  );
  const earliest = matches[0];
  if (!earliest) return null;
  return earliest.parent_activity_id ?? earliest.id;
}

export async function addWorkSearch(data: {
  date: string;
  company_name: string;
  company_location: string;
  contact_method: string;
  contact_person: string | null;
  position_applied: string;
  result: string;
  // Proof-of-effort fields (migration 0022). All optional/additive.
  activity_tier?: string | null;
  outcome_next_step?: string | null;
  next_contact_date?: string | null;
  parent_activity_id?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const looksLikeApplication = isApplicationWorkSearch({
    activity_tier: data.activity_tier,
    contact_method: data.contact_method,
    result: data.result,
  });
  const parentId =
    data.parent_activity_id ??
    (looksLikeApplication
      ? await findExistingApplicationRoot(
          db,
          data.company_name,
          data.position_applied
        )
      : null);

  const { error } = await db.from("work_searches").insert([
    {
      date: data.date,
      company_name: data.company_name,
      company_location: data.company_location,
      contact_person: data.contact_person,
      contact_method: data.contact_method,
      position_applied: data.position_applied,
      result: data.result,
      activity_tier: data.activity_tier ?? null,
      outcome_next_step: data.outcome_next_step ?? null,
      next_contact_date: data.next_contact_date ?? null,
      parent_activity_id: parentId,
      scoreboard_status: defaultStatusFromResult(data.result),
    },
  ]);
  if (error) return { ok: false, error: error.message };

  if (parentId && looksLikeApplication) {
    const { error: rootError } = await db
      .from("work_searches")
      .update({
        scoreboard_status: defaultStatusFromResult(data.result),
        result: data.result,
        scoreboard_status_set_at: new Date().toISOString(),
      })
      .eq("id", parentId);
    if (rootError) {
      console.error("[nyui.addWorkSearch.promoteRoot]", rootError);
    }
  }

  revalidatePath("/nyui");
  revalidatePath("/scoreboard");
  return { ok: true };
}

export async function updateWorkSearch(data: {
  id: string;
  date: string;
  company_name: string;
  company_location: string;
  contact_method: string;
  contact_person: string | null;
  position_applied: string;
  result: string;
  activity_tier?: string | null;
  outcome_next_step?: string | null;
  next_contact_date?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { error } = await db
    .from("work_searches")
    .update({
      date: data.date,
      company_name: data.company_name,
      company_location: data.company_location,
      contact_method: data.contact_method,
      contact_person: data.contact_person,
      position_applied: data.position_applied,
      result: data.result,
      activity_tier: data.activity_tier ?? null,
      outcome_next_step: data.outcome_next_step ?? null,
      next_contact_date: data.next_contact_date ?? null,
      scoreboard_status: defaultStatusFromResult(data.result),
    })
    .eq("id", data.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  revalidatePath("/scoreboard");
  return { ok: true };
}

export async function deleteWorkSearch(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  // parent_activity_id is ON DELETE SET NULL, so removing a parent just unlinks
  // any follow-ups rather than deleting them.
  const { error } = await db.from("work_searches").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  revalidatePath("/scoreboard");
  return { ok: true };
}

export async function addBusinessHours(data: {
  date: string;
  entity: string;
  activity_description: string;
  hours: number;
  minutes: number;
  activity_category?: string | null;
  client_name?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { error } = await db.from("business_hours").insert([
    {
      date: data.date,
      entity: data.entity,
      activity_description: data.activity_description,
      hours: data.hours,
      minutes: data.minutes,
      activity_category: data.activity_category ?? null,
      client_name: data.client_name?.trim() || null,
    },
  ]);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  return { ok: true };
}

/** Insert multiple category breakdown rows for one date + entity in one shot. */
export async function addBusinessHoursBatch(
  rows: {
    date: string;
    entity: string;
    activity_description: string;
    hours: number;
    minutes: number;
    activity_category: string;
    client_name?: string | null;
  }[]
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (rows.length === 0) return { ok: false, error: "No hours to log" };

  const db = createPublicServiceRoleClient();
  const { error } = await db.from("business_hours").insert(
    rows.map((r) => ({
      date: r.date,
      entity: r.entity,
      activity_description: r.activity_description,
      hours: r.hours,
      minutes: r.minutes,
      activity_category: r.activity_category,
      client_name: r.client_name?.trim() || null,
    }))
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  return { ok: true, count: rows.length };
}

export async function updateBusinessHours(data: {
  id: string;
  date: string;
  entity: string;
  activity_description: string;
  hours: number;
  minutes: number;
  activity_category?: string | null;
  client_name?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { error } = await db
    .from("business_hours")
    .update({
      date: data.date,
      entity: data.entity,
      activity_description: data.activity_description,
      hours: data.hours,
      minutes: data.minutes,
      activity_category: data.activity_category ?? null,
      client_name: data.client_name?.trim() || null,
    })
    .eq("id", data.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  return { ok: true };
}

export async function deleteBusinessHours(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { error } = await db.from("business_hours").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  return { ok: true };
}
