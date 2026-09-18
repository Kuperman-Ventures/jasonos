"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  KeyRound,
  Mail,
  PlugZap,
  Radio,
  RefreshCw,
  ShieldCheck,
  Wifi,
  XCircle,
  Copy,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/jasonos/logo";
import {
  AVAILABLE_MODELS,
  SERVICE_DEFINITIONS,
  type AlertThresholds,
  type ModelPreferences,
} from "@/lib/settings/services";
import type { SettingsPayload, ServiceConnection } from "@/lib/settings/data";
import { googleMailboxHealth } from "@/lib/settings/google-status";

const CONNECTION_ICONS = {
  env_var: ShieldCheck,
  mcp: Wifi,
  webhook: Radio,
  api_key: KeyRound,
  oauth: PlugZap,
} as const;

interface BillingPreview {
  stripe: {
    configured: boolean;
    mtd: number;
    prevPeriodMtd: number;
    outstandingInvoices: number;
    currency: string;
  };
  lemonSqueezy: {
    configured: boolean;
    mrr: number;
    thirtyDayRevenue: number;
    thirtyDaySales: number;
    activeSubscribers: number;
    trialingSubscribers: number;
    trialsExpiring48h: number;
    storeName?: string;
  };
}

interface SettingsClientProps {
  initialSettings: SettingsPayload;
  billing: BillingPreview;
}

const THRESHOLD_FIELDS: Array<{
  key: keyof AlertThresholds;
  label: string;
  suffix: string;
  description: string;
}> = [
  {
    key: "site_uptime_check_interval_minutes",
    label: "Site uptime check interval",
    suffix: "minutes",
    description: "How often Product Health should probe monitored endpoints.",
  },
  {
    key: "email_reply_rate_drop_pct",
    label: "Email reply-rate drop",
    suffix: "%",
    description: "Alert when reply rate falls against the trailing baseline.",
  },
  {
    key: "email_open_rate_drop_pct",
    label: "Email open-rate drop",
    suffix: "%",
    description: "Alert when campaign open rates materially decline.",
  },
  {
    key: "site_traffic_drop_pct",
    label: "Site traffic drop",
    suffix: "%",
    description: "Alert when daily product traffic falls sharply.",
  },
  {
    key: "trial_to_paid_drop_pct",
    label: "Trial-to-paid conversion drop",
    suffix: "%",
    description: "Alert when GTMTools conversion softens.",
  },
  {
    key: "deal_stage_aging_days",
    label: "Deal stage aging",
    suffix: "days",
    description: "Flag opportunities stuck in the same stage too long.",
  },
  {
    key: "pipeline_reply_wait_days",
    label: "Pipeline reply wait",
    suffix: "days",
    description: "Flag outreach that needs follow-up after no response.",
  },
];

