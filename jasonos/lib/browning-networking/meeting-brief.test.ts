import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isConnectTitleGoal,
  isPollutedMeetingBrief,
  meetingBrief,
  prepSections,
} from "./meeting-brief";
import { HANDOFF_OPENING } from "./types";

describe("meeting brief", () => {
  it("writes a short overview from the resume and Tracy's specific lines", () => {
    const brief = meetingBrief({
      name: "Matthew Deutsch",
      whyTheyReplied: "I replied because your note on commercialization matched our work.",
      tracyBody: `${HANDOFF_OPENING} with Jason Kuperman.
You two should talk about who is hiring GTM leaders.
Matthew has been commercializing a product, and that overlaps with your work.
I hope that you and Jason Kuperman will find this mutually beneficial.
(551) 427-6711
-----Original Message-----
From: Matthew Deutsch <deutsch74@gmail.com>
I replied because your note on commercialization matched our work.`,
      resumeText: `Matthew Deutsch
deutsch74@gmail.com
PROFESSIONAL SUMMARY:
Operator who has built go-to-market teams inside retail media companies.
VP Marketing, Northline 2019-2024
Built the go-to-market team from four people to twenty.
Launched a retail media offer with the sales lead.`,
    });
    assert.ok(brief);
    assert.match(brief ?? "", /Who they are/);
    assert.match(brief ?? "", /Northline 2019-2024/);
    assert.match(brief ?? "", /go-to-market teams/);
    assert.match(brief ?? "", /Why Tracy thinks you should talk/);
    assert.match(brief ?? "", /commercializing a product/);
    assert.match(brief ?? "", /What to talk about/);
    assert.match(brief ?? "", /hiring GTM leaders/);
    assert.match(brief ?? "", /Resume/);
    assert.match(brief ?? "", /four people to twenty/);
    assert.doesNotMatch(brief ?? "", /mutually beneficial/);
    assert.doesNotMatch(brief ?? "", /Thank you for your reply/);
    assert.doesNotMatch(brief ?? "", /551/);
    assert.doesNotMatch(brief ?? "", /deutsch74/);
    const sections = prepSections(brief ?? "");
    assert.equal(sections.length, 4);
  });

  it("skips Tracy's template when she does not add a specific reason", () => {
    const brief = meetingBrief({
      name: "Matthew Deutsch",
      whyTheyReplied: null,
      tracyBody: `${HANDOFF_OPENING} with Jason Kuperman.
Good Morning Matt,
I hope that you and Jason Kuperman will find this mutually beneficial.
I am copying Jason Kuperman on this email, and hopefully the two of you will be able to connect soon.
I would recommend connecting via LinkedIn prior to your conversation.`,
      resumeText: `Chaos (Cylindo), Boston MA Nov 2021 – Feb 2025
Directed the Project Management department, overseeing delivery of 3D assets for furniture retailers.
Managed a global team of 17 project managers delivering over 2,350 projects a year.`,
    });
    assert.match(brief ?? "", /Who they are/);
    assert.match(brief ?? "", /Chaos \(Cylindo\)/);
    assert.match(brief ?? "", /Resume/);
    assert.match(brief ?? "", /global team of 17/);
    assert.doesNotMatch(brief ?? "", /Why Tracy thinks you should talk/);
    assert.doesNotMatch(brief ?? "", /What to talk about/);
    assert.doesNotMatch(brief ?? "", /mutually beneficial/);
    assert.doesNotMatch(brief ?? "", /LinkedIn/);
  });

  it("drops Tracy's signature and Matt's scheduling quote from Why", () => {
    const brief = meetingBrief({
      name: "Matthew Deutsch",
      whyTheyReplied: null,
      tracyBody: `Good Morning Matt,
(551-427-6711)
Thank you for your reply and interest in Executive Networking with Jason Kuperman.
Best Wishes, Tracy --- Tracy SantaMaria Browning Associates On 2026-09-23 12:53, Matt Deutsch wrote: > Hi Tracery, > > I am happy to connect with Jason. I am available Thursday, or Friday > after 5pm or any day next week after 5.`,
      resumeText: `Chaos (Cylindo), Boston MA Nov 2021 – Feb 2025 Director Project Management
Directed the Project Management department, overseeing the timely delivery of 3D assets and projects for 150+ B2B and B2C furniture retailers.
Managed a global team of 17 project managers delivering over 2,350 projects and 42,760 assets annually.`,
    });
    assert.match(brief ?? "", /Who they are/);
    assert.match(brief ?? "", /Chaos \(Cylindo\)/);
    assert.match(brief ?? "", /Resume/);
    assert.doesNotMatch(brief ?? "", /Why Tracy thinks you should talk/);
    assert.doesNotMatch(brief ?? "", /Best Wishes/);
    assert.doesNotMatch(brief ?? "", /Tracy SantaMaria/);
    assert.doesNotMatch(brief ?? "", /after 5pm/);
    assert.doesNotMatch(brief ?? "", /wrote:/);
    assert.equal(isPollutedMeetingBrief(brief), false);
    assert.equal(
      isPollutedMeetingBrief(
        "Who they are\nChaos\n\nWhy Tracy thinks you should talk\nBest Wishes, Tracy --- Tracy SantaMaria"
      ),
      true
    );
    assert.equal(
      isConnectTitleGoal("Jason Kuperman/Matthew Deutsch: Connect", "Matthew Deutsch"),
      true
    );
  });
});
