// GET /api/browning-networking/reminders?source=cron
// GET /api/browning-networking/reminders?source=cron&test=1  — send review samples to Jason
//
// ~24h before a Browning call: remind the contact, and alert Jason if they
// have not accepted the calendar invite.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import {
  sendBrowningReminderTestExamples,
  syncBrowningMeetingReminders,
} from "@/lib/browning-networking/reminder-sync";
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

  if (url.searchParams.get("test") === "1") {
    const test = await sendBrowningReminderTestExamples();
    return NextResponse.json(test, { headers: { "Cache-Control": "no-store" } });
  }

  const result = await syncBrowningMeetingReminders(createServiceRoleClient());
  if (result.remindersSent > 0 || result.rsvpAlertsSent > 0) {
    revalidatePath("/outreach/browning-networking");
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
