/**
 * Force-sync one Browning handoff's tentative holds (or all open ones).
 * Usage: npx tsx --env-file=.env.production.local scripts/release-browning-hold.ts [handoffId]
 */
import { createServiceRoleClient } from "../lib/supabase/server";
import {
  syncHandoffHolds,
  syncOpenHandoffHolds,
} from "../lib/browning-networking/hold-sync";

async function main() {
  const sb = createServiceRoleClient();
  const handoffId = process.argv[2]?.trim();
  if (handoffId) {
    const result = await syncHandoffHolds(sb, handoffId, { force: true });
    console.log(JSON.stringify(result));
    return;
  }
  const result = await syncOpenHandoffHolds(sb, 40);
  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
