import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmailContextPacket,
  collectParticipantTargets,
  emailContextIsStale,
  stripQuotedReply,
} from "./email-context-text";

describe("collectParticipantTargets", () => {
  it("drops Jason's addresses and keeps the other person's domain", () => {
    const targets = collectParticipantTargets([
      { email: "jason@kupermanadvisors.com" },
      { email: "John@VantaFive.com" },
      { email: "friend@gmail.com" },
    ]);
    assert.deepEqual(targets.addresses, ["john@vantafive.com", "friend@gmail.com"]);
    assert.deepEqual(targets.domains, ["vantafive.com"]);
  });
});

describe("stripQuotedReply", () => {
  it("drops quoted lines and the original message", () => {
    const text = stripQuotedReply(
      "Thursday works.\n\nOn Mon, Oct 13, 2026, Cynthia wrote:\n> Can we move it?"
    );
    assert.equal(text, "Thursday works.");
  });
});

describe("buildEmailContextPacket", () => {
  it("keeps the newest three messages and stays under the cap", () => {
    const packet = buildEmailContextPacket([
      {
        id: "t1",
        subject: "Trident intro",
        participants: ["cynthia@vantafive.com"],
        messages: [1, 2, 3, 4].map((n) => ({
          from: "cynthia@vantafive.com",
          to: "jason@kupermanadvisors.com",
          cc: "",
          date: `2026-10-1${n}T15:00:00Z`,
          text: `Message ${n}`,
        })),
      },
    ]);
    assert.match(packet, /Message 4/);
    assert.match(packet, /Message 2/);
    assert.doesNotMatch(packet, /Message 1/);
    assert.ok(packet.length <= 6000);
  });
});

describe("emailContextIsStale", () => {
  it("is stale when missing or older than a day", () => {
    const now = new Date("2026-10-19T18:00:00Z");
    assert.equal(emailContextIsStale(null, now), true);
    assert.equal(emailContextIsStale("2026-10-18T17:00:00Z", now), true);
    assert.equal(emailContextIsStale("2026-10-19T12:00:00Z", now), false);
  });
});
