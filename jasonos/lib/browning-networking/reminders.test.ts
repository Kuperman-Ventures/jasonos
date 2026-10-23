import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

describe("browning meeting reminders", () => {
  const now = new Date("2026-10-23T15:00:00.000Z");

  it("opens the reminder window inside 24 hours and closes after start", () => {
    assert.equal(isInsideReminderWindow("2026-10-24T14:00:00.000Z", now), true);
    assert.equal(isInsideReminderWindow("2026-10-25T16:00:00.000Z", now), false);
    assert.equal(isInsideReminderWindow("2026-10-23T14:00:00.000Z", now), false);
  });

  it("treats only accepted as cleared for the RSVP alert", () => {
    assert.equal(
      attendeeRsvpStatus(
        [{ email: "alex@example.com", responseStatus: "accepted" }],
        "alex@example.com"
      ),
      "accepted"
    );
    assert.equal(
      attendeeRsvpStatus(
        [{ email: "alex@example.com", responseStatus: "needsAction" }],
        "Alex@example.com"
      ),
      "needsAction"
    );
    assert.equal(attendeeRsvpStatus([], "alex@example.com"), "missing");
    assert.equal(needsRsvpAlert("accepted"), false);
    assert.equal(needsRsvpAlert("needsAction"), true);
    assert.equal(needsRsvpAlert("missing"), true);
  });

  it("writes a short attendee reminder and Jason RSVP alert", () => {
    const startsAt = "2026-10-24T18:00:00.000Z";
    assert.match(attendeeReminderSubject(startsAt), /Reminder — call with Jason Kuperman/);
    const reminder = attendeeReminderBody({
      contactName: "Alex Example",
      startsAt,
      meetUrl: "https://meet.google.com/abc-defg-hij",
      callTitle: "Jason Kuperman/Alex Example: Connect",
    });
    assert.match(reminder, /^Hi Alex,/m);
    assert.match(reminder, /Quick reminder we're on for/);
    assert.match(reminder, /Join link: https:\/\/meet\.google\.com\/abc-defg-hij/);
    assert.match(reminder, /Looking forward to it,\nJason$/);

    const alert = rsvpAlertBody({
      contactName: "Alex Example",
      contactEmail: "alex@example.com",
      startsAt,
      rsvp: "needsAction",
      handoffId: "abc",
    });
    assert.match(rsvpAlertSubject({ contactName: "Alex Example", startsAt }), /has not accepted/);
    assert.match(alert, /has not accepted the invite \(not responded\)/);
    assert.match(alert, /browning-networking\?id=abc/);
  });

  it("builds labeled test examples for Jason", () => {
    const samples = testReminderExamples(now);
    assert.equal(samples.attendee.to, JASON_NOTIFY_EMAIL);
    assert.equal(samples.rsvpAlert.to, JASON_NOTIFY_EMAIL);
    assert.match(samples.attendee.subject, /^\[TEST\] Reminder/);
    assert.match(samples.attendee.body, /This is a TEST of the Browning attendee reminder/);
    assert.match(samples.rsvpAlert.subject, /^\[TEST\].*has not accepted/);
    assert.match(samples.rsvpAlert.body, /This is a TEST of the Browning RSVP alert/);
  });
});
