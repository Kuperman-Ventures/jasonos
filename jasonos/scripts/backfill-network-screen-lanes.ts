import { createClient } from "@supabase/supabase-js";

// One-off: set lane on existing network_screen_candidates from bucket/tier.
// Run from jasonos/:
//   npx tsx scripts/backfill-network-screen-lanes.ts

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const sb = createClient(url, serviceRole, {
  db: { schema: "jasonos" },
  auth: { persistSession: false },
});

type Row = {
  id: string;
  tier: string;
  bucket: string;
  lane: string;
};

function laneFor(row: Row): string {
  if (row.bucket === "speaking_content") return "industry";
  if (row.bucket === "not_relevant" || row.tier === "none") return "none";
  if (
    (row.tier === "tier1" || row.tier === "tier2") &&
    (row.bucket === "hiring_path" || row.bucket === "recruiter" || row.bucket === "peer_referral")
  ) {
    return "job_search";
  }
  if (row.bucket === "prospect" || row.bucket === "operating_partner") return "advisors";
  if (row.bucket === "industry_peer") return "industry";
  return "none";
}

async function main() {
  const { data, error } = await sb
    .from("network_screen_candidates")
    .select("id, tier, bucket, lane");
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const counts: Record<string, number> = {
    job_search: 0,
    advisors: 0,
    industry: 0,
    none: 0,
    unassigned: 0,
  };

  for (const row of rows) {
    const lane = laneFor(row);
    counts[lane] = (counts[lane] ?? 0) + 1;
    if (row.lane === lane) continue;
    const { error: updateError } = await sb
      .from("network_screen_candidates")
      .update({ lane })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }

  console.log("Backfill complete. Lane counts:");
  for (const [lane, count] of Object.entries(counts)) {
    console.log(`  ${lane}: ${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
