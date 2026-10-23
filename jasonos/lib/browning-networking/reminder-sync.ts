import "server-only";

import { sendGmailMessage } from "@/lib/integrations/gmail";
import {
  deliverEmailViaCalendarInvite,
  getPrimaryCalendarEvent,
} from "@/lib/integrations/google-calendar";
import {
  ADVISORS_ACCOUNT_EMAIL,
  listGoogleAccessTokens,
} from "@/lib/integrations/google-tokens";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import {
  attendeeReminderBody,
  attendeeReminderSubject,
  attendeeRsvpStatus,
  isInsideReminderWindow,
  JASON_NOTIFY_EMAIL,
  needsRsvpAlert,
  rsvpAlertBody,
  rsvpAlertSubject,
  testReminderExamples,
} from "./reminders";

export { JASON_NOTIFY_EMAIL };

type Sb = ReturnType<typeof createServiceRoleClient>;

export type ReminderSyncResult = {
  ok: true;
  remindersSent: number;
  rsvpAlertsSent: number;
  warning?: string;
};

async function advisorsToken(): Promise<string | null> {
  const tokens = await listGoogleAccessTokens();
  return tokens.find((row) => row.accountEmail === ADVISORS_ACCOUNT_EMAIL)?.token ?? null;
}

/** Attendee reminder: prefer Gmail (BCC Jason). Calendar invite is the fallback. */
async function sendAttendeeReminder(input: {
  token: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ ok: true; via: "gmail" | "calendar" } | { ok: false; error: string }> {
  const gmail = await sendGmailMessage({
    accessToken: input.token,
    to: input.to,
    bcc: JASON_NOTIFY_EMAIL,
    subject: input.subject,
    body: input.body,
  });
  if (gmail.ok) return { ok: true, via: "gmail" };

  // No gmail.send yet — calendar invite to the attendee; Jason gets a notify copy
  // (not a second calendar invite).
  const toAttendee = await deliverEmailViaCalendarInvite({
    token: input.token,
    to: input.to,
    subject: input.subject,
    body: input.body,
  });
  if (!toAttendee.ok) {
    return { ok: false, error: gmail.error || toAttendee.error };
  }
  await notify({
    source: "browning_networking",
    title: `Copy — ${input.subject}`,
    body: [`Reminder also sent to ${input.to}.`, "", input.body].join("\n"),
    severity: "info",
    category: "deadline",
  });
  return { ok: true, via: "calendar" };
}

/**
 * RSVP alert to Jason: JasonOS notification only (Slack / Action Queue alerts).
 * Never a Google Calendar invite — the attendee reminder is the Google path.
 */
async function sendRsvpAlertToJason(input: {
  subject: string;
  body: string;
}): Promise<{ ok: true; via: "notify" }> {
  await notify({
    source: "browning_networking",
    title: input.subject,
    body: input.body,
    severity: "warn",
    category: "deadline",
  });
  return { ok: true, via: "notify" };
}

function meetUrlFromEvent(event: {
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { uri?: string; entryPointType?: string }[] };
}): string | null {
  return (
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((point) => point.entryPointType === "video")?.uri ??
    null
  );
}