export function SettingsClient({ initialSettings, billing }: SettingsClientProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [thresholds, setThresholds] = useState(initialSettings.thresholds);
  const [models, setModels] = useState(initialSettings.models);
  const [isChecking, startChecking] = useTransition();
  const [isSavingPrefs, startSavingPrefs] = useTransition();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const connected = searchParams.get("google_gmail_connected") === "1";
    const advisors = searchParams.get("google_connected") === "1";
    const error = searchParams.get("google_error");
    const outlookConnected = searchParams.get("outlook_connected") === "1";
    const outlookError = searchParams.get("outlook_error");
    if (!connected && !advisors && !error && !outlookConnected && !outlookError) return;
    if (connected) {
      toast.success("Personal Gmail connected", {
        description: "Hit Sync in the top bar. Calendar and sent mail on jskuperman@gmail.com will come through.",
      });
    } else if (advisors) {
      toast.success("Advisors Google connected");
    } else if (error) {
      toast.error("Google connect failed", { description: error });
    }
    if (outlookConnected) {
      toast.success("Outlook connected", {
        description:
          "Hit Sync in the top bar. Sent and inbox mail on jason.kuperman@outlook.com will come through.",
      });
    } else if (outlookError) {
      toast.error("Outlook connect failed", { description: outlookError });
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("google_gmail_connected");
    url.searchParams.delete("google_connected");
    url.searchParams.delete("google_error");
    url.searchParams.delete("outlook_connected");
    url.searchParams.delete("outlook_error");
    router.replace(url.pathname + url.search, { scroll: false });
  }, [searchParams, router]);

  const summary = useMemo<{
    total: number;
    connected: number;
    status: "healthy" | "issues" | "critical";
  }>(() => {
    const connected = settings.services.filter((service) => service.status === "connected").length;
    const down = settings.services.filter((service) => service.health_status === "down").length;
    const degraded = settings.services.filter(
      (service) => service.health_status === "degraded" || service.status === "expired"
    ).length;
    return {
      total: settings.services.length,
      connected,
      status: down ? "critical" : degraded ? "issues" : "healthy",
    };
  }, [settings.services]);

  const refreshAll = () => {
    startChecking(async () => {
      const res = await fetch("/api/settings/health-check-all", { method: "POST" });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        summary?: { checked_at: string; connected: number; healthy: number; degraded: number; down: number };
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.summary) {
        toast.error("Health check failed", { description: payload.error ?? "Please try again." });
        return;
      }
      setSettings((current) => ({
        ...current,
        lastChecked: payload.summary?.checked_at ?? new Date().toISOString(),
      }));
      toast.success("Health checks complete", {
        description: `${payload.summary.healthy} healthy, ${payload.summary.degraded} degraded, ${payload.summary.down} down.`,
      });
    });
  };

  const savePreferences = () => {
    startSavingPrefs(async () => {
      const res = await fetch("/api/settings/save-thresholds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thresholds, models }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        thresholds?: AlertThresholds;
        models?: ModelPreferences;
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        toast.error("Settings save failed", { description: payload.error ?? "Please try again." });
        return;
      }
      if (payload.thresholds) setThresholds(payload.thresholds);
      if (payload.models) setModels(payload.models);
      toast.success("Settings saved");
    });
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6">
      <header className="flex items-start gap-3">
        <Logo size={40} className="mt-0.5" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Manage JasonOS integrations, Dispatch, alert thresholds, and model routing from one control panel.
          </p>
        </div>
      </header>

      {settings.authRequired ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-100">
          Sign in to persist Settings changes. Mail account status below is live —
          you can reconnect Gmail or Outlook without signing in first.
        </div>
      ) : null}

      <HealthBar
        connected={summary.connected}
        total={summary.total}
        status={summary.status}
        lastChecked={settings.lastChecked}
        isChecking={isChecking}
        onCheckAll={refreshAll}
      />

      <MailAccountsCard
        accounts={settings.googleAccounts}
        outlook={settings.outlookAccount}
      />

      <LiveDataPreview billing={billing} onRefresh={() => window.location.reload()} />

      <section className="space-y-3">
        <SectionHeading
          title="Connected Services"
          description="Configure, test, and disconnect user-actionable integrations."
        />
        <div className="grid gap-3 lg:grid-cols-2">
          {settings.services.map((connection) => (
            <ServiceCard
              key={connection.service_name}
              connection={connection}
              dispatchSummary={settings.dispatch}
              onChange={(next) =>
                setSettings((current) => ({
                  ...current,
                  services: current.services.map((service) =>
                    service.service_name === next.service_name ? next : service
                  ),
                }))
              }
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Alert Thresholds</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Tune the alert triggers that drive Product Health and daily triage.
            </p>
          </div>
          <Button size="sm" onClick={savePreferences} disabled={isSavingPrefs}>
            {isSavingPrefs ? "Saving..." : "Save thresholds"}
          </Button>
        </header>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {THRESHOLD_FIELDS.map((field) => (
            <label key={field.key} className="rounded-lg border bg-background/40 p-3">
              <span className="text-sm font-medium">{field.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{field.description}</span>
              <div className="mt-3 flex items-center gap-2">
                <Input
                  type="number"
                  value={thresholds[field.key]}
                  onChange={(event) =>
                    setThresholds((current) => ({
                      ...current,
                      [field.key]: Number(event.target.value),
                    }))
                  }
                />
                <span className="w-16 text-xs text-muted-foreground">{field.suffix}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Models</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Model choices are saved to preferences for the next routing pass.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={savePreferences} disabled={isSavingPrefs}>
            Save models
          </Button>
        </header>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          <ModelSelect
            label="Best Next Action"
            value={models.best_next_action}
            onChange={(value) => setModels((current) => ({ ...current, best_next_action: value }))}
          />
          <ModelSelect
            label="Tell Claude / Goal to Plan"
            value={models.tell_claude_goal_plan}
            onChange={(value) => setModels((current) => ({ ...current, tell_claude_goal_plan: value }))}
          />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <SectionHeading
          title="Data & Account"
          description="Export and data-clearing controls will live here once account flows are enabled."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" disabled>Export all data</Button>
          <Button variant="destructive" disabled>Clear account data</Button>
        </div>
      </section>
    </div>
  );
}

function MailAccountsCard({
  accounts,
  outlook,
}: {
  accounts: SettingsPayload["googleAccounts"];
  outlook: SettingsPayload["outlookAccount"];
}) {
  const advisorsHealth = googleMailboxHealth({
    connected: accounts.advisorsConnected,
    needsReconnect: accounts.advisorsNeedsReconnect,
  });
  const gmailHealth = googleMailboxHealth({
    connected: accounts.gmailConnected,
    needsReconnect: accounts.gmailNeedsReconnect,
  });
  const outlookHealth = googleMailboxHealth({
    connected: outlook.connected,
    needsReconnect: outlook.needsReconnect,
  });
  const expiredLabels = [
    advisorsHealth === "expired" ? "Advisors Google" : null,
    gmailHealth === "expired" ? "Personal Gmail" : null,
    outlookHealth === "expired" ? "Outlook" : null,
  ].filter((label): label is string => Boolean(label));
  const missingLabels = [
    advisorsHealth === "not_connected" ? "Advisors Google" : null,
    gmailHealth === "not_connected" ? "Personal Gmail" : null,
    outlookHealth === "not_connected" ? "Outlook" : null,
  ].filter((label): label is string => Boolean(label));
  const connectedCount = [advisorsHealth, gmailHealth, outlookHealth].filter(
    (health) => health === "connected"
  ).length;
  const expiredEmails = [
    gmailHealth === "expired" ? "jskuperman@gmail.com" : null,
    advisorsHealth === "expired" ? "jason@kupermanadvisors.com" : null,
    outlookHealth === "expired" ? "jason.kuperman@outlook.com" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <section id="google-accounts" className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg border bg-background/60">
          <Mail className="h-4 w-4 text-sky-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight">Mail accounts</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sync reads mail from each connected account. Advisors and Personal Gmail
            are separate Google logins — sharing a calendar is not enough. Outlook.com
            uses Microsoft and is separate from those Gmail forwards. Status below is
            live, including when Settings is in preview.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {connectedCount} of 3 connected
            {expiredLabels.length ? ` · ${expiredLabels.length} sign-in expired` : ""}
            {missingLabels.length ? ` · ${missingLabels.length} not connected` : ""}
          </p>
        </div>
      </div>

      {expiredLabels.length ? (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                {expiredLabels.join(" and ")} sign-in expired
              </p>
              <p className="mt-1 text-xs text-amber-100/80">
                Sync cannot read {expiredEmails.join(" or ")} until you reconnect below.
              </p>
            </div>
          </div>
        </div>
      ) : advisorsHealth === "not_connected" && gmailHealth === "not_connected" ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-100">
          Neither Google account is connected. Sync cannot read Gmail or Google
          Calendar until you connect them below.
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <MailAccountRow
          id="advisors-google"
          label="Advisors"
          email="jason@kupermanadvisors.com"
          connected={accounts.advisorsConnected}
          needsReconnect={accounts.advisorsNeedsReconnect}
          connectedEmail={accounts.advisorsEmail}
          error={accounts.advisorsError}
          href="/api/auth/google"
          connectLabel="Connect Advisors Google"
          reconnectLabel="Reconnect Advisors Google"
        />
        <MailAccountRow
          id="personal-gmail"
          label="Personal Gmail"
          email="jskuperman@gmail.com"
          connected={accounts.gmailConnected}
          needsReconnect={accounts.gmailNeedsReconnect}
          connectedEmail={accounts.gmailEmail}
          error={accounts.gmailError}
          href="/api/auth/google?account=gmail"
          connectLabel="Connect personal Gmail"
          reconnectLabel="Reconnect personal Gmail"
        />
        <MailAccountRow
          id="outlook"
          label="Outlook"
          email="jason.kuperman@outlook.com"
          connected={outlook.connected}
          needsReconnect={outlook.needsReconnect}
          connectedEmail={outlook.email}
          error={outlook.error}
          href="/api/auth/microsoft"
          connectLabel="Connect Outlook"
          reconnectLabel="Reconnect Outlook"
          connectDisabled={!outlook.oauthConfigured && !outlook.connected}
          connectedDetail="Sign-in is valid. Sync can read sent, inbox, and other folders on this account."
          missingDetail={
            outlook.oauthConfigured
              ? "Not connected. Sync skips Outlook until you connect this mailbox."
              : "Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET on Vercel, then connect this mailbox."
          }
        />
      </div>
    </section>
  );
}

function MailAccountRow({
  id,
  label,
  email,
  connected,
  needsReconnect,
  connectedEmail,
  error,
  href,
  connectLabel,
  reconnectLabel,
  connectDisabled = false,
  connectedDetail = "Sign-in is valid. Sync can read sent mail and calendar on this account.",
  missingDetail = "Not connected. Sync cannot read this mailbox or calendar.",
}: {
  id: string;
  label: string;
  email: string;
  connected: boolean;
  needsReconnect?: boolean;
  connectedEmail: string | null;
  error?: string | null;
  href: string;
  connectLabel: string;
  reconnectLabel: string;
  connectDisabled?: boolean;
  connectedDetail?: string;
  missingDetail?: string;
}) {
  const health = googleMailboxHealth({
    connected,
    needsReconnect: Boolean(needsReconnect),
  });

  return (
    <div
      id={id}
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-background/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
        health === "expired" && "border-amber-500/50 bg-amber-500/10",
        health === "not_connected" && "border-border",
        health === "connected" && "border-emerald-500/20"
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium">{label}</div>
          {health === "expired" ? (
            <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-200">
              sign-in expired
            </Badge>
          ) : health === "connected" ? (
            <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/10 text-emerald-200">
              connected
            </Badge>
          ) : (
            <Badge variant="outline" className="border-border text-muted-foreground">
              not connected
            </Badge>
          )}
        </div>
        <div className="mt-1 truncate text-xs text-foreground/80">
          {connectedEmail ?? email}
        </div>
        <p className={cn("mt-1 text-xs", health === "expired" ? "text-amber-100" : "text-muted-foreground")}>
          {health === "expired"
            ? error ??
              "Sign-in expired. Mail on this account will not sync until you reconnect."
            : health === "connected"
              ? connectedDetail
              : missingDetail}
        </p>
      </div>
      {health === "not_connected" && connectDisabled ? (
        <span className="shrink-0 text-center text-[11px] font-medium text-muted-foreground">
          Needs Azure app
        </span>
      ) : (
        <a
          href={href}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-center text-[11px] font-medium",
            health === "expired"
              ? "bg-amber-300 text-black hover:bg-amber-200"
              : health === "connected"
                ? "text-muted-foreground hover:text-foreground hover:underline"
                : "border hover:bg-muted"
          )}
        >
          {health === "not_connected" ? connectLabel : health === "expired" ? reconnectLabel : "Reconnect"}
        </a>
      )}
    </div>
  );
}

function HealthBar({
  connected,
  total,
  status,
  lastChecked,
  isChecking,
  onCheckAll,
}: {
  connected: number;
  total: number;
  status: "healthy" | "issues" | "critical";
  lastChecked: string | null;
  isChecking: boolean;
  onCheckAll: () => void;
}) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid h-10 w-10 place-items-center rounded-full border",
              status === "healthy" && "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
              status === "issues" && "border-amber-400/40 bg-amber-400/10 text-amber-300",
              status === "critical" && "border-red-400/40 bg-red-400/10 text-red-300"
            )}
          >
            {status === "critical" ? <XCircle /> : status === "issues" ? <AlertTriangle /> : <CheckCircle2 />}
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">
              {connected} of {total} services connected
            </div>
            <div className="text-xs text-muted-foreground">
              Overall health: {status} · Last checked{" "}
              {lastChecked ? formatDistanceToNow(new Date(lastChecked), { addSuffix: true }) : "not yet"}
            </div>
          </div>
        </div>
        <Button onClick={onCheckAll} disabled={isChecking} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", isChecking && "animate-spin")} />
          {isChecking ? "Checking..." : "Check All"}
        </Button>
      </div>
    </section>
  );
}

