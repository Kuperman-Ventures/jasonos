// GET /api/job-alerts/harvest  — cron (`?source=cron`) or `?refresh=1`
// POST /api/job-alerts/harvest — Sync job alerts button on the page
//
// Scans the Gmail Job Alerts folder, extracts listing URLs, upserts rows.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { harvestJobAlertsFromGmail } from "@/lib/data/job-alert-harvest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runHarvest(req: Request) {
  const url = new URL(req.url);
  const isCron = url.searchParams.get("source") === "cron";
  const refresh = url.searchParams.get("refresh") === "1";
  const isPost = req.method === "POST";
  if (!isCron && !refresh && !isPost) {
    return NextResponse.json(
      { error: "pass ?refresh=1, POST, or ?source=cron" },
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

export async function GET(req: Request) {
  return runHarvest(req);
}

export async function POST(req: Request) {
  return runHarvest(req);
}
