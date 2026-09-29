import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickGranolaNote, type GranolaNoteCandidate } from "./granola-match";

const matthew: GranolaNoteCandidate = {
  id: "not_matthew000001",
  title: "Jason Kuperman/Matthew Deutsch: Connect",
  createdAt: "2026-10-01T21:05:00.000Z",
  summaryText: "Matthew walked through the commercialization handoff at Chaos.",
  attendeeEmails: ["deutsch74@gmail.com"],
  attendeeNames: ["Matthew Deutsch"],
  scheduledStart: "2026-10-01T21:00:00.000Z",
  calendarEventId: "ns83d3ioersuje2p5u7i6d5qg0",
};

const other: GranolaNoteCandidate = {
  id: "not_other0000001",
  title: "Weekly advisors",
  createdAt: "2026-10-01T15:00:00.000Z",
  summaryText: "Unrelated.",
  attendeeEmails: ["someone@example.com"],
  scheduledStart: "2026-10-01T15:00:00.000Z",
};

describe("pickGranolaNote", () => {
  it("picks the note whose title and email match the call", () => {
    const hit = pickGranolaNote([other, matthew], {
      name: "Matthew Deutsch",
      email: "deutsch74@gmail.com",
      aroundIso: "2026-10-01T21:00:00.000Z",
    });
    assert.equal(hit?.id, matthew.id);
  });

  it("matches Matt to Matthew when the last name is in the title", () => {
    const hit = pickGranolaNote([matthew], {
      name: "Matt Deutsch",
      aroundIso: "2026-10-01T21:00:00.000Z",
    });
    assert.equal(hit?.id, matthew.id);
  });

  it("does not pick a note that only happens near the call", () => {
    const hit = pickGranolaNote([other], {
      name: "Matthew Deutsch",
      email: "deutsch74@gmail.com",
      aroundIso: "2026-10-01T21:00:00.000Z",
    });
    assert.equal(hit, null);
  });
});