function LiveDataPreview({ billing, onRefresh }: { billing: BillingPreview; onRefresh: () => void }) {
  return (
    <section className="space-y-3">
      <SectionHeading
        title="Live Data Preview"
        description="Billing data cards remain visible here, with expandable details and refresh controls."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <details className="group rounded-xl border bg-card p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4 text-sky-300" />
                Stripe Revenue
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {billing.stripe.configured ? fmtUsd(billing.stripe.mtd) : "Not configured"} MTD
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <Separator className="my-3" />
          <MetricRows
            rows={[
              ["Previous period MTD", fmtUsd(billing.stripe.prevPeriodMtd)],
              ["Outstanding invoices", fmtUsd(billing.stripe.outstandingInvoices)],
              ["Currency", billing.stripe.currency.toUpperCase()],
            ]}
          />
          <Button size="sm" variant="outline" className="mt-3" onClick={onRefresh}>
            Refresh
          </Button>
        </details>

        <details className="group rounded-xl border bg-card p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4 text-emerald-300" />
                Lemon Squeezy
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {billing.lemonSqueezy.configured ? fmtUsd(billing.lemonSqueezy.mrr) : "Not configured"} MRR
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <Separator className="my-3" />
          <MetricRows
            rows={[
              ["Store", billing.lemonSqueezy.storeName ?? "gtmtools.io"],
              ["30-day revenue", fmtUsd(billing.lemonSqueezy.thirtyDayRevenue)],
              ["30-day sales", String(billing.lemonSqueezy.thirtyDaySales)],
              ["Active / trialing", `${billing.lemonSqueezy.activeSubscribers} / ${billing.lemonSqueezy.trialingSubscribers}`],
              ["Trials expiring 48h", String(billing.lemonSqueezy.trialsExpiring48h)],
            ]}
          />
          <Button size="sm" variant="outline" className="mt-3" onClick={onRefresh}>
            Refresh
          </Button>
        </details>
      </div>
    </section>
  );
}

