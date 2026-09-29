/**
 * app_state reads/writes for Reference › Data Sources: AI model setting, link
 * overrides, and whether a calendar feed token exists. Reads degrade to defaults
 * when migrations 0014/0036 have not been applied.
 */

import { collegeDb, supabaseConfigured } from "./db";
import { normalizeLinkOverrides, withLinkOverride, type LinkOverrides, type OverrideSourceId } from "./link-overrides";

const STATE_ID = "kyle-college";

export type DataSourceSettings = { aiModel: string | null };

function normalizeSettings(value: unknown): DataSourceSettings {
  const row = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const aiModel = typeof row.aiModel === "string" && row.aiModel.trim() ? row.aiModel.trim() : null;
  return { aiModel };
}

async function readStateColumn(column: string): Promise<unknown> {
  if (!supabaseConfigured()) return null;
  try {
    const { data, error } = await collegeDb().from("app_state").select(column).eq("id", STATE_ID).maybeSingle();
    if (error || !data) return null;
    return (data as unknown as Record<string, unknown>)[column] ?? null;
  } catch {
    return null;
  }
}

export async function loadDataSourceSettings(): Promise<DataSourceSettings> {
  return normalizeSettings(await readStateColumn("data_source_settings"));
}

export async function loadLinkOverrides(): Promise<LinkOverrides> {
  return normalizeLinkOverrides(await readStateColumn("link_overrides"));
}

export async function calendarTokenIsSet(): Promise<boolean> {
  if (process.env.COLLEGE_ICAL_TOKEN?.trim()) return true;
  if (!supabaseConfigured()) return true;
  const token = await readStateColumn("calendar_feed_token");
  return typeof token === "string" && token.trim() !== "";
}

async function writeStateColumn(column: string, value: unknown): Promise<void> {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const { error } = await collegeDb()
    .from("app_state")
    .upsert({ id: STATE_ID, [column]: value, updated_at: new Date().toISOString() });
  if (error) {
    if (/column .* does not exist|schema cache/i.test(error.message)) {
      throw new Error(`Run migration 0036_data_source_settings.sql first (${error.message})`);
    }
    throw new Error(error.message);
  }
}

export async function saveAiModelSetting(modelId: string | null): Promise<DataSourceSettings> {
  const raw = await readStateColumn("data_source_settings");
  const current = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const next: Record<string, unknown> = { ...current };
  if (modelId) next.aiModel = modelId;
  else delete next.aiModel;
  await writeStateColumn("data_source_settings", next);
  return normalizeSettings(next);
}

export async function saveLinkOverride(
  sourceId: OverrideSourceId,
  schoolId: string,
  url: string | null,
): Promise<LinkOverrides> {
  const next = withLinkOverride(await loadLinkOverrides(), sourceId, schoolId, url);
  await writeStateColumn("link_overrides", next);
  return next;
}
