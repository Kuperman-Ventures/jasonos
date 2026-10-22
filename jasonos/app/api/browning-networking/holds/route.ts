// GET /api/browning-networking/holds?source=cron
//
// Lightweight hold sync — creates/moves/deletes tentative Hold · events,
// including the 24h release for unbooked near slots. Separate from the
// full Browning run so midday releases do not wait until tomorrow's cron.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { syncOpenHandoffHolds } from "@/lib/browning-networking/hold-sync";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("source") !== "cron") {
    return NextResponse.json({ error: "pass ?source=cron" }, { status: 400 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await syncOpenHandoffHolds(createServiceRoleClient(), 30);
  if (result.ok && result.changed > 0) {
    revalidatePath("/outreach/browning-networking");
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
