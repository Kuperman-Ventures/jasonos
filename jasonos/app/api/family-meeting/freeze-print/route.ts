// GET /api/family-meeting/freeze-print?source=cron
// GET /api/family-meeting/freeze-print?source=cron&force=1  — freeze now (test)

import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { freezeFamilyMeetingPrintPack } from "@/lib/family-meeting/freeze";

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

  const force = url.searchParams.get("force") === "1";
  const result = await freezeFamilyMeetingPrintPack({
    force,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || url.origin,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
