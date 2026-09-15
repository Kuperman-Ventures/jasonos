import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  beeperFocusChatIds,
  beeperHrefStrings,
  buildBeeperHrefCascade,
  isFocusableChatId,
  networkKeyFrom,
  toE164,
  walkBeeperHrefCascade,
} from "./beeper-links.ts";

const OFFICE_WHATSAPP_CHAT =
  "!KPFTtZYWuERwib8T702N9IfqiCc:ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc.local-whatsapp.localhost";
const OFFICE_ACCOUNT = "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc";

describe("toE164", () => {
  it("normalizes US numbers to +1", () => {
    assert.equal(toE164("(917) 555-0100"), "+19175550100");
    assert.equal(toE164("+1 917-555-0100"), "+19175550100");
  });
});

describe("networkKeyFrom", () => {
  it("maps local-whatsapp_ba_ accounts to whatsapp", () => {
    assert.equal(networkKeyFrom(OFFICE_ACCOUNT), "whatsapp");
  });

  it("does not double-prefix bridge- accounts", () => {
    assert.equal(networkKeyFrom("bridge-whatsapp"), "whatsapp");
  });
});

describe("beeperFocusChatIds", () => {
  it("prefers numeric localChatID and skips office localhost Matrix ids", () => {
    assert.deepEqual(
      beeperFocusChatIds({
        chatId: OFFICE_WHATSAPP_CHAT,
        localChatId: "5639",
      }),
      ["5639"]
    );
    assert.equal(isFocusableChatId(OFFICE_WHATSAPP_CHAT), false);
    assert.equal(isFocusableChatId("5639"), true);
  });

  it("keeps portable cloud Matrix rooms", () => {
    assert.deepEqual(
      beeperFocusChatIds({ chatId: "!xyz:beeper.local" }),
      ["!xyz:beeper.local"]
    );
  });
});

describe("buildBeeperHrefCascade", () => {
  it("starts with bridge-imessage compose for a phone-only Text", () => {
    const hrefs = beeperHrefStrings({ phone: "(917) 555-0100" });
    assert.equal(
      hrefs[0],
      "beeper://compose/bridge-imessage/+19175550100?accountID=imessage"
    );
    assert.ok(hrefs.includes("beeper://compose/imessage/+19175550100?accountID=imessage"));
    assert.ok(hrefs.includes("sms:+19175550100"));
    assert.ok(hrefs.includes("beeper://focus"));
  });

  it("composes WhatsApp by phone instead of the office localhost chat id", () => {
    const hrefs = beeperHrefStrings({
      chatId: OFFICE_WHATSAPP_CHAT,
      accountId: OFFICE_ACCOUNT,
      network: "WhatsApp",
      phone: "+1 555-111-2222",
    });
    assert.equal(
      hrefs[0],
      "beeper://compose/bridge-whatsapp/+15551112222?accountID=whatsapp"
    );
    assert.equal(
      hrefs.some((href) => href.includes("local-")),
      false
    );
    assert.equal(
      hrefs.some((href) => href.includes(".localhost")),
      false
    );
    assert.equal(
      hrefs.some((href) => href.includes(OFFICE_WHATSAPP_CHAT)),
      false
    );
  });

  it("retries a /user/ compose path after the short compose URLs", () => {
    const hrefs = beeperHrefStrings({
      phone: "9175550100",
      network: "iMessage",
    });
    assert.ok(
      hrefs.includes(
        "beeper://compose/bridge-imessage/user/+19175550100?accountID=imessage"
      )
    );
  });

  it("composes Instagram by handle with bridge-instagramgo", () => {
    const hrefs = beeperHrefStrings({
      accountId: "local-instagram_ba_eRfQ",
      network: "Instagram",
      username: "@mattwondra",
    });
    assert.equal(
      hrefs[0],
      "beeper://compose/bridge-instagramgo/mattwondra?accountID=instagramgo"
    );
  });

  it("uses Copy-chat select-thread only for portable cloud rooms", () => {
    const portable = beeperHrefStrings({
      chatId: "!xyz:beeper.local",
      accountId: "whatsapp",
    });
    assert.ok(
      portable.includes(
        "beeper://select-thread/bridge-whatsapp/!xyz:beeper.local?accountID=whatsapp"
      )
    );

    const officeOnly = beeperHrefStrings({
      chatId: OFFICE_WHATSAPP_CHAT,
      accountId: OFFICE_ACCOUNT,
    });
    assert.equal(
      officeOnly.some((href) => href.includes("select-thread")),
      false
    );
    assert.equal(officeOnly[0], "beeper://focus");
  });

  it("never emits a raw beeper://!chatId link", () => {
    const hrefs = beeperHrefStrings({
      chatId: "!xyz:beeper.local",
      accountId: "whatsapp",
      phone: "+15551112222",
    });
    assert.equal(
      hrefs.some((href) => /^beeper:\/\/!/.test(href)),
      false
    );
  });

  it("caps the list so Text does not fire a dozen Beeper toasts", () => {
    const cascade = buildBeeperHrefCascade({
      phone: "9175550100",
      network: "WhatsApp",
      username: "someone",
      chatId: "!xyz:beeper.local",
      accountId: "whatsapp",
    });
    assert.ok(cascade.length <= 10);
    assert.equal(cascade[0].kind, "compose");
  });
});

describe("walkBeeperHrefCascade", () => {
  it("returns the first href whose attempt succeeds", async () => {
    const tried: string[] = [];
    const href = await walkBeeperHrefCascade(
      ["beeper://compose/a", "beeper://compose/b", "sms:+1"],
      async (candidate) => {
        tried.push(candidate);
        return candidate.endsWith("/b");
      }
    );
    assert.equal(href, "beeper://compose/b");
    assert.deepEqual(tried, ["beeper://compose/a", "beeper://compose/b"]);
  });

  it("returns null when every format fails", async () => {
    const href = await walkBeeperHrefCascade(["a", "b"], async () => false);
    assert.equal(href, null);
  });
});
