// Server-side data layer for the dashboard.
// Every rendered value here is either live or explicitly marked empty.

import "server-only";
import type { MonitoringTile, Track } from "@/lib/types";
import { getStripeRevenue } from "@/lib/integrations/stripe";
import { getLemonSqueezyMetrics } from "@/lib/integrations/lemon-squeezy";
import { getTodaysCalendar } from "@/lib/integrations/google-calendar";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getReconnectDashboardData } from "@/lib/reconnect/data";
import { computePriorityFunnel } from "@/lib/reconnect/priority";
import { uniqueIssueCount } from "@/lib/mcp/result";

// ---------- Hero strip ---------------------------------------------------

export interface HeroDatum {
  track: Track;
  metric: string;
  value: string | null;
  secondary?: string;
  delta: number;
  series: number[];
  source: "live" | "empty";
  empty?: boolean;
  hint?: string;
  cta?: { label: string; href: string };
}

export interface CrossKpi {
  label: string;
  value: string | null;
  delta?: number;
  alarm?: boolean;
  sourceNote?: string;
  source: "live" | "empty";
  empty?: boolean;
  hint?: string;
  cta?: { label: string; href: string };
}

export interface DashboardData {
  hero: HeroDatum[];
  kpis: CrossKpi[];
  tiles: MonitoringTile[];
  recruiterOutreach: RecruiterOutreachStats;
}

export interface RecruiterOutreachStats {
  total: number;
  sent: number;
  replied: number;
  queueRemaining: number;
  nextThreeNames: string[];
}

const fmtUsd = (n: number, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    ...opts,
  }).format(n);

const fmtUsdShort = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return fmtUsd(n);
};

