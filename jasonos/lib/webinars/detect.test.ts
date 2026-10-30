import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectWebinarSessions,
  isWebinarCalendarEvent,
  isWebinarNote,
  normalizeTitleWords,
  noteMatchesEvent,
  sessionKeyForEvent,
  sessionKeyForNote,
  type WebinarCalendarEvent,
  type WebinarNote,
} from "./detect.ts";

function note(partial: Partial<WebinarNote> & Pick<WebinarNote, "id" | "title">): WebinarNote {
  return {
    source: "granola",
    createdAt: "2026-10-22T15:00:00.000Z",
    scheduledStart: "2026-10-22T15:00:00.000Z",
    folders: [],
    durationMinutes: null,
    participantCount: 5,
    url: null,
    ...partial,
  };
}

describe("normalizeTitleWords", () => {
  it("drops short and stop words", () => {
    const words = normalizeTitleWords(
      "Who Owns the Customer When AI Owns the Conversation?"
    );
    assert.ok(words.includes("owns"));
    assert.ok(words.includes("customer"));
    assert.ok(words.includes("conversation"));
    assert.ok(!words.includes("the"));
    assert.ok(!words.includes("who"));
    assert.ok(!words.includes("ai"));
  });
});

describe("isWebinarCalendarEvent", () => {
  it("flags event-platform organizers", () => {
    assert.equal(
      isWebinarCalendarEvent({
        id: "1",
        summary: "Maryland Product Symposium 2026",
        organizer: { email: "calendar-invite@lu.ma" },
      }),
      true
    );
  });

  it("flags webinar links in location or description", () => {
    assert.equal(
      isWebinarCalendarEvent({
        id: "2",
        summary: "Zoom webinar",
        location: "https://events.zoom.us/e/abc",
      }),
      true
    );
    assert.equal(
      isWebinarCalendarEvent({
        id: "3",
        summary: "Sequel",
        description: "Join at sequel.io/events/x",
      }),
      true
    );
  });

  it("flags FROM_GMAIL with Jason as only attendee", () => {
    assert.equal(
      isWebinarCalendarEvent({
        id: "4",
        summary: "From prompt to citation",
        eventType: "fromGmail",
        organizer: { email: "jason@kupermanadvisors.com", self: true },
        attendees: [{ email: "jason@kupermanadvisors.com", self: true }],
      }),
      true
    );
  });

  it("skips cancelled events", () => {
    assert.equal(
      isWebinarCalendarEvent({
        id: "5",
        status: "cancelled",
        organizer: { email: "calendar-invite@lu.ma" },
      }),
      false
    );
  });
});

describe("isWebinarNote", () => {
  it("flags folder names", () => {
    assert.equal(
      isWebinarNote(note({ id: "n1", title: "Bain", folders: ["Learning"] })),
      true
    );
  });

  it("flags solo long notes", () => {
    assert.equal(
      isWebinarNote(
        note({
          id: "n2",
          title: "Solo",
          participantCount: 1,
          durationMinutes: 45,
        })
      ),
      true
    );
    assert.equal(
      isWebinarNote(
        note({
          id: "n3",
          title: "Short",
          participantCount: 1,
          durationMinutes: 10,
        })
      ),
      false
    );
  });
});

describe("detectWebinarSessions", () => {
  it("matches a calendar event to a note and sets session_key", () => {
    const ev: WebinarCalendarEvent & { end?: { dateTime?: string } } = {
      id: "evt-md",
      summary: "Maryland Product Symposium 2026",
      organizer: { email: "calendar-invite@lu.ma" },
      start: { dateTime: "2026-10-22T15:00:00.000Z" },
      end: { dateTime: "2026-10-22T17:00:00.000Z" },
      htmlLink: "https://calendar.google.com/event?eid=md",
    };
    const granola = note({
      id: "g-md",
      title: "Maryland Product Symposium 2026",
      scheduledStart: "2026-10-22T15:05:00.000Z",
      source: "granola",
      folders: ["Events"],
      url: "https://notes.granola.ai/d/g-md",
    });
    const sessions = detectWebinarSessions({ events: [ev], notes: [granola] });
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.detection, "calendar_and_note");
    assert.equal(sessions[0]?.session_key, sessionKeyForEvent("evt-md"));
    assert.equal(sessions[0]?.transcript_source, "granola");
    assert.equal(sessions[0]?.transcript_note_id, "g-md");
  });

  it("keeps calendar_only when there is no note", () => {
    const sessions = detectWebinarSessions({
      events: [
        {
          id: "evt-only",
          summary: "From prompt to citation",
          eventType: "fromGmail",
          start: { dateTime: "2026-10-21T18:00:00.000Z" },
          attendees: [{ email: "jason@kupermanadvisors.com", self: true }],
        },
      ],
      notes: [],
    });
    assert.equal(sessions[0]?.detection, "calendar_only");
    assert.equal(sessions[0]?.transcript_note_id, null);
  });

  it("emits note_folder and note_solo_long for unmatched notes", () => {
    const sessions = detectWebinarSessions({
      events: [],
      notes: [
        note({
          id: "bain",
          title: "Bain AI search measurement",
          folders: ["Webinars"],
          scheduledStart: "2026-10-23T16:00:00.000Z",
        }),
        note({
          id: "solo",
          title: "Long listen",
          folders: [],
          participantCount: 0,
          durationMinutes: 60,
          scheduledStart: "2026-10-24T16:00:00.000Z",
        }),
      ],
    });
    const byId = Object.fromEntries(
      sessions.map((s) => [s.transcript_note_id, s.detection])
    );
    assert.equal(byId.bain, "note_folder");
    assert.equal(byId.solo, "note_solo_long");
    assert.equal(sessions.find((s) => s.transcript_note_id === "bain")?.session_key, sessionKeyForNote("granola", "bain"));
  });

  it("skips notes already on a Live deck", () => {
    const sessions = detectWebinarSessions({
      events: [],
      notes: [
        note({
          id: "decked",
          title: "Already used",
          folders: ["Learning"],
        }),
      ],
      deckNoteIds: ["decked"],
    });
    assert.equal(sessions.length, 0);
  });

  it("matches by shared title words across a 20-minute gap", () => {
    const ev = {
      id: "evt-cust",
      summary: "Who Owns the Customer When AI Owns the Conversation?",
      location: "https://lu.ma/abc",
      start: { dateTime: "2026-10-14T16:00:00.000Z" },
    };
    const wispr = note({
      id: "w1",
      source: "wispr",
      title: "Who Owns the Customer When AI Owns the Conversation recording",
      scheduledStart: "2026-10-14T16:12:00.000Z",
      folders: [],
      participantCount: 1,
      durationMinutes: 55,
    });
    assert.equal(noteMatchesEvent(wispr, ev), true);
    const sessions = detectWebinarSessions({ events: [ev], notes: [wispr] });
    assert.equal(sessions[0]?.detection, "calendar_and_note");
    assert.equal(sessions[0]?.transcript_source, "wispr");
  });
});
