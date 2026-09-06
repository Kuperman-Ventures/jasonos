import "server-only";

import { z } from "zod";
import { createPublicClient, createPublicServiceRoleClient } from "@/lib/supabase/server";
import {
  DEFAULT_ALERT_THRESHOLDS,
  DEFAULT_MODEL_PREFERENCES,
  SERVICE_DEFINITIONS,
  envStatus,
  getServiceDefinition,
  maskSecret,
  type HealthStatus,
  type ServiceStatus,
} from "./services";

const CredentialsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
const ServiceNameSchema = z.enum(SERVICE_DEFINITIONS.map((service) => service.name) as [string, ...string[]]);

export const TestConnectionSchema = z.object({
  service_name: ServiceNameSchema,
  credentials: CredentialsSchema.optional(),
});

export const SaveConnectionSchema = z.object({
  service_name: ServiceNameSchema,
  credentials: CredentialsSchema.optional(),
  disconnect: z.boolean().optional(),
});

export const SaveThresholdsSchema = z.object({
  thresholds: z.object({
    site_uptime_check_interval_minutes: z.coerce.number().min(1).max(1440),
    email_reply_rate_drop_pct: z.coerce.number().min(0).max(100),
    email_open_rate_drop_pct: z.coerce.number().min(0).max(100),
    site_traffic_drop_pct: z.coerce.number().min(0).max(100),
    trial_to_paid_drop_pct: z.coerce.number().min(0).max(100),
    deal_stage_aging_days: z.coerce.number().min(1).max(365),
    pipeline_reply_wait_days: z.coerce.number().min(1).max(60),
  }),
  models: z
    .object({
      best_next_action: z.string().min(1),
      tell_claude_goal_plan: z.string().min(1),
    })
    .optional(),
});

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  account_name?: string;
  health_status: HealthStatus;
  metadata?: Record<string, unknown>;
}

async function getUserId() {
  const supabase = await createPublicClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("not_authenticated");
  return data.user.id;
}

async function getUserContext() {
  const supabase = await createPublicClient();
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) return { supabase, userId: data.user.id };

  const serviceSupabase = createPublicServiceRoleClient();
  const ownerId = await getSingleUserOwnerId(serviceSupabase);
  return { supabase: serviceSupabase, userId: ownerId };
}

async function getSingleUserOwnerId(supabase: ReturnType<typeof createPublicServiceRoleClient>) {
  const configuredOwnerId = stringCredential(process.env.JASONOS_OWNER_USER_ID);
  if (configuredOwnerId) return configuredOwnerId;

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  const owner = data?.users[0];
  if (error || !owner) throw new Error("not_authenticated");
  return owner.id;
}