export async function syncBrowningMeetingReminders(
  sb: Sb,
  now: Date = new Date()
): Promise<ReminderSyncResult> {
  const token = await advisorsToken();
  if (!token) {
    return {
      ok: true,
      remindersSent: 0,
      rsvpAlertsSent: 0,
      warning: "Advisors Google is not connected, so meeting reminders did not send.",
    };
  }

  const { data, error } = await sb
    .from("browning_handoffs")
    .select(
      "id, contact_name, contact_email, call_title, call_starts_at, call_ends_at, call_event_id, attendee_reminder_sent_at, rsvp_alert_sent_at, status"
    )
    .not("call_starts_at", "is", null)
    .is("attendee_reminder_sent_at", null)
    .not("status", "eq", "dismissed")
    .limit(50);
  const { data: rsvpRows, error: rsvpError } = await sb
    .from("browning_handoffs")
    .select(
      "id, contact_name, contact_email, call_title, call_starts_at, call_ends_at, call_event_id, attendee_reminder_sent_at, rsvp_alert_sent_at, status"
    )
    .not("call_starts_at", "is", null)
    .is("rsvp_alert_sent_at", null)
    .not("status", "eq", "dismissed")
    .limit(50);

  if (error || rsvpError) {
    return {
      ok: true,
      remindersSent: 0,
      rsvpAlertsSent: 0,
      warning: (error ?? rsvpError)?.message ?? "Could not load handoffs.",
    };
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of [...(data ?? []), ...(rsvpRows ?? [])]) {
    byId.set(String((row as { id: string }).id), row as Record<string, unknown>);
  }

  let remindersSent = 0;
  let rsvpAlertsSent = 0;
  let warning: string | undefined;

  for (const row of byId.values()) {
    const id = String(row.id);
    const startsAt = (row.call_starts_at as string | null) ?? null;
    if (!startsAt || !isInsideReminderWindow(startsAt, now)) continue;

    const contactEmail = ((row.contact_email as string | null) ?? "").trim();
    const contactName = (row.contact_name as string | null) ?? null;
    const eventId = (row.call_event_id as string | null) ?? null;
    let meetUrl: string | null = null;
    let attendees: { email?: string; responseStatus?: string; self?: boolean }[] = [];

    if (eventId) {
      const loaded = await getPrimaryCalendarEvent(token, eventId);
      if (loaded.ok) {
        meetUrl = meetUrlFromEvent(loaded.event);
        attendees = loaded.event.attendees ?? [];
      } else if (!warning) {
        warning = loaded.error;
      }
    }

    if (!row.attendee_reminder_sent_at && contactEmail) {
      const subject = attendeeReminderSubject(startsAt);
      const body = attendeeReminderBody({
        contactName,
        startsAt,
        meetUrl,
        callTitle: (row.call_title as string | null) ?? null,
      });
      const sent = await sendAttendeeReminder({
        token,
        to: contactEmail,
        subject,
        body,
      });
      if (sent.ok) {
        const { error: updateError } = await sb
          .from("browning_handoffs")
          .update({ attendee_reminder_sent_at: now.toISOString() })
          .eq("id", id);
        if (!updateError) remindersSent += 1;
        else warning = updateError.message;
      } else {
        warning = sent.error;
      }
    }

    if (!row.rsvp_alert_sent_at) {
      const rsvp = attendeeRsvpStatus(attendees, contactEmail);
      if (!needsRsvpAlert(rsvp)) {
        await sb
          .from("browning_handoffs")
          .update({ rsvp_alert_sent_at: now.toISOString() })
          .eq("id", id);
      } else {
        const subject = rsvpAlertSubject({ contactName, startsAt });
        const body = rsvpAlertBody({
          contactName,
          contactEmail,
          startsAt,
          rsvp,
          meetUrl,
          handoffId: id,
        });
        const sent = await sendRsvpAlertToJason({ subject, body });
        if (sent.ok) {
          const { error: updateError } = await sb
            .from("browning_handoffs")
            .update({ rsvp_alert_sent_at: now.toISOString() })
            .eq("id", id);
          if (!updateError) rsvpAlertsSent += 1;
          else warning = updateError.message;
        }
      }
    }
  }

  return warning
    ? { ok: true, remindersSent, rsvpAlertsSent, warning }
    : { ok: true, remindersSent, rsvpAlertsSent };
}

/** Send both sample emails to Jason for copy review. Does not touch handoff rows. */
export async function sendBrowningReminderTestExamples(): Promise<
  | { ok: true; via: string; warning?: string }
  | { ok: false; error: string }
> {
  const token = await advisorsToken();
  if (!token) {
    return { ok: false, error: "Advisors Google is not connected." };
  }
  const samples = testReminderExamples();

  // Sample "attendee" is Jason — Gmail BCC also goes to him (harmless duplicate).
  const reminder = await sendAttendeeReminder({
    token,
    to: samples.attendee.to,
    subject: samples.attendee.subject,
    body: samples.attendee.body,
  });
  if (!reminder.ok) return { ok: false, error: reminder.error };

  const alert = await sendRsvpAlertToJason({
    subject: samples.rsvpAlert.subject,
    body: samples.rsvpAlert.body,
  });

  return {
    ok: true,
    via: `${reminder.via}+${alert.via}`,
    warning:
      reminder.via === "calendar"
        ? "Attendee reminder sample used calendar delivery (reconnect Advisors Google for Gmail send + BCC). RSVP alert used JasonOS notify — not a calendar invite."
        : undefined,
  };
}
