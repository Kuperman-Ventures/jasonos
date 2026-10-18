"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface LiveSettings {
  targetCompanies: string[];
  snapshot: string | null;
}

type SettingsResult<T> = ({ ok: true } & T) | { ok: false; error: string };

const COMPANY_MAX = 40;
const COMPANY_LENGTH = 80;
const SNAPSHOT_MAX = 2000;

function hasConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function missingTable(message: string): boolean {
  return /live_settings/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

function asCompanies(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim().replace(/\s+/g, " ");
    if (!text) continue;
    out.push(text.length <= COMPANY_LENGTH ? text : text.slice(0, COMPANY_LENGTH).trim());
    if (out.length === COMPANY_MAX) break;
  }
  return out;
}

function asSnapshot(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n/g, "\n").trim();
  if (!text) return null;
  return text.length <= SNAPSHOT_MAX ? text : text.slice(0, SNAPSHOT_MAX).trim();
}

function toSettings(row: { target_companies?: unknown; snapshot?: unknown } | null): LiveSettings {
  return {
    targetCompanies: asCompanies(row?.target_companies),
    snapshot: asSnapshot(row?.snapshot),
  };
}

export async function getLiveSettings(): Promise<SettingsResult<LiveSettings>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("live_settings")
    .select("target_companies, snapshot")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    if (missingTable(error.message)) return { ok: true, targetCompanies: [], snapshot: null };
    return { ok: false, error: error.message };
  }
  return { ok: true, ...toSettings(data) };
}

export async function updateLiveSettings(input: {
  targetCompanies?: string[];
  snapshot?: string | null;
}): Promise<SettingsResult<LiveSettings>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (input.targetCompanies === undefined && input.snapshot === undefined) {
    return { ok: false, error: "Nothing to change." };
  }

  const current = await getLiveSettings();
  if (!current.ok) return current;

  const next: LiveSettings = {
    targetCompanies:
      input.targetCompanies === undefined ? current.targetCompanies : asCompanies(input.targetCompanies),
    snapshot: input.snapshot === undefined ? current.snapshot : asSnapshot(input.snapshot),
  };

  const sb = createServiceRoleClient();
  const { error } = await sb.from("live_settings").upsert(
    {
      id: true,
      target_companies: next.targetCompanies,
      snapshot: next.snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/live");
  return { ok: true, ...next };
}
