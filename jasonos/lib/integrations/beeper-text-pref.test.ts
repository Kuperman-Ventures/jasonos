import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  beeperTextNetworkRank,
  pickPreferredTextChat,
} from "./beeper-text-pref.ts";

describe("beeperTextNetworkRank", () => {
  it("ranks iMessage and SMS first", () => {
    assert.equal(beeperTextNetworkRank({ network: "iMessage" }), 0);
    assert.equal(beeperTextNetworkRank({ accountID: "local-imessage_abc" }), 0);
    assert.equal(beeperTextNetworkRank({ network: "SMS" }), 0);
    assert.equal(beeperTextNetworkRank({ network: "Android SMS" }), 0);
  });

  it("ranks LinkedIn after iMessage", () => {
    assert.equal(beeperTextNetworkRank({ network: "LinkedIn" }), 1);
    assert.equal(beeperTextNetworkRank({ accountID: "linkedin" }), 1);
  });

  it("ranks other networks last", () => {
    assert.equal(beeperTextNetworkRank({ network: "WhatsApp" }), 2);
    assert.equal(beeperTextNetworkRank({ network: "Signal" }), 2);
  });
});

describe("pickPreferredTextChat", () => {
  it("picks iMessage over LinkedIn and WhatsApp", () => {
    const picked = pickPreferredTextChat([
      { id: "li", network: "LinkedIn" },
      { id: "wa", network: "WhatsApp" },
      { id: "im", network: "iMessage" },
    ]);
    assert.equal(picked?.id, "im");
  });

  it("picks LinkedIn when there is no iMessage", () => {
    const picked = pickPreferredTextChat([
      { id: "wa", network: "WhatsApp" },
      { id: "li", network: "LinkedIn" },
    ]);
    assert.equal(picked?.id, "li");
  });

  it("falls back to the remaining match", () => {
    const picked = pickPreferredTextChat([{ id: "wa", network: "WhatsApp" }]);
    assert.equal(picked?.id, "wa");
  });

  it("returns undefined for an empty list", () => {
    assert.equal(pickPreferredTextChat([]), undefined);
  });
});
