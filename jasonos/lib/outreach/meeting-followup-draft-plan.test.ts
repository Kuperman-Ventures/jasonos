import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asksThemForAvailability,
  buildMeetingFollowupDraftPlan,
  draftViolatesApprovedPlan,
  inventsEmptyOweExcuse,
  looksLikeScheduleFollowup,
  pickFollowupHook,
} from "./meeting-followup-draft-plan.ts";

const DANIEL_NOTES = `# Dan Nottingham: Background

- Research scientist at Boston University, then pivoted to healthcare software
- Long career in product management

# AmICredible: What He Built

- Core insight: LLMs alone fail at this (weak sources, hallucinated citations, self-contradiction)
- Built a structured protocol instead:
  - Searches both supporting and contradicting evidence for any claim
  - Scores credibility across ~60-70 sources

# Bordie and Networking

- Both using Bordie (via Browning) for networking

# Next Steps

- **Schedule a follow-up call with Dan**

  Both agreed to put another meeting on the calendar.
`;

const BAD_DANIEL_DRAFT = `Daniel,

The point about LLMs hallucinating citations and contradicting themselves - that's exactly why the structured protocol approach makes sense. Scoring evidence across 60-70 sources without declaring truth or falsehood is a defensible position, especially for the journalists and corporate comms people you're trying to reach.

I don't have a specific deliverable owed from our conversation, but we agreed to schedule a follow-up call. Send me two or three windows that work for you this week or by Friday and I'll confirm one.

Jason`;

describe("Daniel Nottingham follow-up plan", () => {
  it("detects schedule-only next step with no invented owes", () => {
    assert.equal(looksLikeScheduleFollowup(DANIEL_NOTES), true);
    const plan = buildMeetingFollowupDraftPlan({
      summary: DANIEL_NOTES,
      whenPhrase: "Monday",
      recipientFirstName: "Daniel",
      proposedSlots: [
        {
          id: "a",
          start: "2026-11-19T15:00:00.000Z",
          end: "2026-11-19T15:30:00.000Z",
        },
      ],
      proposedSlotLabels: ["Wed. Nov 19 @ 10:00am ET"],
    });
    assert.equal(plan.nextStep.kind, "schedule_call");
    assert.equal(plan.nextStep.owner, "jason");
    assert.deepEqual(plan.jasonOwes, []);
    assert.equal(plan.theirOffer, null);
    assert.match(
      plan.hook ?? "",
      /LLMs alone fail|hallucinated citations|structured protocol/i
    );
    assert.equal(plan.proposedSlotLabels.length, 1);
  });

  it("refuses the shipped Daniel draft against the approved plan", () => {
    const plan = buildMeetingFollowupDraftPlan({
      summary: DANIEL_NOTES,
      whenPhrase: "Monday",
      recipientFirstName: "Daniel",
      proposedSlotLabels: ["Wed. Nov 19 @ 10:00am ET"],
      proposedSlots: [
        {
          id: "a",
          start: "2026-11-19T15:00:00.000Z",
          end: "2026-11-19T15:30:00.000Z",
        },
      ],
    });
    assert.equal(inventsEmptyOweExcuse(BAD_DANIEL_DRAFT), true);
    assert.equal(asksThemForAvailability(BAD_DANIEL_DRAFT), true);
    assert.equal(draftViolatesApprovedPlan(BAD_DANIEL_DRAFT, plan), true);
  });

  it("picks a product hook over background bio", () => {
    const hook = pickFollowupHook(DANIEL_NOTES);
    assert.ok(hook);
    assert.doesNotMatch(hook!, /Research scientist/i);
  });
});

describe("availability ask detector", () => {
  it("catches common phrasings", () => {
    assert.equal(
      asksThemForAvailability("Send me two or three windows that work for you"),
      true
    );
    assert.equal(asksThemForAvailability("What times work for you this week?"), true);
    assert.equal(
      asksThemForAvailability("Here are three times that work on my side."),
      false
    );
  });
});
