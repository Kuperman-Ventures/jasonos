export type ServiceStatus = "connected" | "not_configured" | "error" | "expired";
export type ConnectionType = "env_var" | "oauth" | "api_key" | "mcp" | "webhook";
export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface ServiceDefinition {
  name: string;
  label: string;
  connectionType: ConnectionType;
  description: string;
  features: string[];
  configurable: boolean;
  disconnectable: boolean;
  envVars?: string[];
  fields?: Array<{
    name: string;
    label: string;
    type?: "password" | "text" | "number";
    placeholder?: string;
    required?: boolean;
  }>;
}

export interface AlertThresholds {
  site_uptime_check_interval_minutes: number;
  email_reply_rate_drop_pct: number;
  email_open_rate_drop_pct: number;
  site_traffic_drop_pct: number;
  trial_to_paid_drop_pct: number;
  deal_stage_aging_days: number;
  pipeline_reply_wait_days: number;
}

export interface ModelPreferences {
  best_next_action: string;
  tell_claude_goal_plan: string;
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  site_uptime_check_interval_minutes: 30,
  email_reply_rate_drop_pct: 20,
  email_open_rate_drop_pct: 15,
  site_traffic_drop_pct: 25,
  trial_to_paid_drop_pct: 10,
  deal_stage_aging_days: 14,
  pipeline_reply_wait_days: 7,
};

export const DEFAULT_MODEL_PREFERENCES: ModelPreferences = {
  best_next_action: "anthropic/claude-opus-4-7",
  tell_claude_goal_plan: "anthropic/claude-sonnet-4-6",
};

export const AVAILABLE_MODELS = [
  "anthropic/claude-opus-4-7",
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-4-6-sonnet",
  "anthropic/claude-haiku-4-5",
];

