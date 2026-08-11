// GET /api/inbox-dispatch
// Reply-triage for the home page's Inbox Dispatch card. Reads Gmail, drafts
// replies in Jason's voice, and returns BOARDING / HOLDING / NOISE as JSON.
//
// - Default: served through a 15-minute cache so page loads stay cheap.
// - ?refresh=1 or ?source=cron: recompute fresh (the weekday 7am ET cron in
//   vercel.ts hits this to warm the day's dispatch).
//
// Read-only: this route never creates or sends mail.

import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { computeInboxDispatch } from "@/lib/integrations/inbox-triage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const getCachedDispatch = unstable_cache(computeInboxDispatch, ["inbox-dispatch"], {
  revalidate: 900,
  tags: ["inbox-dispatch"],
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isCron = url.searchParams.get("source") === "cron";
  const fresh = isCron || url.searchParams.get("refresh") === "1";

  // When CRON_SECRET is set, gate cron invocations (Vercel sends it as a
  // Bearer token). No secret configured → open, same posture as health-check.
  const secret = process.env.CRON_SECRET;
  if (isCron && secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const dispatch = fresh ? await computeInboxDispatch() : await getCachedDispatch();
  return NextResponse.json(dispatch, {
    headers: { "Cache-Control": "no-store" },
  });
}
