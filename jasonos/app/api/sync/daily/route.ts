// GET /api/sync/daily?source=cron
// POST /api/sync/daily
//
// Daily Sync — the same Home / Follow Up feeders as the top-bar Sync button,
// with a 7-day lookback (button keeps 90). Includes Granola-backed Commitments
// after Meeting Follow Up. Browning and Job Alerts stay on their own crons.
// These server actions use the service-role client (no signed-in browser
// session), matching the Browning cron path.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { SUGGESTED_SCAN_DAYS_FORWARD } from "@/lib/outreach/suggested-scan";
import { captureEmailCandidates } from "@/lib/server-actions/contact-candidates";
import { scanCommitmentsFromSurfaces } from "@/lib/server-actions/commitment-scan";
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
import { checkConnectionsOnSync } from "@/lib/settings/actions";

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

  // After meeting follow-ups so Granola backfill is available for Commitments.
  try {
    steps.push({
      step: "commitments",
      ...asStep(await scanCommitmentsFromSurfaces({ runId, daysBack: DAYS_BACK })),
    });
  } catch (err) {
    steps.push({
      step: "commitments",
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

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

  try {
    const connections = await checkConnectionsOnSync();
    steps.push({
      step: "connections",
      ok: true,
      checked: connections.checked,
      skipped: connections.skipped,
      total: connections.total,
      healthy: connections.healthy,
      down: connections.down,
      problems: connections.problems,
    });
  } catch (err) {
    steps.push({
      step: "connections",
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  revalidatePath("/");
  revalidatePath("/settings");
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
