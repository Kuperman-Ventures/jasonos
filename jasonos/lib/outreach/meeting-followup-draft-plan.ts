/**
 * Follow-up Plan card — structured facts Jason approves before any email prose.
 * Deterministic extractors only; compose may not invent fields missing here.
 */
import {
  addBusinessDays,
  addCalendarDays,
  isWeekday,
  wallToUtc,
  type BusyInterval,
} from "@/lib/browning-networking/slots";
import type { HandoffSlot } from "@/lib/browning-networking/types";
import { etYmd } from "@/lib/dates";
import {
  notesLookLikeFirstMeeting,
  pickJasonOwes,
  pickTheirOffer,
} from "@/lib/outreach/meeting-followups";

export type FollowupNextStepKind = "schedule_call" | "send_thing" | "none";
export type FollowupNextStepOwner = "jason" | "them";

export type MeetingFollowupDraftPlan = {
  recipientFirstName: string;
  whenPhrase: string;
  firstMeeting: boolean;
  /** One specific thing they said — must come from notes/transcript. */
  hook: string | null;
  jasonOwes: string[];
  theirOffer: string | null;
  nextStep: {
    kind: FollowupNextStepKind;
    owner: FollowupNextStepOwner;
    label: string;
  };
  /** Free windows Jason can offer (ISO). Empty when not scheduling. */
  proposedSlots: HandoffSlot[];
  /** Human labels for the slots (Eastern). */
  proposedSlotLabels: string[];
};

const SLOT_MINUTES = 30;
const PREFERRED_STARTS = [10 * 60, 11 * 60, 14 * 60, 15 * 60];

/** True when Next Steps are really "put another meeting on the calendar". */
export function looksLikeScheduleFollowup(source: string): boolean {
  return (
    /\bschedule\b.{0,40}\bfollow[- ]?up\b/i.test(source) ||
    /\bfollow[- ]?up call\b/i.test(source) ||
    /\bput another (meeting|call) on the calendar\b/i.test(source) ||
    /\bagreed to (put|schedule|book).{0,40}\b(meeting|call|follow[- ]?up)\b/i.test(
      source
    )
  );
}

/** Drop schedule/follow-up lines from owes — those are next_step, not deliverables. */
export function isScheduleNextStepLine(text: string): boolean {
  if (/\bput another (meeting|call)\b/i.test(text)) return true;
  if (/\bfollow[- ]?up call\b/i.test(text)) return true;
  return (
    /\bschedule\b/i.test(text) && /\b(follow[- ]?up|call|meeting)\b/i.test(text)
  );
}

/**
 * First substantive bullet from notes (skip Background / Next Steps headings).
 * Returns null when nothing trustworthy is there — UI shows "none found".
 */
export function pickFollowupHook(source: string | null | undefined): string | null {
  const raw = (source ?? "").replace(/\r\n/g, "\n");
  if (!raw.trim()) return null;
  let skip = false;
  const candidates: string[] = [];
  for (const line of raw.split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.*)$/)?.[1]?.trim() ?? "";
    if (heading) {
      skip =
        /\b(background|next steps?|action items?|agenda)\b/i.test(heading) ||
        /\bbordie and networking\b/i.test(heading);
      continue;
    }
    if (skip) continue;
    let text = line
      .replace(/^[-*•]\s+/, "")
      .replace(/^\*\*(.+?)\*\*.*$/u, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 28 || text.length > 180) continue;
    if (/^(dan|daniel|jason)\b/i.test(text) && text.length < 40) continue;
    candidates.push(text);
  }
  // Prefer product / insight lines over career bio.
  const ranked = [...candidates].sort((a, b) => {
    const score = (t: string) =>
      (/\b(llm|protocol|credibility|built|product|insight|score)\b/i.test(t)
        ? 2
        : 0) + (t.length > 50 ? 1 : 0);
    return score(b) - score(a);
  });
  return ranked[0] ?? null;
}

export function detectFollowupNextStep(source: string): {
  kind: FollowupNextStepKind;
  owner: FollowupNextStepOwner;
  label: string;
} {
  if (looksLikeScheduleFollowup(source)) {
    return {
      kind: "schedule_call",
      owner: "jason",
      label: "Jason schedules a follow-up call",
    };
  }
  const owes = pickJasonOwes(source).filter((line) => !isScheduleNextStepLine(line));
  if (owes.length) {
    return {
      kind: "send_thing",
      owner: "jason",
      label: owes[0],
    };
  }
  return {
    kind: "none",
    owner: "jason",
    label: "No clear next step in the notes",
  };
}

/** Near-term free 30-min windows for a post-meeting follow-up (not Browning's 3-day buffer). */
export function proposeFollowupSlots(input: {
  now?: Date;
  busy?: BusyInterval[];
  count?: number;
}): HandoffSlot[] {
  const now = input.now ?? new Date();
  const count = input.count ?? 3;
  const today = etYmd(now);
  const first = addBusinessDays(today, 1);
  const days: string[] = [];
  let cursor = first;
  while (days.length < 8) {
    if (isWeekday(cursor)) days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
    if (cursor > addCalendarDays(first, 18)) break;
  }

  const chosen: HandoffSlot[] = [];
  const usedDays = new Set<string>();
  const busy = input.busy ?? [];

  const overlaps = (start: Date, end: Date) => {
    for (const block of busy) {
      if (block.allDay) continue;
      const blockStart = Date.parse(block.start);
      const blockEnd = Date.parse(block.end);
      if (!Number.isFinite(blockStart) || !Number.isFinite(blockEnd)) continue;
      if (start.getTime() < blockEnd && end.getTime() > blockStart) return true;
    }
    return false;
  };

  for (const ymd of days) {
    if (chosen.length >= count) break;
    if (usedDays.has(ymd)) continue;
    for (const startMin of PREFERRED_STARTS) {
      const start = wallToUtc(ymd, startMin);
      const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);
      if (start.getTime() <= now.getTime()) continue;
      if (overlaps(start, end)) continue;
      chosen.push({
        id: `followup-${start.toISOString()}`,
        start: start.toISOString(),
        end: end.toISOString(),
      });
      usedDays.add(ymd);
      break;
    }
  }
  return chosen;
}

