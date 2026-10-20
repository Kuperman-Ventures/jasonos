import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleDraftPrompt } from "./draft-context.ts";
import { buildMeetingPointsUserMessage } from "./points.ts";
import type { MeetingContext } from "./context-model.ts";

function emptyContext(overrides: Partial<MeetingContext> = {}): MeetingContext {
  return {
    people: [],
    unmatched: [],
    connections: [],
    history: [],
    documents: [],
    pastMeetings: [],
    jobSearch: [],
    home: {
      touchCount: 0,
      emailThreadCount: 0,
      lastContactAt: null,
      lastContactChannel: null,
      hasBrowningIntro: false,
      hasLinkedIn: false,
    },
    brief: {
      summary: null,
      nextMove: null,
      commitments: [],
      remember: [],
      helped: [],
      topics: [],
      provenance: [],
    },
    briefing: {
      whereItStands: null,
      yourStake: null,
      introduction: null,
      meetingThread: null,
      otherThreads: [],
    },
    granolaNotes: [],
    recentEmail: null,
    ...overrides,
  };
}

describe("assembleDraftPrompt packet", () => {
  it("puts resume text and intro reason into the user message", () => {
    const context = emptyContext({
      people: [
        {
          contactId: "c1",
          email: "tobias@example.com",
          name: "Tobias Töpel",
          title: "VP Product",
          company: "Acme",
          linkedinUrl: "https://www.linkedin.com/in/tobias",
          relationshipType: null,
          intent: null,
          networkRole: null,
          notes: null,
          personalGoal: null,
          phone: null,
          referredByName: "Tracy",
          researchLead: null,
          researchBullets: [],
          researchSources: [],
          researchAt: null,
          researchEmpty: true,
          companyResearch: null,
          tracks: ["job_search"],
          browningPrep: null,
          tags: ["source:browning"],
          packet: {
            resumeText: "Led marketplace growth at Acme for three years.",
            introReason: "Happy to meet Jason. Tracy said we both know operator work.",
            linkedinUrls: ["https://www.linkedin.com/in/tobias"],
            otherDocuments: [],
          },
          openCommitments: [],
          remember: [],
          helped: [],
          topics: [],
          nextMove: null,
          relationshipSummary: null,
          directTouchCount: 0,
          lastTouchAt: null,
        },
      ],
    });

    const assembled = assembleDraftPrompt(
      {
        title: "Jason / Tobias",
        purpose: "First networking call",
        outcomeSentence: null,
        projectGoal: null,
        personalGoal: null,
        attendees: [{ email: "tobias@example.com", name: "Tobias Töpel" }],
        track: "job_search",
      },
      context,
      []
    );

    assert.ok(assembled.contextUsed.includes("Browning packet"));
    const message = buildMeetingPointsUserMessage(assembled.input);
    assert.match(message, /Led marketplace growth at Acme/);
    assert.match(message, /Why Browning connected us/);
    assert.match(message, /Happy to meet Jason/);
    assert.match(message, /Their background \(from the Browning packet\)/);

    const sampleAdapted =
      "I was impressed by your marketplace growth work at Acme — still there?";
    assert.equal(/\[[^\]]+\]/.test(sampleAdapted), false);
  });

  it("marks packet missing for job_search when absent", () => {
    const assembled = assembleDraftPrompt(
      {
        title: "Call",
        purpose: null,
        outcomeSentence: null,
        projectGoal: null,
        personalGoal: null,
        attendees: [],
        track: "job_search",
      },
      emptyContext(),
      []
    );
    assert.ok(assembled.contextMissing.includes("Browning packet"));
  });
});
