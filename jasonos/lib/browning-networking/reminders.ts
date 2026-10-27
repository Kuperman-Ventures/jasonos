// Browning meeting reminder copy and timing.
// ~24h before a booked call: email the contact a reminder (BCC Jason), and
// notify Jason if they still have not accepted the calendar invite.

import { firstName, formatSlotLabel } from "./draft";

/** Look ahead window for sending the reminder / RSVP alert. */
export const MEETING_REMINDER_AHEAD_MS = 24 * 60 * 60 * 1000;

/** Jason gets a BCC/copy of every attendee reminder, and RSVP alerts. */
export const JASON_NOTIFY_EMAIL = "jskuperman@gmail.com";

export type AttendeeRsvpStatus =
  | "accepted"
  | "declined"
  | "tentative"
  | "needsAction"
  | "missing"
  | "unknown";

export function msUntilStart(startsAt: string, now: Date = new Date()): number | null {
  const start = Date.parse(startsAt);
  if (!Number.isFinite(start)) return null;
  return start - now.getTime();
}

/** True once the call is inside the next 24 hours and has not started. */
export function isInsideReminderWindow(
  startsAt: string,
  now: Date = new Date()
): boolean {
  const ms = msUntilStart(startsAt, now);
  if (ms === null) return false;
  return ms > 0 && ms <= MEETING_REMINDER_AHEAD_MS;
}

export function attendeeRsvpStatus(
  attendees: { email?: string | null; responseStatus?: string | null; self?: boolean }[] | null | undefined,
  contactEmail: string | null | undefined
): AttendeeRsvpStatus {
  const want = (contactEmail ?? "").trim().toLowerCase();
  if (!want) return "missing";
  const list = attendees ?? [];
  const match = list.find((row) => (row.email ?? "").trim().toLowerCase() === want);
  if (!match) return "missing";
  const status = (match.responseStatus ?? "").trim();
  if (status === "accepted") return "accepted";
  if (status === "declined") return "declined";
  if (status === "tentative") return "tentative";
  if (status === "needsAction") return "needsAction";
  return "unknown";
}

export function needsRsvpAlert(status: AttendeeRsvpStatus): boolean {
  return status !== "accepted";
}

export function rsvpStatusLabel(status: AttendeeRsvpStatus): string {
  switch (status) {
    case "accepted":
      return "accepted";
    case "declined":
      return "declined";
    case "tentative":
      return "tentative";
    case "needsAction":
      return "not responded";
    case "missing":
      return "not on the invite";
    default:
      return "unknown";
  }
}

export function attendeeReminderSubject(startsAt: string): string {
  return `Reminder - call with Jason Kuperman ${formatSlotLabel(startsAt)}`;
}

export function attendeeReminderBody(input: {
  contactName: string | null;
  startsAt: string;
  meetUrl?: string | null;
  callTitle?: string | null;
}): string {
  const who = firstName(input.contactName);
  const hello = who === "there" ? "Hi," : `Hi ${who},`;
  const when = formatSlotLabel(input.startsAt);
  const title = (input.callTitle ?? "").trim();
  const lines = [
    hello,
    "",
    `Quick reminder we're on for ${when}.`,
  ];
  if (title) lines.push(`It's on the calendar as "${title}".`);
  if (input.meetUrl) {
    lines.push("", `Join link: ${input.meetUrl}`);
  }
  lines.push("", "Looking forward to it,", "Jason");
  return lines.join("\n");
}

export function rsvpAlertSubject(input: {
  contactName: string | null;
  startsAt: string;
}): string {
  const who = (input.contactName ?? "").trim() || "Your Browning contact";
  return `${who} has not accepted - ${formatSlotLabel(input.startsAt)}`;
}

export function rsvpAlertBody(input: {
  contactName: string | null;
  contactEmail: string | null;
  startsAt: string;
  rsvp: AttendeeRsvpStatus;
  meetUrl?: string | null;
  handoffId: string;
}): string {
  const who = (input.contactName ?? "").trim() || "This contact";
  const email = (input.contactEmail ?? "").trim() || "(no email)";
  const when = formatSlotLabel(input.startsAt);
  const status = rsvpStatusLabel(input.rsvp);
  const lines = [
    `${who} (${email}) is on your calendar for ${when} and has not accepted the invite (${status}).`,
    "",
    "Worth a nudge if you still want the call.",
  ];
  if (input.meetUrl) lines.push("", `Meet: ${input.meetUrl}`);
  lines.push(
    "",
    `Browning: https://jasonos.vercel.app/outreach/browning-networking?id=${input.handoffId}`
  );
  return lines.join("\n");
}

/** Sample payloads for Jason to review before real sends go out. */
export function testReminderExamples(now: Date = new Date()): {
  attendee: { to: string; subject: string; body: string };
  rsvpAlert: { to: string; subject: string; body: string };
} {
  const startsAt = new Date(now.getTime() + MEETING_REMINDER_AHEAD_MS - 60 * 60_000).toISOString();
  const meetUrl = "https://meet.google.com/abc-defg-hij";
  const attendeeSubject = `[TEST] ${attendeeReminderSubject(startsAt)}`;
  const attendeeBody = [
    "This is a TEST of the Browning attendee reminder. Review the copy, then ignore.",
    "",
    attendeeReminderBody({
      contactName: "Alex Example",
      startsAt,
      meetUrl,
      callTitle: "Jason Kuperman/Alex Example: Connect",
    }),
  ].join("\n");
  const alertSubject = `[TEST] ${rsvpAlertSubject({
    contactName: "Alex Example",
    startsAt,
  })}`;
  const alertBody = [
    "This is a TEST of the Browning RSVP alert to you. Review the copy, then ignore.",
    "",
    rsvpAlertBody({
      contactName: "Alex Example",
      contactEmail: "alex.example@example.com",
      startsAt,
      rsvp: "needsAction",
      meetUrl,
      handoffId: "00000000-0000-0000-0000-000000000000",
    }),
  ].join("\n");
  return {
    attendee: {
      to: "jskuperman@gmail.com",
      subject: attendeeSubject,
      body: attendeeBody,
    },
    rsvpAlert: {
      to: "jskuperman@gmail.com",
      subject: alertSubject,
      body: alertBody,
    },
  };
}
