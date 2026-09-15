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
  it("gives a phone two Beeper tries, then iMessage", () => {
    const hrefs = beeperHrefStrings({ phone: "(917) 555-0100" });
    assert.deepEqual(hrefs, [
      "beeper://compose/bridge-imessage/+19175550100?accountID=imessage",
      "beeper://compose/imessage/+19175550100?accountID=imessage",
      "imessage:+19175550100",
      "sms:+19175550100",
    ]);
    const beeper = hrefs.filter((href) => href.startsWith("beeper://"));
    assert.equal(beeper.length, 2);
    assert.equal(hrefs[2], "imessage:+19175550100");
  });

  it("composes WhatsApp once, then iMessage Beeper, then Messages", () => {
    const hrefs = beeperHrefStrings({
      chatId: OFFICE_WHATSAPP_CHAT,
      accountId: OFFICE_ACCOUNT,
      network: "WhatsApp",
      phone: "+1 555-111-2222",
    });
    assert.deepEqual(hrefs, [
      "beeper://compose/bridge-whatsapp/+15551112222?accountID=whatsapp",
      "beeper://compose/bridge-imessage/+15551112222?accountID=imessage",
      "imessage:+15551112222",
      "sms:+15551112222",
    ]);
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
    assert.equal(
      hrefs.some((href) => href.startsWith("imessage:")),
      false
    );
  });

  it("uses Copy-chat select-thread only when there is no phone", () => {
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

  it("does not keep firing Beeper URLs after the second try", () => {
    const cascade = buildBeeperHrefCascade({
      phone: "9175550100",
      network: "WhatsApp",
      username: "someone",
      chatId: "!xyz:beeper.local",
      accountId: "whatsapp",
    });
    const beeper = cascade.filter((c) => c.href.startsWith("beeper://"));
    assert.equal(beeper.length, 2);
    assert.equal(cascade[0].kind, "compose");
    assert.equal(cascade[2].kind, "native-imessage");
  });
});

describe("walkBeeperHrefCascade", () => {
  it("keeps going past Beeper 'success' until Messages opens", async () => {
    const tried: string[] = [];
    const href = await walkBeeperHrefCascade(
      [
        "beeper://compose/a",
        "beeper://compose/b",
        "imessage:+19175550100",
        "sms:+19175550100",
      ],
      async (candidate) => {
        tried.push(candidate);
        // Beeper toast still focuses the app — that is not a stop.
        return candidate.startsWith("imessage:");
      }
    );
    assert.equal(href, "imessage:+19175550100");
    assert.deepEqual(tried, [
      "beeper://compose/a",
      "beeper://compose/b",
      "imessage:+19175550100",
    ]);
  });

  it("returns null when every format fails", async () => {
    const href = await walkBeeperHrefCascade(["a", "b"], async () => false);
    assert.equal(href, null);
  });
});
