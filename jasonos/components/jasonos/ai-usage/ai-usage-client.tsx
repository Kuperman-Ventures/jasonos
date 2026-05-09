"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Edit3,
  ExternalLink,
  HelpCircle,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { updateAiSubscription } from "@/lib/server-actions/ai-usage";
import type { SubscriptionKey } from "@/lib/ai-usage/subscriptions";
import {
  subscriptionStatus,
  type AiUsagePayload,
  type ApiServiceData,
  type ServiceStatus,
  type SubscriptionConfig,
  type SubscriptionServiceData,
  type VercelGatewayData,
} from "@/lib/ai-usage/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${fmt(n / 1_000_000, 1)}M`;
  if (n >= 1_000) return `${fmt(n / 1_000, 1)}K`;
  return String(n);
}

function fmtUsd(n: number) {
  return `$${fmt(n, n < 0.01 ? 4 : n < 1 ? 3 : 2)}`;
}

function statusColor(s: ServiceStatus) {
  switch (s) {
    case "ok":           return "text-emerald-400";
    case "warning":      return "text-amber-400";
    case "critical":     return "text-red-400";
    case "error":        return "text-red-500";
    case "unconfigured": return "text-muted-foreground";
  }
}

function statusBg(s: ServiceStatus) {
  switch (s) {
    case "ok":           return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "warning":      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "critical":     return "bg-red-500/10 text-red-400 border-red-500/20";
    case "error":        return "bg-red-500/10 text-red-500 border-red-500/20";
    case "unconfigured": return "bg-muted/60 text-muted-foreground border-border";
  }
}

function statusIcon(s: ServiceStatus) {
  switch (s) {
    case "ok":           return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "warning":      return <AlertTriangle className="h-3.5 w-3.5" />;
    case "critical":     return <AlertCircle className="h-3.5 w-3.5" />;
    case "error":        return <AlertCircle className="h-3.5 w-3.5" />;
    case "unconfigured": return <HelpCircle className="h-3.5 w-3.5" />;
  }
}

function apiStatus(d: ApiServiceData, budget?: number): ServiceStatus {
  if (!d.configured) return "unconfigured";
  if (d.error) return "error";
  if (!budget) return "ok";
  const pct = d.totalCostUsd / budget;
  if (pct >= 0.9) return "critical";
  if (pct >= 0.7) return "warning";
  return "ok";
}

function progressBarColor(pct: number) {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </h2>
  );
}

