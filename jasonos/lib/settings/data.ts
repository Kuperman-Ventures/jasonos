import "server-only";

import { createPublicClient, createPublicServiceRoleClient } from "@/lib/supabase/server";
import { getGoogleConnectionStatus, type GoogleConnectionStatus } from "@/lib/integrations/google-tokens";
import {
  DEFAULT_ALERT_THRESHOLDS,
  DEFAULT_MODEL_PREFERENCES,
  SERVICE_DEFINITIONS,
  envStatus,
  type AlertThresholds,
  type HealthStatus,
  type ModelPreferences,
  type ServiceStatus,
} from "./services";

export interface ServiceConnection {
  id?: string;
  service_name: string;
  status: ServiceStatus;
  connection_type: string;
  config: Record<string, unknown>;
  api_key_masked: string | null;
  connected_at: string | null;
  last_health_check: string | null;
  health_status: HealthStatus | null;
  health_details: string | null;
  error_message: string | null;
}

export interface SettingsPayload {
  services: ServiceConnection[];
  thresholds: AlertThresholds;
  models: ModelPreferences;
  lastChecked: string | null;
  authRequired: boolean;
  supabaseConfigured: boolean;
  dispatch: {
    pendingCount: number;
    lastCompletedAt: string | null;
  };
  googleAccounts: GoogleConnectionStatus;
}

function publicSupabaseConfigured() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function normalizeThresholds(value: unknown): AlertThresholds {
  return { ...DEFAULT_ALERT_THRESHOLDS, ...(isRecord(value) ? value : {}) };
}

function normalizeModels(value: unknown): ModelPreferences {
  return { ...DEFAULT_MODEL_PREFERENCES, ...(isRecord(value) ? value : {}) };
}

export async function getSettingsPayload(): Promise<SettingsPayload> {
  const configured = publicSupabaseConfigured();

  if (!configured) {
    return fallbackPayload(false);
  }

  const supabase = await createPublicClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return fallbackPayload(true);
  }

  await seedConnections(user.id);

  const [{ data: connectionRows }, { data: prefs }, dispatch, googleAccounts] = await Promise.all([
    supabase
      .from("service_connections")
      .select(
        "id,service_name,status,connection_type,config,api_key_masked,connected_at,last_health_check,health_status,health_details,error_message"
      )
      .eq("user_id", user.id),
    supabase
      .from("user_preferences")
      .select("alert_thresholds,model_preferences")
      .eq("user_id", user.id)
      .maybeSingle(),
    getDispatchSummary(user.id),
    getGoogleConnectionStatus(),
  ]);

  const rowsByName = new Map(
    ((connectionRows ?? []) as ServiceConnection[]).map((row) => [row.service_name, row])
  );

  const services = SERVICE_DEFINITIONS.map((definition) => {
    const row = rowsByName.get(definition.name);
    const inferredStatus = envStatus(definition);
    return {
      id: row?.id,
      service_name: definition.name,
      status: row?.status ?? inferredStatus,
      connection_type: row?.connection_type ?? definition.connectionType,
      config: row?.config ?? {},
      api_key_masked: row?.api_key_masked ?? null,
      connected_at: row?.connected_at ?? null,
      last_health_check: row?.last_health_check ?? null,
      health_status: row?.health_status ?? (inferredStatus === "connected" ? "healthy" : "unknown"),
      health_details: row?.health_details ?? null,
      error_message: row?.error_message ?? null,
    } satisfies ServiceConnection;
  });

  return {
    services,
    thresholds: normalizeThresholds((prefs as PreferencesRow | null)?.alert_thresholds),
    models: normalizeModels((prefs as PreferencesRow | null)?.model_preferences),
    lastChecked: services
      .map((service) => service.last_health_check)
      .filter((value): value is string => !!value)
      .sort()
      .at(-1) ?? null,
    authRequired: false,
    supabaseConfigured: true,
    dispatch,
    googleAccounts,
  };
}

interface PreferencesRow {
  alert_thresholds: unknown;
  model_preferences: unknown;
}

async function seedConnections(userId: string) {
  try {
    const supabase = createPublicServiceRoleClient();
    const rows = SERVICE_DEFINITIONS.map((service) => ({
      user_id: userId,
      service_name: service.name,
      status: envStatus(service),
      connection_type: service.connectionType,
      health_status: envStatus(service) === "connected" ? "healthy" : "unknown",
      config: service.name === "dispatch" ? { enabled: true, polling_interval_minutes: 2 } : {},
      connected_at: envStatus(service) === "connected" ? new Date().toISOString() : null,
    }));
    await supabase.from("service_connections").upsert(rows, {
      onConflict: "user_id,service_name",
      ignoreDuplicates: true,
    });
  } catch (error) {
    console.error("[settings] seed connections failed:", error);
  }
}

async function getDispatchSummary(userId: string) {
  try {
    const supabase = createPublicServiceRoleClient();
    const [{ count }, { data }] = await Promise.all([
      supabase
        .from("dispatch_requests")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("status", "pending"),
      supabase
        .from("dispatch_requests")
        .select("completed_at")
        .eq("owner_id", userId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      pendingCount: count ?? 0,
      lastCompletedAt: data?.completed_at ?? null,
    };
  } catch {
    return { pendingCount: 0, lastCompletedAt: null };
  }
}

function fallbackPayload(authRequired: boolean): SettingsPayload {
  const services = SERVICE_DEFINITIONS.map((definition) => {
    const status = envStatus(definition);
    return {
      service_name: definition.name,
      status,
      connection_type: definition.connectionType,
      config: definition.name === "dispatch" ? { enabled: true, polling_interval_minutes: 2 } : {},
      api_key_masked: null,
      connected_at: status === "connected" ? new Date().toISOString() : null,
      last_health_check: null,
      health_status: status === "connected" ? "healthy" : "unknown",
      health_details: authRequired ? "Sign in to persist settings." : "Supabase auth is not configured.",
      error_message: null,
    } satisfies ServiceConnection;
  });

  return {
    services,
    thresholds: DEFAULT_ALERT_THRESHOLDS,
    models: DEFAULT_MODEL_PREFERENCES,
    lastChecked: null,
    authRequired,
    supabaseConfigured: publicSupabaseConfigured(),
    dispatch: { pendingCount: 0, lastCompletedAt: null },
    googleAccounts: {
      advisorsConnected: false,
      gmailConnected: false,
      advisorsNeedsReconnect: false,
      gmailNeedsReconnect: false,
      advisorsEmail: null,
      gmailEmail: null,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
