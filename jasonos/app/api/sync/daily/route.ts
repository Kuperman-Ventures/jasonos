// GET /api/sync/daily?source=cron
// POST /api/sync/daily
//
// Daily Sync — the same Home / Follow Up feeders as the top-bar Sync button,
// with a 7-day lookback (button keeps 90). Browning and Job Alerts stay on
// their own crons. These server actions use the service-role client (no
// signed-in browser session), matching the Browning cron path.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { SUGGESTED_SCAN_DAYS_FORWARD } from "@/lib/outreach/suggested-scan";
import { captureEmailCandidates } from "@/lib/server-actions/contact-candidates";
import { captureMeetingFollowups } from "@/lib/server-actions/meeting-followups";
import {
  listSyncTargets,
  syncOutreachFromBeeper,
  syncOutreachFromCalendar,
  syncOutreachFromGmail,
  syncOutreachFromOutlook,
} from "@/lib/server-actions/outreach-sync";
import { captureSentEmailFollowups } from "@/lib/server-actions/sent-followups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAYS_BACK = 7;

async function runDailySync() {
  const runId = crypto.randomUUID();
  const targets = await listSyncTargets();

  const jobs: Array<{ step: string; run: () => Promise<Record<string, unknown>> }> = [
    ...(targets.gmailAccounts.length > 0
      ? targets.gmailAccounts.map((account) => ({
          step: `gmail:${account.email}`,
          run: () =>
            syncOutreachFromGmail({
              daysBack: DAYS_BACK,
              runId,
              accountEmail: account.email,
            }) as Promise<Record<string, unknown>>,
        }))
      : [
          {
            step: "gmail",
            run: () =>
              syncOutreachFromGmail({
                daysBack: DAYS_BACK,
                runId,
              }) as Promise<Record<string, unknown>>,
          },
        ]),
    ...(targets.outlook
      ? [
          {
            step: "outlook",
            run: () =>
              syncOutreachFromOutlook({
                daysBack: DAYS_BACK,
                runId,
              }) as Promise<Record<string, unknown>>,
          },
        ]
      : []),
    {
      step: "calendar",
      run: () =>
        syncOutreachFromCalendar({
          daysBack: DAYS_BACK,
          daysForward: SUGGESTED_SCAN_DAYS_FORWARD,
          runId,
        }) as Promise<Record<string, unknown>>,
    },
    {
      step: "beeper",
      run: () => syncOutreachFromBeeper({ runId }) as Promise<Record<string, unknown>>,
    },
    {
      step: "suggested",
      run: () =>
        captureEmailCandidates({
          days: DAYS_BACK,
          max: 250,
          runId,
        }) as Promise<Record<string, unknown>>,
    },
    {
      step: "meeting-followups",
      run: () => captureMeetingFollowups({ runId }) as Promise<Record<string, unknown>>,
    },
    {
      step: "sent-followups",
      run: () =>
        captureSentEmailFollowups({
          daysBack: DAYS_BACK,
          runId,
        }) as Promise<Record<string, unknown>>,
    },
  ];

  const settled = await Promise.allSettled(jobs.map((job) => job.run()));
  const steps = settled.map((result, index) => {
    const step = jobs[index]!.step;
    if (result.status === "fulfilled") {
      return { step, ...result.value };
    }
    return {
      step,
      ok: false,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    };
  });

  revalidatePath("/");
  revalidatePath("/outreach/queue");
  revalidatePath("/outreach/sent");

  return {
    ok: steps.every(
      (step) => step.ok === true || step.unavailable === true
    ),
    runId,
    steps,
  };
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const isCron = url.searchParams.get("source") === "cron";

  if (isCron && !isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isCron && req.method !== "POST") {
    return NextResponse.json(
      { error: "POST while signed in, or GET ?source=cron" },
      { status: 400 }
    );
  }

  const result = await runDailySync();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
