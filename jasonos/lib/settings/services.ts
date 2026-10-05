export type ServiceStatus = "connected" | "not_configured" | "error" | "expired";
export type ConnectionType = "env_var" | "oauth" | "api_key" | "mcp" | "webhook";
export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface ServiceDefinition {
  name: string;
  label: string;
  connectionType: ConnectionType;
  /** Short “what you need” line shown under the service name. */
  setup: string;
  /** Domain used for the brand favicon (Google s2). */
  logoDomain?: string;
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
    setup: "Vercel env: project URL + anon key",
    logoDomain: "supabase.com",
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
    setup: "Vercel env: AI_GATEWAY_API_KEY",
    logoDomain: "vercel.com",
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
    setup: "Private App access token (+ optional Portal ID)",
    logoDomain: "hubspot.com",
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
    setup: "Secret key (sk_…)",
    logoDomain: "stripe.com",
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
    setup: "API key + Store ID",
    logoDomain: "lemonsqueezy.com",
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
    connectionType: "oauth",
    setup: "Google sign-in in Mail accounts (not an API key here)",
    logoDomain: "gmail.com",
    description:
      "Sent-mail sync and outreach tracking via Google OAuth. Connect Advisors and Personal Gmail in Mail accounts above. Outlook.com is a separate connect on that same card. If sign-in expired, reconnect there or Sync will skip that mailbox.",
    features: ["Email triage", "Replies", "Outreach"],
    configurable: false,
    disconnectable: false,
  },
  {
    name: "google_calendar",
    label: "Google Calendar",
    connectionType: "oauth",
    setup: "Same Google sign-in as Mail accounts",
    logoDomain: "calendar.google.com",
    description:
      "Meeting prep and calendar sync via Google OAuth. Connect each account in Mail accounts above — sharing a calendar is not enough.",
    features: ["Meeting prep", "Calendar", "Velocity"],
    configurable: false,
    disconnectable: false,
  },
  {
    name: "encore_os",
    label: "EncoreOS",
    connectionType: "mcp",
    setup: "Cursor MCP (managed outside this form)",
    logoDomain: "encore.dev",
    description: "Job-search pipeline sync, recruiter data, and network intelligence.",
    features: ["Job pipeline", "Recruiters", "Network intelligence"],
    configurable: false,
    disconnectable: false,
  },
  {
    name: "instantly",
    label: "Instantly",
    connectionType: "api_key",
    setup: "API key from Instantly → Settings",
    logoDomain: "instantly.ai",
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
    setup: "API key from Taplio",
    logoDomain: "taplio.com",
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
    setup: "API key from LeadDelta → Integrations",
    logoDomain: "leaddelta.com",
    description:
      "LinkedIn CRM for contact photos and network context. Paste the API key from LeadDelta → Integrations. JasonOS does not scrape LinkedIn.",
    features: ["Contact photos", "Profile lookup", "Network CRM"],
    configurable: true,
    disconnectable: true,
    envVars: ["LEADDELTA_API_KEY"],
    fields: [{ name: "api_key", label: "API Key", type: "password", required: true }],
  },
  {
    name: "beeper",
    label: "Beeper",
    connectionType: "api_key",
    setup: "Desktop API token + Tailscale Funnel URL (Desktop must stay open)",
    logoDomain: "beeper.com",
    description:
      "Text/IM sync into Outreach (SMS, iMessage, WhatsApp, etc.). Needs (1) a Desktop API token from Beeper → Settings → Integrations → Approved connections, and (2) a public tunnel to this Mac’s Beeper port — usually Tailscale Funnel on 23373. Paste both below. Sync uses the Settings token first, then BEEPER_ACCESS_TOKEN.",
    features: ["Text touches", "Outreach Sync", "1:1 chats"],
    configurable: true,
    disconnectable: true,
    envVars: ["BEEPER_ACCESS_TOKEN"],
    fields: [
      { name: "api_key", label: "Desktop API access token", type: "password", required: true },
      {
        name: "base_url",
        label: "Desktop base URL (Tailscale Funnel)",
        placeholder: "https://your-mac.tailnet.ts.net",
        required: true,
      },
    ],
  },
  {
    name: "granola",
    label: "Granola",
    connectionType: "api_key",
    setup: "API key (grn_…) from Granola → Settings → Connectors",
    logoDomain: "granola.ai",
    description:
      "Meeting notes for Browning thank-you drafts. In the Granola app: Settings → Connectors → API keys. Include Personal notes, then paste the key here. It starts with grn_. Settings is used first, then GRANOLA_API_KEY.",
    features: ["Meeting notes", "Browning thank-you"],
    configurable: true,
    disconnectable: true,
    envVars: ["GRANOLA_API_KEY"],
    fields: [
      {
        name: "api_key",
        label: "API Key",
        type: "password",
        required: true,
        placeholder: "grn_…",
      },
    ],
  },
  {
    name: "firecrawl",
    label: "Firecrawl",
    connectionType: "api_key",
    setup: "API key (fc_…) from firecrawl.dev",
    logoDomain: "firecrawl.dev",
    description:
      "Web search for company homepage lookup when logging customized resumes as NYUI work searches. Paste the API key here — Settings is used first, then FIRECRAWL_API_KEY on Vercel. Get a key at firecrawl.dev.",
    features: ["Company URLs", "NYUI work search", "Web search"],
    configurable: true,
    disconnectable: true,
    envVars: ["FIRECRAWL_API_KEY"],
    fields: [
      {
        name: "api_key",
        label: "API Key",
        type: "password",
        required: true,
        placeholder: "fc-…",
      },
    ],
  },
  {
    name: "jasonos_mcp",
    label: "Cursor & Claude",
    connectionType: "api_key",
    setup: "Generate a JasonOS password here (not a vendor API key)",
    description:
      "Lets Cursor and Claude see all of JasonOS: today, outreach, inbox, jobs, contacts, projects, briefs. Claude also publishes the morning brief and inbox dispatch through these tools (no separate Supabase connector). Generate a password here and save it. Cursor pastes it. Claude Cowork asks for it in the browser. In Claude, allow every JasonOS tool.",
    features: ["Today", "Action queue", "To-dos", "Contacts", "Brief publish"],
    configurable: true,
    disconnectable: true,
    envVars: ["JASONOS_MCP_TOKEN"],
    fields: [
      {
        name: "api_key",
        label: "Password",
        type: "password",
        required: true,
        placeholder: "Click Generate password",
      },
    ],
  },
  {
    name: "dispatch",
    label: "Dispatch",
    connectionType: "webhook",
    setup: "Enable + polling interval (no external API key)",
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

export function serviceLogoUrl(domain: string, size = 64) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
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
