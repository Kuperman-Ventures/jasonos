// GET /api/inbox-dispatch
// Reply-triage for the home page's Inbox Dispatch card. Returns BOARDING /
// HOLDING / NOISE as JSON, from one of two sources:
//
//   1. Published (preferred) — the weekday morning triage agent writes the
//      day's dispatch into public.inbox_dispatches. It searches wider than the
//      engine below and saves real reply drafts in Gmail, so when a row exists
//      it wins. Rows are already-computed JSON, so no cache is needed.
//   2. Live fallback — computeInboxDispatch() runs the in-app read-only engine
//      for days the publisher didn't run. Served through a 15-minute cache so
//      page loads stay cheap.
//
// ?refresh=1 (the card's Refresh button) always recomputes live, bypassing
// both the published row and the cache.
//
// Read-only: this route never creates or sends mail. The published row's
// drafts were saved by the publisher, which holds that scope; nothing here does.

import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { computeInboxDispatch } from "@/lib/integrations/inbox-triage";
import { getPublishedInboxDispatch } from "@/lib/data/inbox-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const getCachedDispatch = unstable_cache(computeInboxDispatch, ["inbox-dispatch"], {
  revalidate: 900,
  tags: ["inbox-dispatch"],
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fresh = url.searchParams.get("refresh") === "1";

  if (!fresh) {
    const published = await getPublishedInboxDispatch();
    if (published) {
      return NextResponse.json(published, {
        headers: { "Cache-Control": "no-store" },
      });
    }
  }

  const dispatch = fresh ? await computeInboxDispatch() : await getCachedDispatch();
  return NextResponse.json(
    { ...dispatch, source: "live" as const },
    { headers: { "Cache-Control": "no-store" } }
  );
}
