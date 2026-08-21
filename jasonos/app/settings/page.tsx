import { Suspense } from "react";
import { getStripeRevenue } from "@/lib/integrations/stripe";
import { getLemonSqueezyMetrics } from "@/lib/integrations/lemon-squeezy";
import { getSettingsPayload } from "@/lib/settings/data";
import { SettingsClient } from "@/components/jasonos/settings/settings-client";

export const metadata = { title: "Settings · JasonOS" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [stripe, ls, settings] = await Promise.all([
    getStripeRevenue(),
    getLemonSqueezyMetrics(),
    getSettingsPayload(),
  ]);

  return (
    <Suspense>
      <SettingsClient
        initialSettings={settings}
        billing={{
          stripe: {
            configured: stripe.configured,
            mtd: stripe.mtd,
            prevPeriodMtd: stripe.prevPeriodMtd,
            outstandingInvoices: stripe.outstandingInvoices,
            currency: stripe.currency,
          },
          lemonSqueezy: {
            configured: ls.configured,
            mrr: ls.mrr,
            thirtyDayRevenue: ls.thirtyDayRevenue,
            thirtyDaySales: ls.thirtyDaySales,
            activeSubscribers: ls.activeSubscribers,
            trialingSubscribers: ls.trialingSubscribers,
            trialsExpiring48h: ls.trialsExpiring48h,
            storeName: ls.storeName,
          },
        }}
      />
    </Suspense>
  );
}
