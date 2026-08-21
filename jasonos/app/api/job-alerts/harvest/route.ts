// GET /api/job-alerts/harvest
// Scans the Gmail Job Alerts folder, extracts listing URLs, upserts rows.
//
// - ?source=cron: weekday Vercel cron (gated by CRON_SECRET when set).
// - ?refresh=1: manual rescan from the Job Alerts page.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { harvestJobAlertsFromGmail } from "@/lib/data/job-alert-harvest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isCron = url.searchParams.get("source") === "cron";
  const refresh = url.searchParams.get("refresh") === "1";
  if (!isCron && !refresh) {
    return NextResponse.json(
      { error: "pass ?refresh=1 or ?source=cron" },
      { status: 400 }
    );
  }

  const secret = process.env.CRON_SECRET;
  if (isCron && secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await harvestJobAlertsFromGmail();
  revalidatePath("/job-alerts");
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