export function buildMeetingFollowupDraftPlan(input: {
  summary: string | null;
  transcript?: string | null;
  whenPhrase: string;
  recipientFirstName: string;
  proposedSlots?: HandoffSlot[];
  proposedSlotLabels?: string[];
}): MeetingFollowupDraftPlan {
  const notes = input.summary?.trim() || "";
  const transcript = input.transcript?.trim() || "";
  const checkSource = notes || transcript.slice(0, 4_000) || "";
  const rawOwes = pickJasonOwes(checkSource).filter(
    (line) => !isScheduleNextStepLine(line)
  );
  const nextStep = detectFollowupNextStep(checkSource);
  const slots =
    nextStep.kind === "schedule_call" ? (input.proposedSlots ?? []) : [];
  const labels =
    nextStep.kind === "schedule_call" ? (input.proposedSlotLabels ?? []) : [];

  return {
    recipientFirstName: input.recipientFirstName,
    whenPhrase: input.whenPhrase,
    firstMeeting: notesLookLikeFirstMeeting(checkSource),
    hook: pickFollowupHook(checkSource),
    jasonOwes: rawOwes.slice(0, 3),
    theirOffer: pickTheirOffer(checkSource),
    nextStep,
    proposedSlots: slots,
    proposedSlotLabels: labels,
  };
}

/** Asking *them* for availability — banned when Jason owns scheduling. */
export function asksThemForAvailability(body: string): boolean {
  return (
    /\bsend me\b.{0,40}\b(windows|times|slots|options)\b/i.test(body) ||
    /\bwhat times? work for you\b/i.test(body) ||
    /\blet me know (what|which) (times?|windows?|days?) work\b/i.test(body) ||
    /\bsend (me )?(your )?(availability|a few times)\b/i.test(body) ||
    /\bwhen (are|is) (you|your calendar) free\b/i.test(body)
  );
}

/** Throat-clearing when owes is empty — "I don't owe anything" style. */
export function inventsEmptyOweExcuse(body: string): boolean {
  return (
    /\bi don'?t have a (specific )?deliverable\b/i.test(body) ||
    /\bno (specific )?deliverable owed\b/i.test(body) ||
    /\bnothing (specific )?owed\b/i.test(body) ||
    /\bi don'?t owe you\b/i.test(body) ||
    /\bno action item (on my side|for me)\b/i.test(body)
  );
}

/**
 * Hard gates against the approved plan. True = draft must be refused.
 */
export function draftViolatesApprovedPlan(
  body: string,
  plan: MeetingFollowupDraftPlan
): boolean {
  if (plan.jasonOwes.length === 0 && inventsEmptyOweExcuse(body)) return true;
  if (
    plan.nextStep.kind === "schedule_call" &&
    plan.nextStep.owner === "jason" &&
    asksThemForAvailability(body)
  ) {
    return true;
  }
  // If Jason proposed times on the card, the body should not ask them for times.
  if (plan.proposedSlotLabels.length > 0 && asksThemForAvailability(body)) {
    return true;
  }
  return false;
}

/** Prompt block: the model may only write from these fields. */
export function formatPlanForComposePrompt(plan: MeetingFollowupDraftPlan): string {
  const owes =
    plan.jasonOwes.length > 0
      ? plan.jasonOwes.map((item) => `- ${item}`).join("\n")
      : "(none — do NOT invent an owe, and do NOT write that you have no deliverable)";
  const offer = plan.theirOffer ? `- ${plan.theirOffer}` : "(none — skip this)";
  const slots =
    plan.proposedSlotLabels.length > 0
      ? plan.proposedSlotLabels.map((label) => `- ${label}`).join("\n")
      : "(none)";
  const next =
    plan.nextStep.kind === "schedule_call"
      ? plan.proposedSlotLabels.length > 0
        ? `Jason offers these follow-up times (put them in the email; do NOT ask them to send windows):\n${slots}`
        : "Jason will schedule a follow-up — propose a weekday window in plain words. Do NOT ask them to send availability."
      : plan.nextStep.kind === "send_thing"
        ? `Jason's next step: ${plan.nextStep.label}`
        : "No clear next step — end on a short close without inventing a task.";

  return `APPROVED FOLLOW-UP PLAN (write ONLY from this card; do not invent fields):
Hook (open on this — or the closest real detail in the notes/transcript):
${plan.hook ? `- ${plan.hook}` : "(none found — open on one real detail from the notes/transcript; do not invent)"}

Jason owes:
${owes}

What they offered:
${offer}

Next step:
${next}

Rules for this plan:
- If Jason owes is (none), skip any owe sentence entirely.
- If next step is schedule and times are listed, include those times. Never ask them for windows.
- Target 90-150 words. Write less. Close with Best, then Jason.
- Do not narrate their stories back. Do not invent beyond plan + source.`;
}
