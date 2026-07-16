// 90-Day Plan — May 11, 2026 → August 2, 2026
// Primary focus: Kuperman Advisors (GTM Architect positioning + network activation)
// Parallel tracks: GTMTools.io, Executive Job Search
// Edit freely — this is a starting draft, not a contract.
//
// Type names are prefixed `Plan*` to avoid collision with the repo's existing
// `Track` type in @/lib/types. Task IDs are stable; do NOT rename them.

import type { Track as RepoTrack } from "@/lib/types";

export type PlanTrackPriority = "primary" | "parallel";

export interface PlanTask {
  id: string;
  text: string;
  week: number; // default week assignment (1-12); user can override at runtime
}

export interface PlanMilestone {
  id: string;
  name: string;
  week: number; // target week for milestone completion
  metric?: string;
  tasks: PlanTask[];
}

export interface PlanPhase {
  id: string;
  name: string;
  weekRange: [number, number];
  milestones: PlanMilestone[];
}

export interface PlanTrack {
  id: string;
  name: string;
  priority: PlanTrackPriority;
  tagline: string;
  phases: PlanPhase[];
}

export interface Plan90 {
  startDate: string; // ISO date, Monday of Week 1
  endDate: string; // ISO date, Sunday of Week 12
  weekCount: 12;
  primaryMetric: string;
  phaseDefinitions: { name: string; weekRange: [number, number] }[];
  tracks: PlanTrack[];
}

export const STORAGE_KEY = "jasonos:plan90:v1";

// Mapping from plan track ids to the repo Track type so TRACK_META colors
// (sky/emerald/violet) flow through consistently with the rest of the app.
export const PLAN_TRACK_TO_REPO: Record<string, RepoTrack> = {
  advisors: "advisors",
  gtmtools: "venture",
  "job-search": "job_search",
};

// ---------------------------------------------------------------------------
// THE PLAN
// ---------------------------------------------------------------------------