export async function getDashboardData(): Promise<DashboardData> {
  const [stripe, ls, counts, calendar, reconnect] = await Promise.all([
    getStripeRevenue(),
    getLemonSqueezyMetrics(),
    getDashboardCounts(),
    getTodaysCalendar(),
    getReconnectDashboardData(),
  ]);
  const funnel = computePriorityFunnel(reconnect.contacts);

  // ---- Hero ------------------------------------------------------------
  const heroVenture: HeroDatum = ls.configured
    ? {
        track: "venture",
        metric: "MRR · gtmtools.io",
        value: fmtUsd(ls.mrr),
        secondary: `${ls.activeSubscribers} active · ${ls.trialingSubscribers} trialing`,
        delta: 0,
        series: latestOnlySeries(ls.mrr),
        source: "live",
      }
    : {
        track: "venture",
        metric: "MRR · gtmtools.io",
        value: null,
        secondary: "Connect Lemon Squeezy",
        delta: 0,
        series: [],
        source: "empty",
        empty: true,
        hint: "Connect Lemon Squeezy in settings to show venture MRR.",
        cta: { label: "Open settings", href: "/settings" },
      };

  const hero: HeroDatum[] = [
    heroVenture,
    emptyHero("advisors", "Weighted pipeline", "No active Sprint pipeline", "Add Sprint deals in HubSpot to populate this metric."),
    {
      track: "job_search",
      metric: "Active conversations",
      value: String(counts.activeReconnectCards),
      secondary: counts.activeReconnectCards === 1 ? "open reconnect card" : "open reconnect cards",
      delta: 0,
      series: latestOnlySeries(counts.activeReconnectCards),
      source: "live",
    },
    {
      track: "personal",
      metric: "Open personal to-dos",
      value: String(counts.openPersonalTodos),
      secondary: counts.openPersonalTodos === 1 ? "open personal to-do" : "open personal to-dos",
      delta: 0,
      series: latestOnlySeries(counts.openPersonalTodos),
      source: "live",
    },
  ];

  // ---- Cross-track KPIs ------------------------------------------------
  const totalMtd = (stripe.configured ? stripe.mtd : 0) + (ls.configured ? ls.thirtyDayRevenue : 0);
  // Crude blended delta — only Stripe gives us a true period-over-period.
  const blendedDelta = stripe.configured && stripe.prevPeriodMtd > 0
    ? (stripe.mtd - stripe.prevPeriodMtd) / stripe.prevPeriodMtd
    : 0;

  const revenueLive = stripe.configured || ls.configured;

  const kpis: CrossKpi[] = [
    revenueLive
      ? {
          label: "Revenue MTD",
          value: fmtUsdShort(totalMtd),
          delta: blendedDelta,
          source: "live",
          sourceNote: "Stripe MTD + Lemon Squeezy 30d",
        }
      : emptyKpi("Revenue MTD", "Connect Stripe or Lemon Squeezy."),
    stripe.configured
      ? {
          label: "Outstanding invoices",
          value: fmtUsdShort(stripe.outstandingInvoices),
          delta: undefined,
          source: "live",
          sourceNote: "Stripe · open invoices",
        }
      : emptyKpi("Outstanding invoices", "Connect Stripe to show open invoices."),
    calendar.configured
      ? {
          label: "Meetings today",
          value: String(calendar.data.length),
          delta: undefined,
          source: "live",
          sourceNote: "Google Calendar · today",
        }
      : emptyKpi("Meetings today", "Connect Google Calendar."),
    {
      label: "Live errors",
      value: String(counts.openCriticalAlerts),
      alarm: counts.openCriticalAlerts > 0,
      source: "live",
      sourceNote: "JasonOS alerts · open critical",
    },
  ];

  // ---- Monitoring tiles ------------------------------------------------
  const tiles: MonitoringTile[] = [];
  const refreshedAt = new Date().toISOString();

  if (stripe.configured) {
    tiles.push({
      id: "stripe-rev-mtd",
      track: "advisors",
      group: "pipeline_revenue",
      label: "Revenue MTD (Stripe)",
      value: fmtUsd(stripe.mtd),
      delta: stripe.delta,
      deltaLabel: "vs same days last month",
      series: stripe.series30d,
      cadence: "daily",
      refreshedAt,
      source: "Stripe (live)",
      pinned: true,
    });
  }

  if (ls.configured) {
    tiles.push(
      {
        id: "ls-mrr",
        track: "venture",
        group: "venture_health",
        label: "gtmtools.io MRR",
        value: fmtUsd(ls.mrr),
        delta: undefined,
        deltaLabel: `${ls.activeSubscribers} active`,
        series: latestOnlySeries(ls.mrr),
        cadence: "real-time",
        refreshedAt,
        source: "Lemon Squeezy (live)",
        pinned: true,
      },
      {
        id: "ls-trials",
        track: "venture",
        group: "venture_health",
        label: "gtmtools.io trials",
        value: `${ls.trialingSubscribers}`,
        delta: undefined,
        deltaLabel:
          ls.trialsExpiring48h > 0
            ? `${ls.trialsExpiring48h} expiring in 48h`
            : "no trials expiring soon",
        series: latestOnlySeries(ls.trialingSubscribers),
        cadence: "real-time",
        refreshedAt,
        source: "Lemon Squeezy (live)",
        alert:
          ls.trialsExpiring48h > 0
            ? {
                tone: "warn",
                message: `${ls.trialsExpiring48h} trial(s) expire within 48 hours.`,
                verb: "Send conversion nudge",
              }
            : undefined,
      }
    );
  }

  return {
    hero,
    kpis,
    tiles,
    recruiterOutreach: {
      total: funnel.total,
      sent: funnel.byStage.contacted,
      replied: funnel.byStage.replied,
      queueRemaining: funnel.byStage.not_contacted,
      nextThreeNames: funnel.notContactedContacts.slice(0, 3).map((contact) => contact.name),
    },
  };
}

function latestOnlySeries(value: number): number[] {
  return [value];
}

function emptyHero(
  track: Track,
  metric: string,
  secondary: string,
  hint: string
): HeroDatum {
  return {
    track,
    metric,
    value: null,
    secondary,
    delta: 0,
    series: [],
    source: "empty",
    empty: true,
    hint,
    cta: { label: "Open settings", href: "/settings" },
  };
}

function emptyKpi(label: string, hint: string): CrossKpi {
  return {
    label,
    value: null,
    source: "empty",
    empty: true,
    hint,
    cta: { label: "Open settings", href: "/settings" },
  };
}

async function getDashboardCounts() {
  const empty = {
    activeReconnectCards: 0,
    openPersonalTodos: 0,
    openCriticalAlerts: 0,
  };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return empty;
  }

  try {
    const sb = createServiceRoleClient();
    const [reconnect, personalTodos, criticalAlerts] = await Promise.all([
      sb
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("module", "reconnect")
        .eq("state", "open"),
      sb
        .from("todos")
        .select("id", { count: "exact", head: true })
        .eq("track", "personal")
        .eq("state", "open"),
      sb
        .from("alerts")
        .select("source,title")
        .eq("category", "error")
        .eq("severity", "critical")
        .eq("state", "open"),
    ]);

    return {
      activeReconnectCards: reconnect.count ?? 0,
      openPersonalTodos: personalTodos.count ?? 0,
      openCriticalAlerts: uniqueIssueCount(criticalAlerts.data),
    };
  } catch (error) {
    console.error("[dashboard] Supabase count query failed", error);
    return empty;
  }
}
