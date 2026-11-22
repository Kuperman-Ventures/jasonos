// GET /api/webinars/week-email?source=cron
// GET /api/webinars/week-email?source=cron&preview=1  — return HTML, do not send
// GET /api/webinars/week-email?source=cron&force=1    — send even if already logged
//
// Monday morning: HTML summary of the previous calendar week's published webinars.

import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { sendWebinarWeekEmail } from "@/lib/webinars/week-email-send";

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

  const weekStart = url.searchParams.get("week_start")?.trim() || undefined;
  const force = url.searchParams.get("force") === "1";
  const preview = url.searchParams.get("preview") === "1";
  const result = await sendWebinarWeekEmail({ weekStart, force, preview });

  if (preview && result.ok && result.html) {
    return new NextResponse(result.html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Webinar-Week-Start": result.week_start,
        "X-Webinar-Subject": result.subject ?? "",
      },
    });
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
    headers: { "Cache-Control": "no-store" },
  });
}