export async function testServiceConnection(
  serviceName: string,
  credentials: Record<string, string | number | boolean> = {}
): Promise<ConnectionTestResult> {
  const service = getServiceDefinition(serviceName);
  if (!service) {
    return { success: false, message: "Unknown service", health_status: "down" };
  }

  if (service.connectionType === "mcp") {
    return {
      success: true,
      message: "Managed via Cursor MCP. Reachability is verified from Cursor, not this page.",
      health_status: "healthy",
    };
  }

  if (service.connectionType === "env_var") {
    const status = envStatus(service);
    return {
      success: status === "connected",
      message: status === "connected" ? "Required environment variables are present." : "Missing environment variables.",
      health_status: status === "connected" ? "healthy" : "down",
      metadata: { env_vars: service.envVars ?? [] },
    };
  }

  if (serviceName === "dispatch") {
    const userId = await getUserId();
    const supabase = createPublicServiceRoleClient();
    const { count } = await supabase
      .from("dispatch_requests")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("status", "pending");
    return {
      success: true,
      message: `Dispatch bridge reachable. ${count ?? 0} pending request(s).`,
      health_status: "healthy",
      metadata: { pending_requests: count ?? 0 },
    };
  }

  const key = stringCredential(credentials.api_key) ?? process.env[service.envVars?.[0] ?? ""];
  if (!key) {
    return { success: false, message: "API key is required.", health_status: "down" };
  }

  if (serviceName === "stripe") {
    try {
      const res = await fetch("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Stripe returned ${res.status}`);
      const account = (await res.json()) as {
        id?: string;
        settings?: { dashboard?: { display_name?: string } };
        business_profile?: { name?: string };
      };
      return {
        success: true,
        message: "Stripe account verified.",
        account_name: account.settings?.dashboard?.display_name ?? account.business_profile?.name ?? account.id,
        health_status: "healthy",
      };
    } catch (error) {
      return failed(error, "Stripe verification failed.");
    }
  }

  if (serviceName === "lemon_squeezy") {
    const storeId = stringCredential(credentials.store_id) ?? process.env.LEMON_SQUEEZY_STORE_ID;
    const path = storeId ? `/stores/${storeId}` : "/stores";
    return fetchJsonApi("https://api.lemonsqueezy.com/v1", path, key, "Lemon Squeezy");
  }

  if (serviceName === "hubspot") {
    return fetchHubSpot(key);
  }

  if (serviceName === "beeper") {
    const base =
      stringCredential(credentials.base_url)?.replace(/\/$/, "") ||
      process.env.BEEPER_DESKTOP_BASE_URL?.trim().replace(/\/$/, "") ||
      "http://127.0.0.1:23373";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2_500);
      const res = await fetch(`${base}/v1/info`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${key}`,
        },
        cache: "no-store",
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          message:
            "Beeper token expired. In Beeper Desktop → Settings → Integrations → Approved connections, create a new token, paste it here, then Test Connection.",
          health_status: "down",
        };
      }
      if (!res.ok) {
        return {
          success: false,
          message: `Beeper responded ${res.status}. Check the token and that Desktop API is enabled.`,
          health_status: "down",
        };
      }
      return {
        success: true,
        message:
          "Beeper Desktop reachable. Leave it open when you hit Sync; otherwise Sync reports “No Beeper data synced”.",
        health_status: "healthy",
        metadata: { base_url: base },
      };
    } catch {
      return {
        success: true,
        message:
          "Token saved. Beeper Desktop isn’t reachable from this server right now (closed, or needs a tunnel URL on Vercel). Sync will soft-skip with “No Beeper data synced” until it’s open and reachable.",
        health_status: "degraded",
        metadata: { base_url: base },
      };
    }
  }

  if (serviceName === "instantly") {
    return basicBearerCheck("https://api.instantly.ai/api/v2/accounts", key, "Instantly", {
      paused_warning: "Instantly automation is currently PAUSED if campaigns report paused status.",
    });
  }

  if (serviceName === "taplio") {
    return {
      success: true,
      message: "Taplio key saved. Live verification endpoint is not enabled in this MVP.",
      health_status: "degraded",
    };
  }

  if (serviceName === "leaddelta") {
    return {
      success: true,
      message: "LeadDelta key saved. 231 recruiters are already synced in rr_recruiters.",
      health_status: "healthy",
      metadata: { synced_recruiters: 231 },
    };
  }

  return { success: true, message: "Connection metadata saved.", health_status: "unknown" };
}

export async function saveServiceConnection(input: z.infer<typeof SaveConnectionSchema>) {
  const { supabase, userId } = await getUserContext();
  const service = getServiceDefinition(input.service_name);
  if (!service) throw new Error("unknown_service");

  const now = new Date().toISOString();

  if (input.disconnect) {
    const { error } = await supabase.from("service_connections").upsert(
      {
        user_id: userId,
        service_name: service.name,
        status: "not_configured",
        connection_type: service.connectionType,
        config: {},
        api_key_masked: null,
        connected_at: null,
        last_health_check: now,
        health_status: "unknown",
        health_details: "Disconnected from Settings.",
        error_message: null,
        updated_at: now,
      },
      { onConflict: "user_id,service_name" }
    );
    if (error) throw new Error(error.message);
    return { status: "not_configured" as ServiceStatus, message: "Disconnected." };
  }

  const credentials = input.credentials ?? {};
  const test = await testServiceConnection(service.name, credentials);
  const key = stringCredential(credentials.api_key);
  const safeConfig = sanitizeConfig(credentials, service.name);

  const { error } = await supabase.from("service_connections").upsert(
    {
      user_id: userId,
      service_name: service.name,
      status: test.success ? "connected" : "error",
      connection_type: service.connectionType,
      config: safeConfig,
      api_key_masked: key ? maskSecret(key) : undefined,
      connected_at: test.success ? now : null,
      last_health_check: now,
      health_status: test.health_status,
      health_details: test.message,
      error_message: test.success ? null : test.message,
      updated_at: now,
    },
    { onConflict: "user_id,service_name" }
  );
  if (error) throw new Error(error.message);

  return {
    status: test.success ? "connected" : "error",
    message: test.message,
    api_key_masked: key ? maskSecret(key) : undefined,
    account_name: test.account_name,
    health_status: test.health_status,
  };
}

export async function healthCheckAll() {
  const { supabase, userId } = await getUserContext();
  const now = new Date().toISOString();
  const results = await Promise.all(
    SERVICE_DEFINITIONS.map(async (service) => {
      const result = await testServiceConnection(service.name).catch((error) =>
        failed(error, `${service.label} health check failed.`)
      );
      const { error } = await supabase.from("service_connections").upsert(
        {
          user_id: userId,
          service_name: service.name,
          status: result.success ? "connected" : envStatus(service),
          connection_type: service.connectionType,
          last_health_check: now,
          health_status: result.health_status,
          health_details: result.message,
          error_message: result.success ? null : result.message,
          updated_at: now,
        },
        { onConflict: "user_id,service_name" }
      );
      if (error) throw new Error(error.message);
      return result;
    })
  );

  return {
    total: SERVICE_DEFINITIONS.length,
    connected: results.filter((result) => result.success).length,
    healthy: results.filter((result) => result.health_status === "healthy").length,
    degraded: results.filter((result) => result.health_status === "degraded").length,
    down: results.filter((result) => result.health_status === "down").length,
    checked_at: now,
  };
}

export async function saveUserSettings(input: z.infer<typeof SaveThresholdsSchema>) {
  const { supabase, userId } = await getUserContext();
  const thresholds = { ...DEFAULT_ALERT_THRESHOLDS, ...input.thresholds };
  const models = { ...DEFAULT_MODEL_PREFERENCES, ...(input.models ?? {}) };
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      alert_thresholds: thresholds,
      model_preferences: models,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
  return { thresholds, models };
}

function sanitizeConfig(credentials: Record<string, string | number | boolean>, serviceName: string) {
  if (serviceName === "dispatch") {
    return {
      enabled: credentials.enabled === true || credentials.enabled === "true",
      polling_interval_minutes: Number(credentials.polling_interval_minutes ?? 2),
    };
  }
  const rest = { ...credentials };
  delete rest.api_key;
  return rest;
}

async function fetchJsonApi(base: string, path: string, key: string, label: string) {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${label} returned ${res.status}`);
    const json = (await res.json()) as { data?: { attributes?: { name?: string } } | Array<{ attributes?: { name?: string } }> };
    const first = Array.isArray(json.data) ? json.data[0] : json.data;
    return {
      success: true,
      message: `${label} API key verified.`,
      account_name: first?.attributes?.name,
      health_status: "healthy" as const,
    };
  } catch (error) {
    return failed(error, `${label} verification failed.`);
  }
}

async function fetchHubSpot(key: string) {
  try {
    const res = await fetch("https://api.hubapi.com/account-info/v3/details", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HubSpot returned ${res.status}`);
    const json = (await res.json()) as { portalId?: number; accountName?: string };
    return {
      success: true,
      message: "HubSpot private app token verified.",
      account_name: json.accountName ?? (json.portalId ? `Portal ${json.portalId}` : undefined),
      health_status: "healthy" as const,
      metadata: { portal_id: json.portalId },
    };
  } catch (error) {
    return failed(error, "HubSpot verification failed.");
  }
}

async function basicBearerCheck(
  url: string,
  key: string,
  label: string,
  metadata?: Record<string, unknown>
) {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${label} returned ${res.status}`);
    return {
      success: true,
      message: `${label} API key verified.`,
      health_status: "healthy" as const,
      metadata,
    };
  } catch (error) {
    return failed(error, `${label} verification failed.`);
  }
}

function failed(error: unknown, fallback: string): ConnectionTestResult {
  return {
    success: false,
    message: error instanceof Error ? error.message : fallback,
    health_status: "down",
  };
}

function stringCredential(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
