"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getAllWorkSearches } from "@/lib/server-actions/nyui";

export interface JobAlertKeyword {
  id: string;
  keyword: string;
}

type Result = { ok: true } | { ok: false; error: string };

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function revalidate() {
  revalidatePath("/job-alerts");
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Seed from NYUI role titles once, so the first visit isn't an empty capsule row. */
async function seedFromNyuiIfEmpty(): Promise<void> {
  const sb = createServiceRoleClient();
  const { count, error } = await sb
    .from("job_alert_keywords")
    .select("id", { count: "exact", head: true });
  if (error || (count ?? 0) > 0) return;

  const searches = await getAllWorkSearches();
  const seen = new Set<string>();
  const rows: { keyword: string }[] = [];
  for (const s of searches) {
    const raw = (s.position_applied ?? "").trim();
    if (!raw) continue;
    const key = normKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push({ keyword: raw });
    if (rows.length >= 40) break;
  }
  if (rows.length === 0) return;
  await sb.from("job_alert_keywords").insert(rows);
}

export async function listJobAlertKeywords(): Promise<JobAlertKeyword[]> {
  if (!hasConfig()) return [];
  const sb = createServiceRoleClient();
  try {
    await seedFromNyuiIfEmpty();
  } catch (err) {
    console.warn("[job-alert-keywords] seed failed:", err);
  }
  const { data, error } = await sb
    .from("job_alert_keywords")
    .select("id,keyword")
    .order("keyword", { ascending: true });
  if (error) {
    console.error("[job-alert-keywords.list]", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    keyword: r.keyword as string,
  }));
}

export async function addJobAlertKeyword(keyword: string): Promise<Result> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const trimmed = keyword.trim();
  if (!trimmed) return { ok: false, error: "Keyword can’t be empty." };
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("job_alert_keywords")
    .insert({ keyword: trimmed });
  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return { ok: false, error: "That keyword is already tracked." };
    }
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true };
}

export async function updateJobAlertKeyword(
  id: string,
  keyword: string
): Promise<Result> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (!id) return { ok: false, error: "id is required." };
  const trimmed = keyword.trim();
  if (!trimmed) return { ok: false, error: "Keyword can’t be empty." };
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("job_alert_keywords")
    .update({ keyword: trimmed })
    .eq("id", id);
  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return { ok: false, error: "That keyword is already tracked." };
    }
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true };
}

export async function removeJobAlertKeyword(id: string): Promise<Result> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (!id) return { ok: false, error: "id is required." };
  const sb = createServiceRoleClient();
  const { error } = await sb.from("job_alert_keywords").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