function StatCell({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── Model Breakdown Table ────────────────────────────────────────────────────

function ModelTable({ data }: { data: ApiServiceData }) {
  const [expanded, setExpanded] = useState(false);
  const rows = data.byModel.sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
  const visible = expanded ? rows : rows.slice(0, 4);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-border/60 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Model</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Input</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Output</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Est. Cost</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((m) => (
            <tr key={m.model} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2 font-mono text-[11px] text-foreground/80 max-w-[180px] truncate">
                {m.model}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {fmtTokens(m.inputTokens)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {fmtTokens(m.outputTokens)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">
                {fmtUsd(m.estimatedCostUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 4 && (
        <button
          className="flex w-full items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? (
            <>Show less <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>Show {rows.length - 4} more <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}
    </div>
  );
}

// ─── API Service Card ─────────────────────────────────────────────────────────

function ApiServiceCard({
  name,
  icon,
  docHref,
  data,
  budget,
  envKeyHint,
}: {
  name: string;
  icon: React.ReactNode;
  docHref: string;
  data: ApiServiceData;
  budget?: number;
  envKeyHint: string;
}) {
  const status = apiStatus(data, budget);
  const periodLabel = data.configured
    ? `${format(new Date(data.periodStart + "T00:00:00"), "MMM d")} – ${format(new Date(data.periodEnd + "T00:00:00"), "MMM d, yyyy")}`
    : "";
  const budgetPct = budget ? Math.min(100, (data.totalCostUsd / budget) * 100) : null;

  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-3 transition-colors",
      status === "critical" ? "border-red-500/30 bg-red-500/5"
        : status === "warning" ? "border-amber-500/30 bg-amber-500/5"
        : "border-border bg-card/40"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-muted-foreground">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{name}</span>
              <a
                href={docHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {periodLabel && (
              <span className="text-[11px] text-muted-foreground">{periodLabel}</span>
            )}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            statusBg(status)
          )}
        >
          {statusIcon(status)}
          {status === "unconfigured" ? "Not configured"
            : status === "error" ? "Error"
            : status === "critical" ? "Critical"
            : status === "warning" ? "Warning"
            : "OK"}
        </span>
      </div>

      {/* Not configured hint */}
      {!data.configured && (
        <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
          Set <code className="font-mono text-[11px] bg-muted rounded px-1">{envKeyHint}</code> to
          enable live usage tracking.
        </p>
      )}

      {/* Error state */}
      {data.configured && data.error && (
        <p className="text-xs text-red-400/80 rounded-lg bg-red-500/10 px-3 py-2">
          {data.error}
        </p>
      )}

      {/* Stats row */}
      {data.configured && !data.error && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCell
              label="Est. cost MTD"
              value={<span className={statusColor(status)}>{fmtUsd(data.totalCostUsd)}</span>}
              sub={budget ? `of ${fmtUsd(budget)} budget` : undefined}
            />
            <StatCell
              label="Input tokens"
              value={fmtTokens(data.totalInputTokens)}
            />
            <StatCell
              label="Output tokens"
              value={fmtTokens(data.totalOutputTokens)}
            />
            {data.creditBalanceUsd != null ? (
              <StatCell
                label="Credit balance"
                value={
                  <span className={data.creditBalanceUsd < 5 ? "text-red-400" : data.creditBalanceUsd < 20 ? "text-amber-400" : "text-foreground"}>
                    {fmtUsd(data.creditBalanceUsd)}
                  </span>
                }
              />
            ) : (
              <StatCell
                label="Models used"
                value={data.byModel.length}
              />
            )}
          </div>

          {/* Budget progress bar */}
          {budgetPct !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Budget used</span>
                <span className={statusColor(status)}>{Math.round(budgetPct)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", progressBarColor(budgetPct))}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Model breakdown */}
          <ModelTable data={data} />

          <p className="text-[11px] text-muted-foreground/60 text-right">
            Refreshed {formatDistanceToNow(new Date(data.lastFetchedAt), { addSuffix: true })}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Vercel Gateway Card ──────────────────────────────────────────────────────

function VercelGatewayCard({ data }: { data: VercelGatewayData }) {
  const status: ServiceStatus = !data.configured ? "unconfigured" : data.error ? "error" : "ok";

  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-3 transition-colors",
      "border-border bg-card/40"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Vercel AI Gateway</span>
              <a
                href="https://vercel.com/dashboard/ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <span className="text-[11px] text-muted-foreground">Routes all JasonOS AI calls</span>
          </div>
        </div>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
          statusBg(status)
        )}>
          {statusIcon(status)}
          {status === "unconfigured" ? "Not configured" : status === "error" ? "Error" : "Active"}
        </span>
      </div>

      {!data.configured && (
        <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
          Set <code className="font-mono text-[11px] bg-muted rounded px-1">AI_GATEWAY_API_KEY</code> or
          deploy to Vercel for OIDC auto-injection.
        </p>
      )}

      {data.configured && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
            Usage analytics are available in the{" "}
            <a
              href="https://vercel.com/dashboard/ai"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Vercel AI Dashboard
            </a>. The gateway routes claude-opus-4-7 (BNA) and claude-sonnet-4-6 (Tell Claude)
            and is billed through your Vercel account.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCell label="Models configured" value="2" sub="Opus 4.7, Sonnet 4.6" />
            <StatCell label="Used by" value="JasonOS" sub="BNA + Tell Claude" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subscription Edit Dialog ─────────────────────────────────────────────────

interface EditDialogProps {
  serviceKey: SubscriptionKey;
  serviceName: string;
  config: SubscriptionConfig;
  hasUsageTracking: boolean;
  onSave: (key: SubscriptionKey, config: Partial<SubscriptionConfig>) => Promise<void>;
  onClose: () => void;
}

function EditDialog({ serviceKey, serviceName, config, hasUsageTracking, onSave, onClose }: EditDialogProps) {
  const [form, setForm] = useState({ ...config });
  const [saving, startSaving] = useTransition();

  const set = <K extends keyof SubscriptionConfig>(k: K, v: SubscriptionConfig[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    startSaving(async () => {
      await onSave(serviceKey, { ...form });
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border bg-card shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Configure {serviceName}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Enabled</span>
            <button
              onClick={() => set("enabled", !form.enabled)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                form.enabled ? "bg-emerald-500" : "bg-muted"
              )}
            >
              <span className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                form.enabled ? "translate-x-4.5" : "translate-x-0.5"
              )} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Plan</label>
              <Input
                value={form.plan}
                onChange={(e) => set("plan", e.target.value)}
                placeholder="Pro, Max, Plus…"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Billing</label>
              <Select
                value={form.billingCycle}
                onValueChange={(v) => set("billingCycle", v as "monthly" | "annual")}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Monthly cost ($)</label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.monthlyPrice}
                onChange={(e) => set("monthlyPrice", parseFloat(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Renewal date</label>
              <Input
                type="date"
                value={form.renewalDate ?? ""}
                onChange={(e) => set("renewalDate", e.target.value || null)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {hasUsageTracking && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Monthly limit</label>
                <Input
                  type="number"
                  min={0}
                  value={form.monthlyLimit ?? ""}
                  onChange={(e) => set("monthlyLimit", parseInt(e.target.value) || undefined)}
                  placeholder="e.g. 500"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Current usage</label>
                <Input
                  type="number"
                  min={0}
                  value={form.currentUsage ?? ""}
                  onChange={(e) => set("currentUsage", parseInt(e.target.value) || 0)}
                  placeholder="e.g. 312"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Monthly budget ($) — for low alerts</label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.monthlyBudget ?? ""}
              onChange={(e) => set("monthlyBudget", parseFloat(e.target.value) || undefined)}
              placeholder="Optional spend limit"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Notes</label>
            <Input
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value || undefined)}
              placeholder="e.g. Team plan, shared with…"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} className="h-7 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Subscription Card ────────────────────────────────────────────────────────

const SERVICE_META: Record<SubscriptionKey, { name: string; href: string; color: string }> = {
  claudeAi:   { name: "Claude.ai",   href: "https://claude.ai",      color: "text-orange-400" },
  chatgpt:    { name: "ChatGPT",     href: "https://chat.openai.com", color: "text-emerald-400" },
  cursor:     { name: "Cursor",      href: "https://cursor.sh",       color: "text-blue-400" },
  perplexity: { name: "Perplexity",  href: "https://perplexity.ai",   color: "text-purple-400" },
};

function SubscriptionCard({
  serviceKey,
  data,
  onEdit,
}: {
  serviceKey: SubscriptionKey;
  data: SubscriptionServiceData;
  onEdit: () => void;
}) {
  const meta = SERVICE_META[serviceKey];
  const { status, config, daysUntilRenewal, usagePercent } = data;

  const renewalLabel = daysUntilRenewal !== null
    ? daysUntilRenewal <= 0
      ? "Expired"
      : daysUntilRenewal === 1
      ? "Renews tomorrow"
      : `Renews in ${daysUntilRenewal}d`
    : config.renewalDate
    ? format(new Date(config.renewalDate + "T00:00:00"), "MMM d, yyyy")
    : null;

  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-3",
      !config.enabled ? "border-border/40 bg-card/20 opacity-60"
        : status === "critical" ? "border-red-500/30 bg-red-500/5"
        : status === "warning" ? "border-amber-500/30 bg-amber-500/5"
        : "border-border bg-card/40"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className={cn("h-4 w-4", config.enabled ? meta.color : "text-muted-foreground")} />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">{meta.name}</span>
              <a
                href={meta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {config.enabled && (
              <span className="text-[11px] text-muted-foreground">
                {config.plan} · ${config.monthlyPrice}/mo
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {config.enabled && (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              statusBg(status)
            )}>
              {statusIcon(status)}
              {status === "critical" ? (daysUntilRenewal !== null && daysUntilRenewal <= 3 ? "Expires soon" : "Near limit")
                : status === "warning" ? (daysUntilRenewal !== null && daysUntilRenewal <= 7 ? "Renews soon" : "High usage")
                : "Active"}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!config.enabled ? (
        <button
          onClick={onEdit}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left rounded-lg bg-muted/30 px-3 py-2 hover:bg-muted/50"
        >
          Click to configure this subscription…
        </button>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {renewalLabel && (
              <StatCell
                label="Renewal"
                value={
                  <span className={
                    daysUntilRenewal !== null && daysUntilRenewal <= 3
                      ? "text-red-400"
                      : daysUntilRenewal !== null && daysUntilRenewal <= 7
                      ? "text-amber-400"
                      : "text-foreground"
                  }>
                    {renewalLabel}
                  </span>
                }
              />
            )}
            <StatCell
              label="Billing"
              value={config.billingCycle === "annual" ? "Annual" : "Monthly"}
              sub={config.billingCycle === "annual" ? `$${fmt(config.monthlyPrice * 12, 0)}/yr` : undefined}
            />
          </div>

          {/* Usage bar for quota-tracked services (e.g. Cursor fast requests) */}
          {config.monthlyLimit != null && config.currentUsage != null && usagePercent !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Usage this period</span>
                <span className={statusColor(status)}>
                  {config.currentUsage.toLocaleString()} / {config.monthlyLimit.toLocaleString()}
                  {" "}({usagePercent}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", progressBarColor(usagePercent))}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
            </div>
          )}

          {config.notes && (
            <p className="text-[11px] text-muted-foreground/70 italic">{config.notes}</p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Summary Header ───────────────────────────────────────────────────────────

function OverallStatusBanner({ payload }: { payload: AiUsagePayload }) {
  const warnings: string[] = [];
  const criticals: string[] = [];

  // API services
  const checkApi = (name: string, d: ApiServiceData, budget?: number) => {
    const s = apiStatus(d, budget);
    if (s === "critical") criticals.push(name);
    if (s === "warning") warnings.push(name);
  };
  checkApi("Anthropic API", payload.anthropic);
  checkApi("OpenAI API", payload.openai);

  // Subscriptions
  for (const [key, d] of Object.entries(payload.subscriptions) as [SubscriptionKey, SubscriptionServiceData][]) {
    if (!d.config.enabled) continue;
    const meta = SERVICE_META[key];
    if (d.status === "critical") criticals.push(meta.name);
    if (d.status === "warning") warnings.push(meta.name);
  }

  if (criticals.length > 0) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-3">
        <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
        <p className="text-sm text-red-300">
          <span className="font-semibold">Action needed:</span>{" "}
          {criticals.join(", ")} {criticals.length === 1 ? "needs" : "need"} attention.
        </p>
      </div>
    );
  }

  if (warnings.length > 0) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
        <p className="text-sm text-amber-300">
          <span className="font-semibold">Heads up:</span>{" "}
          {warnings.join(", ")} {warnings.length === 1 ? "is" : "are"} approaching limits.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center gap-3">
      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
      <p className="text-sm text-emerald-300">All AI services are within normal usage levels.</p>
    </div>
  );
}

// ─── Quick Stats Bar ──────────────────────────────────────────────────────────

function QuickStats({ payload }: { payload: AiUsagePayload }) {
  const totalApiCost = payload.anthropic.totalCostUsd + payload.openai.totalCostUsd;
  const totalTokens =
    payload.anthropic.totalInputTokens +
    payload.anthropic.totalOutputTokens +
    payload.openai.totalInputTokens +
    payload.openai.totalOutputTokens;
  const activeSubscriptions = Object.values(payload.subscriptions).filter(
    (d) => d.config.enabled
  ).length;
  const monthlySubCost = Object.values(payload.subscriptions)
    .filter((d) => d.config.enabled)
    .reduce((s, d) => s + d.config.monthlyPrice, 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { icon: <DollarSign className="h-4 w-4" />, label: "API cost MTD", value: fmtUsd(totalApiCost) },
        { icon: <TrendingUp className="h-4 w-4" />, label: "Tokens used MTD", value: fmtTokens(totalTokens) },
        { icon: <Sparkles className="h-4 w-4" />, label: "Active subscriptions", value: String(activeSubscriptions) },
        { icon: <Calendar className="h-4 w-4" />, label: "Monthly sub spend", value: fmtUsd(monthlySubCost) },
      ].map((s) => (
        <div key={s.label} className="rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 flex items-center gap-2.5">
          <span className="text-muted-foreground/60">{s.icon}</span>
          <div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-sm font-semibold tabular-nums">{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AiUsageClient({ payload: initialPayload }: { payload: AiUsagePayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [editTarget, setEditTarget] = useState<SubscriptionKey | null>(null);
  const [refreshing, startRefresh] = useTransition();

  const refresh = () => {
    startRefresh(async () => {
      const res = await fetch("/api/ai-usage", { cache: "no-store" });
      if (!res.ok) {
        toast.error("Refresh failed");
        return;
      }
      const next = await res.json() as AiUsagePayload;
      setPayload(next);
      toast.success("AI usage refreshed");
    });
  };

  const handleSaveSubscription = async (
    key: SubscriptionKey,
    config: Partial<SubscriptionConfig>
  ) => {
    const result = await updateAiSubscription(key, config);
    if (!result.ok) {
      toast.error("Save failed", { description: result.error });
      return;
    }

    // Optimistically update local state
    setPayload((p) => {
      const subs = { ...p.subscriptions };
      const existing = subs[key];
      const merged = { ...existing.config, ...config } as SubscriptionConfig;
      const daysUntilRenewal = merged.renewalDate
        ? Math.ceil(
            (new Date(merged.renewalDate + "T00:00:00").getTime() - Date.now()) / 86_400_000
          )
        : null;
      const usagePercent =
        merged.monthlyLimit && merged.currentUsage != null
          ? Math.round((merged.currentUsage / merged.monthlyLimit) * 100)
          : null;
      subs[key] = {
        configured: merged.enabled,
        config: merged,
        daysUntilRenewal,
        usagePercent,
        status: merged.enabled ? subscriptionStatus(daysUntilRenewal, usagePercent) : "unconfigured",
      };
      return { ...p, subscriptions: subs };
    });
    toast.success("Subscription saved");
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">AI Usage Monitor</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track credits, usage, and subscription health across all AI services.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={refresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Status banner */}
      <OverallStatusBanner payload={payload} />

      {/* Quick stats */}
      <QuickStats payload={payload} />

      <Separator />

      {/* API Services */}
      <section className="space-y-3">
        <SectionHeading>API Services — Live Usage</SectionHeading>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ApiServiceCard
            name="Anthropic API"
            icon={<Sparkles className="h-4 w-4" />}
            docHref="https://console.anthropic.com/settings/billing"
            data={payload.anthropic}
            envKeyHint="ANTHROPIC_API_KEY"
          />
          <ApiServiceCard
            name="OpenAI API"
            icon={<BrainCircuit className="h-4 w-4" />}
            docHref="https://platform.openai.com/usage"
            data={payload.openai}
            envKeyHint="OPENAI_API_KEY"
          />
          <VercelGatewayCard data={payload.vercelGateway} />
        </div>
      </section>

      <Separator />

      {/* Subscriptions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeading>Subscriptions — Manual Tracking</SectionHeading>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Click the edit icon on any card to configure
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(["claudeAi", "chatgpt", "cursor", "perplexity"] as SubscriptionKey[]).map((key) => (
            <SubscriptionCard
              key={key}
              serviceKey={key}
              data={payload.subscriptions[key]}
              onEdit={() => setEditTarget(key)}
            />
          ))}
        </div>
      </section>

      {/* Edit dialog */}
      {editTarget && (
        <EditDialog
          serviceKey={editTarget}
          serviceName={SERVICE_META[editTarget].name}
          config={payload.subscriptions[editTarget].config}
          hasUsageTracking={editTarget === "cursor"}
          onSave={handleSaveSubscription}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
