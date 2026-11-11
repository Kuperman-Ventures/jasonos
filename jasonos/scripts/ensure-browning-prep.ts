/**
 * Link Live meeting prep + Browning plan for booked handoffs missing prep_id.
 * Usage (from jasonos/): npx tsx --env-file=.env.production.local scripts/ensure-browning-prep.ts
 */
import { createServiceRoleClient } from "../lib/supabase/server";
import {
  buildBrowningPlan,
  ensurePrepForHandoff,
  loadHandoffForPrep,
} from "../lib/browning-networking/prep-link";

async function main() {
  const sb = createServiceRoleClient();
  const { data: rows, error } = await sb
    .from("browning_handoffs")
    .select("id, contact_name, call_event_id, call_starts_at, call_ends_at, call_title, prep_id")
    .is("prep_id", null)
    .not("call_event_id", "is", null)
    .not("call_starts_at", "is", null)
    .gte("call_starts_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .neq("status", "dismissed")
    .order("call_starts_at", { ascending: true });
  if (error) throw error;
  if (!rows?.length) {
    console.log("No upcoming handoffs missing prep_id.");
    return;
  }

  for (const row of rows) {
    const handoff = await loadHandoffForPrep(sb, String(row.id));
    if (!handoff) {
      console.error("load failed", row.contact_name);
      continue;
    }
    const ensured = await ensurePrepForHandoff(sb, handoff, {
      id: String(row.call_event_id),
      title: String(row.call_title || "Networking call"),
      startsAt: String(row.call_starts_at),
      endsAt: (row.call_ends_at as string | null) || String(row.call_starts_at),
    });
    if (!ensured.ok) {
      console.error("prep failed", row.contact_name, ensured.error);
      continue;
    }
    const planned = await buildBrowningPlan(ensured.prepId, {
      ...handoff,
      prep_id: ensured.prepId,
    });
    console.log(
      row.contact_name,
      "prep",
      ensured.prepId,
      planned.ok ? (planned.built ? "plan-built" : "plan-skipped") : planned.error
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