// Full previous plan retained as a template (not exported). The exported
// PLAN90 below is intentionally emptied so the To-Dos 90-Day Plan starts blank;
// restore by setting `tracks: PLAN90_TEMPLATE.tracks` in the export.
const PLAN90_TEMPLATE: Plan90 = {
  startDate: "2026-05-11",
  endDate: "2026-08-02",
  weekCount: 12,
  primaryMetric: "Warm, senior, on-thesis conversations per week",
  phaseDefinitions: [
    { name: "Foundation", weekRange: [1, 2] },
    { name: "Activation", weekRange: [3, 6] },
    { name: "Scale", weekRange: [7, 12] },
  ],
  tracks: [
    {
      id: "advisors",
      name: "Kuperman Advisors",
      priority: "primary",
      tagline:
        "GTM architect for companies where marketing, data, and physical experience intersect",
      phases: [
        {
          id: "adv-foundation",
          name: "Foundation",
          weekRange: [1, 2],
          milestones: [
            {
              id: "adv-m-reposition",
              name: "Reposition as GTM Architect",
              week: 2,
              metric:
                "Website, LinkedIn, signature, intro all reflect new positioning",
              tasks: [
                { id: "adv-t-hero", text: "Rewrite kupermanadvisors.com hero + sub-hero with GTM Architect frame", week: 1 },
                { id: "adv-t-li-headline", text: "Rewrite LinkedIn headline", week: 1 },
                { id: "adv-t-li-about", text: "Rewrite LinkedIn About section", week: 1 },
                { id: "adv-t-sig", text: "Update email signature", week: 2 },
                { id: "adv-t-onepager", text: "Draft 1-page positioning brief / leave-behind PDF", week: 2 },
                { id: "adv-t-intro", text: "Rewrite 30-second intro (for calls, DMs, emails)", week: 2 },
              ],
            },
            {
              id: "adv-m-reconnect-list",
              name: "Build tier-1 reconnect list (30 names)",
              week: 1,
              metric: "30 warm/high-value contacts tagged and prioritized",
              tasks: [
                { id: "adv-t-export", text: "Export / pull contacts from LinkedIn + Gmail", week: 1 },
                { id: "adv-t-tier1", text: "Identify top 30 tier-1 contacts (TBWA, Agency.com, Omnicom, Videri, OUTFRONT)", week: 1 },
                { id: "adv-t-tag", text: "Tag by relationship strength + strategic fit to GTM Architect frame", week: 1 },
                { id: "adv-t-msg-template", text: "Draft reconnect message template — no pitch, \"here's what I'm doing now, what about you\"", week: 1 },
              ],
            },
            {
              id: "adv-m-advance-3",
              name: "Advance the 3 live opportunities",
              week: 2,
              metric: "JLL intro booked, Luminate scoped, Swing Search on track",
              tasks: [
                { id: "adv-t-jll-intro", text: "Respond to JLL referral, book intro call", week: 1 },
                { id: "adv-t-luminate", text: "Advance Luminate joint project scope with agency partner", week: 1 },
                { id: "adv-t-swing", text: "Deliver Swing Search AI advising scope", week: 2 },
              ],
            },
          ],
        },
        {
          id: "adv-activation",
          name: "Activation",
          weekRange: [3, 6],
          milestones: [
            {
              id: "adv-m-cadence",
              name: "Launch network activation cadence (10/week)",
              week: 3,
              metric: "10 warm reconnect messages sent, 3-5 calls booked per week",
              tasks: [
                { id: "adv-t-reconnect-w3", text: "Send 10 warm reconnect messages (week 3 batch)", week: 3 },
                { id: "adv-t-reconnect-w4", text: "Send 10 warm reconnect messages (week 4 batch)", week: 4 },
                { id: "adv-t-reconnect-w5", text: "Send 10 warm reconnect messages (week 5 batch)", week: 5 },
                { id: "adv-t-reconnect-w6", text: "Send 10 warm reconnect messages (week 6 batch)", week: 6 },
                { id: "adv-t-log", text: "Log every conversation in a simple pipeline view (not a new tool)", week: 3 },
              ],
            },
            {
              id: "adv-m-conference",
              name: "Virtual conference talk",
              week: 4,
              metric: "Talk delivered; ≥10 new connections into reconnect pipeline",
              tasks: [
                { id: "adv-t-conf-prep", text: "Finalize conference talk content", week: 3 },
                { id: "adv-t-conf-pre", text: "Pre-talk LinkedIn visibility post(s)", week: 4 },
                { id: "adv-t-conf-deliver", text: "Deliver conference talk", week: 4 },
                { id: "adv-t-conf-post", text: "Post-talk follow-up: add new connections to reconnect pipeline", week: 5 },
              ],
            },
            {
              id: "adv-m-jll-convert",
              name: "Convert JLL referral → signed project",
              week: 6,
              metric: "Signed engagement OR clear decision to pass",
              tasks: [
                { id: "adv-t-jll-scope", text: "Scoping meeting with JLL", week: 3 },
                { id: "adv-t-jll-proposal", text: "Send proposal", week: 5 },
                { id: "adv-t-jll-close", text: "Close or gracefully move on", week: 6 },
              ],
            },
            {
              id: "adv-m-first-win",
              name: "First signed engagement from network",
              week: 6,
              metric: "1 signed engagement (from JLL, Luminate, or reconnect pipeline)",
              tasks: [
                { id: "adv-t-identify-best", text: "Identify most promising opportunity from pipeline", week: 5 },
                { id: "adv-t-close-first", text: "Close first new engagement from network channel", week: 6 },
              ],
            },
          ],
        },
        {
          id: "adv-scale",
          name: "Scale",
          weekRange: [7, 12],
          milestones: [
            {
              id: "adv-m-cadence-scale",
              name: "Maintain 10 reconnects/week cadence",
              week: 12,
              metric: "60+ reconnects by week 12",
              tasks: [
                { id: "adv-t-reconnect-w7", text: "Week 7 reconnect batch (10)", week: 7 },
                { id: "adv-t-reconnect-w8", text: "Week 8 reconnect batch (10)", week: 8 },
                { id: "adv-t-reconnect-w9", text: "Week 9 reconnect batch (10)", week: 9 },
                { id: "adv-t-reconnect-w10", text: "Week 10 reconnect batch (10)", week: 10 },
                { id: "adv-t-reconnect-w11", text: "Week 11 reconnect batch (10)", week: 11 },
                { id: "adv-t-reconnect-w12", text: "Week 12 reconnect batch (10)", week: 12 },
              ],
            },
            {
              id: "adv-m-refactor-role",
              name: "Decide Refactor Sprint's role",
              week: 8,
              metric: "Clear decision: lead magnet, internal diagnostic, or deprecate",
              tasks: [
                { id: "adv-t-rs-review", text: "Review Refactor Sprint performance data and fit with new positioning", week: 7 },
                { id: "adv-t-rs-decide", text: "Decide role: lead magnet / internal diagnostic / deprecate", week: 8 },
                { id: "adv-t-rs-update", text: "Update refactorsprint.com and kupermanadvisors.com accordingly", week: 8 },
              ],
            },
            {
              id: "adv-m-engagements",
              name: "2-3 total signed engagements",
              week: 12,
              metric: "2-3 engagements signed from network channel",
              tasks: [
                { id: "adv-t-second-eng", text: "Second signed engagement (target week 10)", week: 10 },
                { id: "adv-t-third-eng", text: "Third signed engagement (target week 12)", week: 12 },
              ],
            },
            {
              id: "adv-m-retro",
              name: "90-day retrospective + next plan",
              week: 12,
              metric: "Retro written; next 90-day plan drafted",
              tasks: [
                { id: "adv-t-retro-data", text: "Pull conversion data: conversations → meetings → proposals → closes", week: 11 },
                { id: "adv-t-retro-write", text: "Write retrospective: what worked, what didn't, what to change", week: 12 },
                { id: "adv-t-next-plan", text: "Draft next 90-day plan", week: 12 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "gtmtools",
      name: "GTMTools.io",
      priority: "parallel",
      tagline: "Product bet; keep shipping, don't let it eat the Advisors week",
      phases: [
        {
          id: "gtm-foundation",
          name: "Foundation",
          weekRange: [1, 2],
          milestones: [
            {
              id: "gtm-m-basics",
              name: "Product basics locked",
              week: 2,
              metric: "ICP documented, value prop one-liner, analytics instrumented",
              tasks: [
                { id: "gtm-t-icp", text: "Lock ICP (fractional CMOs, GTM leaders, early-stage founders, RevOps)", week: 1 },
                { id: "gtm-t-valueprop", text: "Sharpen one-line value prop", week: 2 },
                { id: "gtm-t-analytics", text: "Instrument analytics: actions, cohorts, drop-off", week: 2 },
              ],
            },
          ],
        },
        {
          id: "gtm-activation",
          name: "Activation",
          weekRange: [3, 6],
          milestones: [
            {
              id: "gtm-m-outbound",
              name: "Outbound test live",
              week: 5,
              metric: "3-4 touch cold sequence + LinkedIn outbound running",
              tasks: [
                { id: "gtm-t-sequences", text: "Draft and launch 3-4 touch cold email sequences", week: 3 },
                { id: "gtm-t-li-outbound", text: "LinkedIn outbound: connect + value-first DM", week: 4 },
                { id: "gtm-t-posting", text: "Founder-led posting cadence to warm audience (2x/week)", week: 5 },
              ],
            },
          ],
        },
        {
          id: "gtm-scale",
          name: "Scale",
          weekRange: [7, 12],
          milestones: [
            {
              id: "gtm-m-eval",
              name: "Evaluate + decide priority",
              week: 12,
              metric: "Data-backed decision: grow / maintain / park",
              tasks: [
                { id: "gtm-t-weekly-review", text: "Weekly review: reply rate, CTR, signup rate", week: 7 },
                { id: "gtm-t-kill-winners", text: "Kill losers, double down on winners", week: 9 },
                { id: "gtm-t-decision", text: "Decide: grow, maintain, or park based on Advisors pipeline load", week: 12 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "job-search",
      name: "Executive Job Search",
      priority: "parallel",
      tagline:
        "Parallel path; compatible with Advisors positioning, not a contradiction",
      phases: [
        {
          id: "js-foundation",
          name: "Foundation",
          weekRange: [1, 2],
          milestones: [
            {
              id: "js-m-diagnose",
              name: "Diagnose + simplify",
              week: 2,
              metric: "One pipeline view, one networking log, one weekly metric",
              tasks: [
                { id: "js-t-actuals", text: "List 6-month actuals: applications, conversations, interviews, offers, ghostings", week: 1 },
                { id: "js-t-bottleneck", text: "Identify the real bottleneck: top, middle, or end of funnel", week: 1 },
                { id: "js-t-simplify", text: "Kill every tracker/doc/spreadsheet outside the core three", week: 2 },
                { id: "js-t-pitch", text: "Rewrite 30-sec intro for the one role, not the range", week: 2 },
              ],
            },
          ],
        },
        {
          id: "js-activation",
          name: "Activation",
          weekRange: [3, 6],
          milestones: [
            {
              id: "js-m-active",
              name: "Active search running",
              week: 6,
              metric:
                "Target list of 30-50 companies, warm paths identified, weekly conversation goal hit",
              tasks: [
                { id: "js-t-targetlist", text: "Target list: 30-50 companies where the role actually exists", week: 3 },
                { id: "js-t-warm", text: "Warm path: 1st/2nd degree connections at each", week: 4 },
                { id: "js-t-cold", text: "Cold path: hiring managers and peers, not recruiters", week: 5 },
                { id: "js-t-volume", text: "Volume target: X conversations/week, not X applications/week", week: 6 },
              ],
            },
          ],
        },
        {
          id: "js-scale",
          name: "Scale",
          weekRange: [7, 12],
          milestones: [
            {
              id: "js-m-evaluate",
              name: "Evaluate against Advisors traction",
              week: 12,
              metric:
                "Decision: continue, pause, or re-pace based on Advisors pipeline",
              tasks: [
                { id: "js-t-stories", text: "2-3 stories that prove you can do that specific role; test with 2-3 trusted people", week: 8 },
                { id: "js-t-update", text: "Update resume/LinkedIn to match — then stop editing", week: 9 },
                { id: "js-t-evaluate", text: "Evaluate: continue full-pace, slow down, or pause based on Advisors results", week: 12 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// The 90-Day Plan content is intentionally empty. To repopulate, add tracks
// here (or set `tracks: PLAN90_TEMPLATE.tracks` to restore the previous plan).
export const PLAN90: Plan90 = {
  ...PLAN90_TEMPLATE,
  primaryMetric: "",
  tracks: [],
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * 1-indexed current plan week (1..12). Returns 0 before plan start, 13+ after end.
 * Use `getDisplayWeek` instead for components that should show Week 1 during
 * the run-up to the official start date.
 */
export function getCurrentWeek(today: Date = new Date()): number {
  const start = new Date(PLAN90.startDate + "T00:00:00");
  const diffDays = Math.floor(
    (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Same as getCurrentWeek but clamps the pre-start window to Week 1 so the
 * dashboard can preview W1 tasks during the run-up to the official start date.
 * Returns 0 only if you're more than 14 days before start, 13+ after end.
 */
export function getDisplayWeek(today: Date = new Date()): number {
  const w = getCurrentWeek(today);
  if (w < 1) {
    const start = new Date(PLAN90.startDate + "T00:00:00");
    const diffDays = Math.floor(
      (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays >= -14 ? 1 : 0;
  }
  return w;
}

/** Monday-Sunday date range for a given plan week. */
export function getWeekRange(week: number): { start: Date; end: Date } {
  const start = new Date(PLAN90.startDate + "T00:00:00");
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

/** Format a week range like "Apr 27 – May 3". */
export function formatWeekLabel(week: number): string {
  const { start, end } = getWeekRange(week);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Flatten all tasks across the plan (useful for "This Week" and counts). */
export function allTasks(): Array<
  PlanTask & { trackId: string; milestoneId: string }
> {
  const out: Array<PlanTask & { trackId: string; milestoneId: string }> = [];
  for (const track of PLAN90.tracks) {
    for (const phase of track.phases) {
      for (const m of phase.milestones) {
        for (const t of m.tasks) {
          out.push({ ...t, trackId: track.id, milestoneId: m.id });
        }
      }
    }
  }
  return out;
}

export const PLAN90_STATS = {
  tracks: PLAN90.tracks.length,
  milestones: PLAN90.tracks.reduce(
    (s, t) => s + t.phases.reduce((ps, p) => ps + p.milestones.length, 0),
    0
  ),
  tasks: allTasks().length,
};
