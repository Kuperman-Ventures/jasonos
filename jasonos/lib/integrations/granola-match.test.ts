import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calendarIdsMatch,
  normalizePersonName,
  pickGranolaNote,
  type GranolaNoteCandidate,
} from "./granola-match";

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

const wrongSameDay: GranolaNoteCandidate = {
  id: "not_wrong0000001",
  title: "Jason / Shawn catch up",
  createdAt: "2026-10-01T18:00:00.000Z",
  summaryText:
    "Shawn to reciprocate with relevant introductions (Shawn) Committed to looking through his network.",
  attendeeEmails: ["shawn@example.com"],
  attendeeNames: ["Shawn Example"],
  scheduledStart: "2026-10-01T18:00:00.000Z",
  calendarEventId: "othercalendarevent99",
};

/** Real failure mode: Tuomas follow-up was glued to Simon's AEO notes. */
const tuomas: GranolaNoteCandidate = {
  id: "d8dd4581-86be-45ff-8628-d27eb5e0a746",
  title: "Catching up on career paths and the future of agencies with Tuomas",
  createdAt: "2026-09-23T23:58:00.000Z",
  summaryText:
    "Jason and Tuomas (Peltoniemi) catching up after ~10 years, last connected during TBWA days",
  attendeeEmails: ["jason@kupermanadvisors.com"],
  attendeeNames: ["Jason Kuperman"],
  scheduledStart: "2026-09-23T23:58:00.000Z",
};

const simon: GranolaNoteCandidate = {
  id: "f1cb00c5-007c-47f4-ae46-08931cf4c80d",
  title: "Jason K/ Simon B Catch-Up II [if you can make this]",
  createdAt: "2026-09-23T22:00:00.000Z",
  summaryText:
    "AI Search and AEO/GEO Landscape. AEO/GEO differs fundamentally from SEO.",
  attendeeEmails: [
    "jason@kupermanadvisors.com",
    "simon@betaevolution.com.au",
  ],
  attendeeNames: ["Jason Kuperman", "Simon"],
  scheduledStart: "2026-09-23T22:00:00.000Z",
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
      email: "deutsch74@gmail.com",
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

  it("prefers the calendar event id over a same-day name collision", () => {
    const hit = pickGranolaNote([wrongSameDay, matthew], {
      name: "Matthew Deutsch",
      email: "deutsch74@gmail.com",
      aroundIso: "2026-10-01T21:00:00.000Z",
      calendarEventId: "ns83d3ioersuje2p5u7i6d5qg0",
      meetingTitle: "Jason Kuperman/Matthew Deutsch: Connect",
    });
    assert.equal(hit?.id, matthew.id);
  });

  it("refuses a different meeting when the calendar event id does not match", () => {
    const hit = pickGranolaNote([wrongSameDay], {
      name: "Matthew Deutsch",
      email: "deutsch74@gmail.com",
      aroundIso: "2026-10-01T21:00:00.000Z",
      calendarEventId: "ns83d3ioersuje2p5u7i6d5qg0",
    });
    assert.equal(hit, null);
  });

  it("does not accept name-only matches without time or email", () => {
    const hit = pickGranolaNote([matthew], {
      name: "Matthew Deutsch",
    });
    assert.equal(hit, null);
  });

  it("picks Tuomas note for Last, First contact and refuses Simon same day", () => {
    const hit = pickGranolaNote([simon, tuomas], {
      name: "Peltoniemi, Tuomas",
      email: "tuomas.peltoniemi@accenture.com",
      aroundIso: "2026-09-24T00:00:00.000Z",
      calendarEventId:
        "_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g610j6cpp74oj4gpk6go48h1g64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g6cojee9g6co4ad1j88sj6ghk6l0j6dph8cs30c1n6gq38c218kqg",
      meetingTitle: "Tuomas x Jason Connect",
    });
    assert.equal(hit?.id, tuomas.id);
  });

  it("does not glue Simon's AEO summary onto Tuomas when titles do not overlap", () => {
    const hit = pickGranolaNote([simon], {
      name: "Peltoniemi, Tuomas",
      email: "tuomas.peltoniemi@accenture.com",
      aroundIso: "2026-09-24T00:00:00.000Z",
      calendarEventId: "unmatched-outlook-id-xyz",
      meetingTitle: "Tuomas x Jason Connect",
    });
    assert.equal(hit, null);
  });
});

describe("normalizePersonName", () => {
  it("flips Last, First into First Last", () => {
    assert.equal(normalizePersonName("Peltoniemi, Tuomas"), "Tuomas Peltoniemi");
    assert.equal(normalizePersonName("Matthew Deutsch"), "Matthew Deutsch");
  });
});

describe("calendarIdsMatch", () => {
  it("matches exact ids and long suffix instances, not loose substrings", () => {
    assert.equal(
      calendarIdsMatch("ns83d3ioersuje2p5u7i6d5qg0", "ns83d3ioersuje2p5u7i6d5qg0"),
      true
    );
    assert.equal(
      calendarIdsMatch(
        "ns83d3ioersuje2p5u7i6d5qg0_20261001T210000Z",
        "ns83d3ioersuje2p5u7i6d5qg0"
      ),
      true
    );
    assert.equal(
      calendarIdsMatch(
        "4ca63ucmmsmlbaf19sod8sn4r1@google.com",
        "4ca63ucmmsmlbaf19sod8sn4r1"
      ),
      true
    );
    assert.equal(calendarIdsMatch("abc", "xabcy"), false);
  });
});
