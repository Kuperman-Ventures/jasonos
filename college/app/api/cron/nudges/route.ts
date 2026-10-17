import { NextResponse } from "next/server";
import { isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { loadLiveNudgeCatalog } from "@/lib/nudge-catalog";
import { dispatchStoredNudge } from "@/lib/nudge-send";
import { dueNudges, loadNudges } from "@/lib/nudge-store";

export const runtime = "nodejs";

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    const session = await requireCollegeSession();
    if (!isSession(session) || !isSuperAdmin(session)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
  }
  try {
    const now = new Date();
    const due = dueNudges(await loadNudges(), now);
    const catalog = due.length ? await loadLiveNudgeCatalog(now) : null;
    const results = [];
    for (const nudge of due) {
      results.push(await dispatchStoredNudge(nudge, catalog!, now));
    }
    return NextResponse.json({ ran: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send scheduled nudges";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