function ServiceCard({
  connection,
  dispatchSummary,
  onChange,
}: {
  connection: ServiceConnection;
  dispatchSummary: SettingsPayload["dispatch"];
  onChange: (connection: ServiceConnection) => void;
}) {
  const definition = SERVICE_DEFINITIONS.find((service) => service.name === connection.service_name)!;
  const [expanded, setExpanded] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>(() => {
    if (connection.service_name === "dispatch") {
      return {
        enabled: String(connection.config.enabled ?? true),
        polling_interval_minutes: String(connection.config.polling_interval_minutes ?? 2),
      };
    }
    return {} as Record<string, string>;
  });
  const [isPending, startTransition] = useTransition();
  const [mcpPassword, setMcpPassword] = useState("");
  const Icon = CONNECTION_ICONS[definition.connectionType];

  const test = () => {
    startTransition(async () => {
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_name: definition.name, credentials }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        health_status?: ServiceConnection["health_status"];
      };
      toast[payload.success ? "success" : "error"](payload.message ?? "Connection test complete");
      if (payload.health_status) {
        onChange({
          ...connection,
          health_status: payload.health_status,
          health_details: payload.message ?? null,
          last_health_check: new Date().toISOString(),
        });
      }
    });
  };

  const save = (disconnect = false) => {
    startTransition(async () => {
      const res = await fetch("/api/settings/save-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_name: definition.name, credentials, disconnect }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: ServiceConnection["status"];
        message?: string;
        api_key_masked?: string;
        health_status?: ServiceConnection["health_status"];
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        toast.error("Connection save failed", { description: payload.error ?? "Please try again." });
        return;
      }
      const now = new Date().toISOString();
      onChange({
        ...connection,
        status: payload.status ?? connection.status,
        api_key_masked: payload.api_key_masked ?? (disconnect ? null : connection.api_key_masked),
        connected_at: payload.status === "connected" ? now : null,
        last_health_check: now,
        health_status: payload.health_status ?? connection.health_status,
        health_details: payload.message ?? null,
        error_message: payload.status === "error" ? payload.message ?? null : null,
        config: definition.name === "dispatch" ? credentials : connection.config,
      });
      setExpanded(false);
      toast.success(payload.message ?? "Connection saved");
    });
  };

  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-background/60">
            <Icon className="h-4 w-4 text-violet-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight">{definition.label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Connection type: {labelConnectionType(definition.connectionType)}
            </p>
          </div>
        </div>
        <StatusBadge status={connection.status} />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-foreground/85">{definition.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {definition.features.map((feature) => (
          <Badge key={feature} variant="outline" className="text-[10px] text-muted-foreground">
            {feature}
          </Badge>
        ))}
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Last checked:{" "}
        {connection.last_health_check
          ? formatDistanceToNow(new Date(connection.last_health_check), { addSuffix: true })
          : "not yet"}
        {connection.api_key_masked ? ` · Key ${connection.api_key_masked}` : ""}
      </div>

      {connection.error_message ||
      (connection.health_status &&
        connection.health_status !== "healthy" &&
        connection.health_details) ? (
        <p
          className={cn(
            "mt-2 text-xs",
            connection.status === "expired" || connection.health_status === "down"
              ? "text-amber-200"
              : "text-muted-foreground"
          )}
        >
          {connection.error_message ?? connection.health_details}
        </p>
      ) : null}

      {definition.name === "gmail" || definition.name === "google_calendar" ? (
        connection.status === "expired" || connection.status === "not_configured" ? (
          <a
            href="#google-accounts"
            className="mt-2 inline-block text-xs font-medium text-amber-200 hover:underline"
          >
            Fix this in Mail accounts
          </a>
        ) : null
      ) : null}

      {definition.connectionType === "mcp" ? (
        <p className="mt-2 text-xs text-muted-foreground">Managed via Cursor MCP.</p>
      ) : null}

      {definition.name === "jasonos_mcp" ? (
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
          <li>Click Configure, then Generate password, then Copy password, then Save.</li>
          <li>Cursor: Settings → MCP, add jasonos, paste that password where the guide says YOUR_PASSWORD.</li>
          <li>
            Claude Cowork: Settings → Connectors → Add custom connector. Name it JasonOS. URL:{" "}
            https://jasonos.vercel.app/api/mcp. When the browser asks, paste the same password.
          </li>
          <li>Start a new chat and ask: What is on my plate in JasonOS today?</li>
        </ol>
      ) : null}

      {definition.name === "dispatch" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {dispatchSummary.pendingCount} pending · last completed{" "}
          {dispatchSummary.lastCompletedAt
            ? formatDistanceToNow(new Date(dispatchSummary.lastCompletedAt), { addSuffix: true })
            : "never"}
        </p>
      ) : null}

      {expanded ? (
        <div className="mt-4 rounded-lg border bg-background/40 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {(definition.fields ?? []).map((field) => (
              field.name === "polling_interval_minutes" ? (
                <label key={field.name} className="text-xs">
                  <span className="mb-1 block text-muted-foreground">{field.label}</span>
                  <Select
                    value={credentials[field.name] ?? "2"}
                    onValueChange={(value) => {
                      if (value) setCredentials((current) => ({ ...current, [field.name]: value }));
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["1", "2", "3", "5"].map((value) => (
                        <SelectItem key={value} value={value}>{value} min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              ) : field.name === "enabled" ? (
                <label key={field.name} className="text-xs">
                  <span className="mb-1 block text-muted-foreground">{field.label}</span>
                  <Select
                    value={credentials[field.name] ?? "true"}
                    onValueChange={(value) => {
                      if (value) setCredentials((current) => ({ ...current, [field.name]: value }));
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Enabled</SelectItem>
                      <SelectItem value="false">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              ) : (
                <label key={field.name} className="text-xs">
                  <span className="mb-1 block text-muted-foreground">{field.label}</span>
                  <Input
                    type={field.type ?? "text"}
                    value={credentials[field.name] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setCredentials((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  />
                  {definition.name === "jasonos_mcp" && field.name === "api_key" ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const bytes = new Uint8Array(32);
                          crypto.getRandomValues(bytes);
                          const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
                          setCredentials((current) => ({ ...current, api_key: token }));
                          setMcpPassword(token);
                          toast.message("Password created. Copy it, then click Save.");
                        }}
                      >
                        Generate password
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!mcpPassword}
                        onClick={async () => {
                          await navigator.clipboard.writeText(mcpPassword);
                          toast.success("Password copied. Cursor pastes it. Claude asks for it in the browser.");
                        }}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copy password
                      </Button>
                    </div>
                  ) : null}
                  {definition.name === "jasonos_mcp" && mcpPassword ? (
                    <p className="mt-2 break-all rounded-md border bg-background px-2 py-1 font-mono text-[11px] text-foreground">
                      {mcpPassword}
                    </p>
                  ) : null}
                </label>
              )
            ))}
          </div>
          {definition.name === "jasonos_mcp" ? (
            <p className="mt-3 text-xs text-muted-foreground">
              After Save, paste this password into Cursor MCP, or into the Claude
              login page when Cowork asks.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => save(false)} disabled={isPending}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={test} disabled={isPending}>
              Test Connection
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {definition.configurable ? (
          <Button size="sm" variant="outline" onClick={() => setExpanded((value) => !value)}>
            Configure
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={test} disabled={isPending}>
          Test Connection
        </Button>
        {definition.disconnectable && connection.status === "connected" ? (
          <Button size="sm" variant="destructive" onClick={() => save(true)} disabled={isPending}>
            Disconnect
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function ModelSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-lg border bg-background/40 p-3">
      <span className="text-sm font-medium">{label}</span>
      <Select value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger className="mt-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_MODELS.map((model) => (
            <SelectItem key={model} value={model}>
              {model}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function MetricRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="space-y-2 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusBadge({ status }: { status: ServiceConnection["status"] }) {
  const classes = {
    connected: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    not_configured: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    error: "border-red-400/40 bg-red-400/10 text-red-200",
    expired: "border-orange-400/40 bg-orange-400/10 text-orange-200",
  }[status];
  return (
    <Badge variant="outline" className={classes}>
      {status.replace("_", " ")}
    </Badge>
  );
}

function labelConnectionType(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}
