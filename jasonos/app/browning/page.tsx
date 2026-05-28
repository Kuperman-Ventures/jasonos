import { Suspense } from "react";
import {
  getBrowningSummary,
  getBrowningContacts,
  getBrowningGates,
  getBrowningDeliverables,
  getWeeklyKpis,
} from "@/lib/browning/data";
import { BrowningClient } from "@/components/jasonos/browning/browning-client";

export const metadata = { title: "Browning" };
export const dynamic = "force-dynamic";

export default async function BrowningPage() {
  const [summary, contacts, gates, deliverables, weeklyKpis] = await Promise.all([
    getBrowningSummary(),
    getBrowningContacts(),
    getBrowningGates(),
    getBrowningDeliverables(12),
    getWeeklyKpis(12),
  ]);
  return (
    <Suspense>
      <BrowningClient
        summary={summary}
        contacts={contacts}
        gates={gates}
        deliverables={deliverables}
        weeklyKpis={weeklyKpis}
      />
    </Suspense>
  );
}