export const SERVICE_DEFINITIONS: ServiceDefinition[] = [
  {
    name: "supabase",
    label: "Supabase",
    connectionType: "env_var",
    description: "Core database, auth, and operational storage for JasonOS.",
    features: ["Everything", "Auth", "Data"],
    configurable: false,
    disconnectable: false,
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  },
  {
    name: "vercel_ai_gateway",
    label: "Vercel AI Gateway",
    connectionType: "env_var",
    description: "Routes Claude models for Best Next Action, Tell Claude, and Goal to Plan.",
    features: ["Best Next Action", "Tell Claude", "Goal to Plan"],
    configurable: false,
    disconnectable: false,
    envVars: ["AI_GATEWAY_API_KEY"],
  },
  {
    name: "hubspot",
    label: "HubSpot",
    connectionType: "api_key",
    description: "Pipeline sync, contact enrichment, and deal tracking.",
    features: ["Pipeline sync", "Contact enrichment", "Deals"],
    configurable: true,
    disconnectable: true,
    envVars: ["HUBSPOT_ACCESS_TOKEN"],
    fields: [
      { name: "api_key", label: "Private App Access Token", type: "password", required: true },
      { name: "portal_id", label: "Portal ID", placeholder: "Optional" },
    ],
  },
  {
    name: "stripe",
    label: "Stripe",
    connectionType: "api_key",
    description: "Revenue tracking, invoice monitoring, and Advisors/Sprint billing.",
    features: ["Revenue", "Invoices", "Billing"],
    configurable: true,
    disconnectable: true,
    envVars: ["STRIPE_SECRET_KEY"],
    fields: [{ name: "api_key", label: "Secret Key", type: "password", required: true }],
  },
  {
    name: "lemon_squeezy",
    label: "Lemon Squeezy",
    connectionType: "api_key",
    description: "GTMTools.io subscription tracking, MRR, and trial monitoring.",
    features: ["MRR", "Trials", "Subscriptions"],
    configurable: true,
    disconnectable: true,
    envVars: ["LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID"],
    fields: [
      { name: "api_key", label: "API Key", type: "password", required: true },
      { name: "store_id", label: "Store ID", required: true },
    ],
  },
  {
    name: "gmail",
    label: "Gmail",
    connectionType: "mcp",
    description: "Email triage, inbox scanning, and outreach tracking via Cursor MCP.",
    features: ["Email triage", "Replies", "Outreach"],
    configurable: false,
    disconnectable: false,
  },
  {
    name: "google_calendar",
    label: "Google Calendar",
    connectionType: "mcp",
    description: "Meeting prep, relationship velocity, and calendar sync via Cursor MCP.",
    features: ["Meeting prep", "Calendar", "Velocity"],
    configurable: false,
    disconnectable: false,
  },
  {
    name: "encore_os",
    label: "EncoreOS",
    connectionType: "mcp",
    description: "Job-search pipeline sync, recruiter data, and network intelligence.",
    features: ["Job pipeline", "Recruiters", "Network intelligence"],
    configurable: false,
    disconnectable: false,
  },
  {
    name: "instantly",
    label: "Instantly",
    connectionType: "api_key",
    description: "Outbound campaign tracking, sequence status, and deliverability monitoring.",
    features: ["Campaigns", "Sequences", "Deliverability"],
    configurable: true,
    disconnectable: true,
    envVars: ["INSTANTLY_API_KEY"],
    fields: [{ name: "api_key", label: "API Key", type: "password", required: true }],
  },
  {
    name: "taplio",
    label: "Taplio",
    connectionType: "api_key",
    description: "LinkedIn content scheduling and analytics.",
    features: ["LinkedIn", "Scheduling", "Analytics"],
    configurable: true,
    disconnectable: true,
    envVars: ["TAPLIO_API_KEY"],
    fields: [{ name: "api_key", label: "API Key", type: "password", required: true }],
  },
  {
    name: "leaddelta",
    label: "LeadDelta",
    connectionType: "api_key",
    description: "LinkedIn network intelligence and recruiter identification.",
    features: ["Network graph", "Recruiter ID", "231 synced recruiters"],
    configurable: true,
    disconnectable: true,
    envVars: ["LEADDELTA_API_KEY"],
    fields: [{ name: "api_key", label: "API Key", type: "password", required: true }],
  },
  {
    name: "beeper",
    label: "Beeper",
    connectionType: "api_key",
    description:
      "Text/IM sync into Outreach (SMS, iMessage, WhatsApp, etc.). Requires Beeper Desktop open. On Vercel, set BEEPER_DESKTOP_BASE_URL to a Cloudflare/Tailscale tunnel; otherwise Sync soft-skips with “No Beeper data synced”.",
    features: ["Text touches", "Outreach Sync", "1:1 chats"],
    configurable: true,
    disconnectable: true,
    envVars: ["BEEPER_ACCESS_TOKEN"],
    fields: [
      { name: "api_key", label: "Desktop API access token", type: "password", required: true },
      {
        name: "base_url",
        label: "Desktop base URL (tunnel)",
        placeholder: "http://127.0.0.1:23373 or https://….trycloudflare.com",
      },
    ],
  },
  {
    name: "dispatch",
    label: "Dispatch",
    connectionType: "webhook",
    description: "Async coworker advisor for briefings, prospect research, and pipeline analysis.",
    features: ["Morning briefings", "Research", "Pipeline analysis"],
    configurable: true,
    disconnectable: true,
    fields: [
      { name: "enabled", label: "Enabled", placeholder: "true" },
      { name: "polling_interval_minutes", label: "Polling interval minutes", type: "number" },
    ],
  },
];

export function getServiceDefinition(name: string) {
  return SERVICE_DEFINITIONS.find((service) => service.name === name);
}

export function maskSecret(value?: string) {
  if (!value) return undefined;
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function envStatus(service: ServiceDefinition): ServiceStatus {
  if (!service.envVars?.length) return service.connectionType === "mcp" ? "connected" : "not_configured";
  return service.envVars.every((name) => !!process.env[name]) ? "connected" : "not_configured";
}
