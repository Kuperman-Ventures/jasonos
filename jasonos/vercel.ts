import { type VercelConfig } from "@vercel/config/v1";

// JasonOS — Vercel project config (typed replacement for vercel.json).
// Redeploy trigger for brand guideline v2 color system (domain + Done).
// Lives at the repo root of the deployed project. Because JasonOS is a
// subfolder of the CoSA repo, the Vercel project's "Root Directory" is
// set to `jasonos/` (configured via API on 2026-04-22).
export const config: VercelConfig = {
  framework: "nextjs",
  // Turbopack's Google font loader fails on Vercel when this app sits in a
  // subfolder: the build root becomes the CoSA repo, and next/font/google
  // then errors with "queries have exactly one entry". Webpack loads those
  // fonts normally.
  buildCommand: "next build --webpack",
  // Skip preview builds if the commit didn't touch the jasonos/ subfolder.
  // Always build `main` so production deploys don't get skipped when a push
  // contains JasonOS changes followed by a repo-level docs/config commit.
  // Runs from the project's Root Directory (jasonos/), so we cd up to the
  // repo root before checking the path. Exit 0 = skip, exit 1 = build.
  ignoreCommand:
    'if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; fi; cd "$(git rev-parse --show-toplevel)" && git diff --quiet HEAD^ HEAD -- jasonos',
  functions: {
    "app/api/tell-claude/route.ts": { maxDuration: 60 },
    "app/api/mcp/route.ts": { maxDuration: 60 },
    "app/api/morning-brief/publish/route.ts": { maxDuration: 60 },
    "app/api/inbox-dispatch/publish/route.ts": { maxDuration: 60 },
    "app/api/commitment-check/publish/route.ts": { maxDuration: 60 },
    "app/api/post-master/hooks/route.ts": { maxDuration: 60 },
    "app/api/post-master/generate/route.ts": { maxDuration: 120 },
    "app/api/post-master/research/route.ts": { maxDuration: 120 },
    "app/api/post-master/weekly-provocation/research/route.ts": { maxDuration: 300 },


    // Product Health probes targets in parallel with a 10s timeout each;
    // give the function some slack so a single slow site doesn't trip the
    // function timeout.
    "app/api/monitoring/health-check/route.ts": { maxDuration: 60 },

    // Inbox Dispatch reads Gmail + drafts replies via Claude; give it slack.
    "app/api/inbox-dispatch/route.ts": { maxDuration: 60 },
    // Job Alerts harvest opens Gmail threads from a labeled folder.
    "app/api/job-alerts/harvest/route.ts": { maxDuration: 60 },
    "app/api/browning-networking/run/route.ts": { maxDuration: 60 },
    "app/api/browning-networking/holds/route.ts": { maxDuration: 60 },
    // Daily Sync: Gmail/Outlook/Calendar/Beeper + follow-up capture.
    "app/api/sync/daily/route.ts": { maxDuration: 300 },
    // Suggested Scan: 90-day Gmail + calendar + Beeper. Needs a long window.
    "app/api/outreach/scan-suggested/route.ts": { maxDuration: 300 },
    // Home Overdue "Draft email" reads multiple Gmail threads then calls Claude.
    "app/api/outreach/draft/route.ts": { maxDuration: 60 },
  },
  crons: [
    // Product Health — every 2 minutes. Requires Vercel Pro (per-minute
    // crons). The route requires CRON_SECRET (Vercel sends it as a Bearer token).
    {
      path: "/api/monitoring/health-check?source=cron",
      schedule: "*/2 * * * *",
    },
    // Daily Sync - 6:30am ET during EDT, 5:30am ET after Nov 1.
    { path: "/api/sync/daily?source=cron", schedule: "30 10 * * *" },
    // Job Alerts — weekday 7:15am / noon / 5pm ET (EDT). Scans the Gmail
    // Job Alerts folder for new listing emails.
    {
      path: "/api/job-alerts/harvest?source=cron",
      schedule: "15 11,16,21 * * 1-5",
    },
    // Browning Networking — weekday 7:30am ET (EDT). Tracy handoffs, call
    // briefs, and thank-you drafts.
    {
      path: "/api/browning-networking/run?source=cron",
      schedule: "30 11 * * 1-5",
    },
    // Browning holds — weekdays every hour (EDT). Releases unbooked Hold ·
    // events inside 24 hours without waiting for the morning full run.
    {
      path: "/api/browning-networking/holds?source=cron",
      schedule: "5 * * * 1-5",
    },
  ],
};
