import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEmailBodyWithBlurbs } from "./blurbs.ts";
import type { NetworkScreenCandidate, NetworkScreenDetail } from "./types.ts";

const BODY = "Hello.\n\n- Jason";

function person(
  overrides: Partial<NetworkScreenCandidate> & Pick<NetworkScreenCandidate, "id" | "name">
): NetworkScreenCandidate {
  return {
    screenId: "screen",
    headline: null,
    title: "CEO",
    company: "Acme",
    location: null,
    linkedinUrl: null,
    linkedinDegree: "2nd",
    mutualConnections: null,
    bucket: "hiring_path",
    tier: "tier1",
    why: "Hires the marketing seat",
    ask: "Ask for an intro",
    lane: "job_search",
    introBlurb: null,
    introBlurbGeneratedAt: null,
    nextAction: null,
    queueStatus: "queued",
    introRequestedAt: null,
    contactId: null,
    scoredBy: "ai",
    sortOrder: 0,
    ...overrides,
  };
}

function screen(
  overrides: Partial<NetworkScreenDetail> & Pick<NetworkScreenDetail, "candidates">
): NetworkScreenDetail {
  return {
    id: "screen",
    connectorContactId: "contact",
    connectorLinkedinUrl: "https://www.linkedin.com/in/ada",
    connectorName: "Ada Lovelace",
    connectorHeadline: null,
    connectorCompany: null,
    connectorLocation: null,
    connectorDegree: "1st",
    connectorEmail: null,
    partnerNote: null,
    relationshipWarmth: "new",
    meetingNotesSummary: null,
    openCommitments: null,
    visibleCount: 2,
    totalCountLabel: null,
    status: "drafted",
    draftSubject: "Intros",
    draftBody: BODY,
    includeBlurbsInEmail: false,
    requestedAt: null,
    createdAt: "2026-10-25T00:00:00.000Z",
    updatedAt: "2026-10-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildEmailBodyWithBlurbs", () => {
  const ada = person({ id: "ada", name: "Ada Lovelace", sortOrder: 0, introBlurb: "Ada blurb" });
  const grace = person({
    id: "grace",
    name: "Grace Hopper",
    sortOrder: 1,
    introBlurb: "Grace blurb",
  });

  it("returns the body unchanged when the toggle is off", () => {
    const result = buildEmailBodyWithBlurbs(
      screen({ includeBlurbsInEmail: false, relationshipWarmth: "warm", candidates: [ada, grace] })
    );
    assert.equal(result, BODY);
  });

  it("appends both blurbs when the toggle is on", () => {
    const result = buildEmailBodyWithBlurbs(
      screen({ includeBlurbsInEmail: true, relationshipWarmth: "warm", candidates: [ada, grace] })
    );
    assert.equal(
      result,
      `${BODY}\n\nTo make this easy, here is a note you can forward for each person. Edit anything that does not sound like you.\n\nAda Lovelace:\nAda blurb\n\nGrace Hopper:\nGrace blurb`
    );
  });

  it("leaves out a person who is not in the ask", () => {
    const result = buildEmailBodyWithBlurbs(
      screen({ includeBlurbsInEmail: true, relationshipWarmth: "new", candidates: [ada, grace] })
    );
    assert.match(result, /Ada Lovelace:\nAda blurb/);
    assert.doesNotMatch(result, /Grace Hopper/);
  });

  it("skips a person with an empty blurb", () => {
    const empty = person({ id: "empty", name: "Empty Person", sortOrder: 1, introBlurb: "  " });
    const result = buildEmailBodyWithBlurbs(
      screen({ includeBlurbsInEmail: true, relationshipWarmth: "warm", candidates: [ada, empty] })
    );
    assert.match(result, /Ada Lovelace:\nAda blurb/);
    assert.doesNotMatch(result, /Empty Person/);
  });
});
