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
import { researchPendingWeeklyProvocations } from "@/lib/post-master/weekly-provocation/prepare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAYS_BACK = 7;

type StepPayload = Record<string, unknown> & {
  ok: boolean;
  error?: string;
  unavailable?: boolean;
};

function asStep(result: object): StepPayload {
  return { ...(result as Record<string, unknown>), ok: Boolean((result as { ok?: unknown }).ok) };
}

async function runDailySync() {
  const runId = crypto.randomUUID();
  const targets = await listSyncTargets();

  const jobs: Array<{ step: string; run: () => Promise<StepPayload> }> = [
    ...(targets.gmailAccounts.length > 0
      ? targets.gmailAccounts.map((account) => ({
          step: `gmail:${account.email}`,
          run: async () =>
            asStep(
              await syncOutreachFromGmail({
                daysBack: DAYS_BACK,
                runId,
                accountEmail: account.email,
              })
            ),
        }))
      : [
          {
            step: "gmail",
            run: async () =>
              asStep(
                await syncOutreachFromGmail({
                  daysBack: DAYS_BACK,
                  runId,
                })
              ),
          },
        ]),
    ...(targets.outlook
      ? [
          {
            step: "outlook",
            run: async () =>
              asStep(
                await syncOutreachFromOutlook({
                  daysBack: DAYS_BACK,
                  runId,
                })
              ),
          },
        ]
      : []),
    {
      step: "calendar",
      run: async () =>
        asStep(
          await syncOutreachFromCalendar({
            daysBack: DAYS_BACK,
            daysForward: SUGGESTED_SCAN_DAYS_FORWARD,
            runId,
          })
        ),
    },
    {
      step: "beeper",
      run: async () => asStep(await syncOutreachFromBeeper({ runId })),
    },
    {
      step: "suggested",
      run: async () =>
        asStep(
          await captureEmailCandidates({
            days: DAYS_BACK,
            max: 250,
            runId,
          })
        ),
    },
    {
      step: "meeting-followups",
      run: async () => asStep(await captureMeetingFollowups({ runId })),
    },
    {
      step: "sent-followups",
      run: async () =>
        asStep(
          await captureSentEmailFollowups({
            daysBack: DAYS_BACK,
            runId,
          })
        ),
    },
  ];

  const settled = await Promise.allSettled(jobs.map((job) => job.run()));
  const steps: Array<StepPayload & { step: string }> = settled.map((result, index) => {
    const step = jobs[index]!.step;
    if (result.status === "fulfilled") {
      return { step, ...result.value };
    }
    return {
      step,
      ok: false as const,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    };
  });

  try {
    const provocations = await researchPendingWeeklyProvocations(1);
    steps.push({
      step: "weekly-provocation",
      ok: true,
      researched: provocations.researched,
      failed: provocations.failed,
      warnings: provocations.warnings,
    });
  } catch (err) {
    steps.push({
      step: "weekly-provocation",
      ok: true,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  revalidatePath("/");
  revalidatePath("/outreach/queue");
  revalidatePath("/outreach/sent");

  return {
    ok: steps.every((step) => step.ok || Boolean(step.unavailable)),
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
