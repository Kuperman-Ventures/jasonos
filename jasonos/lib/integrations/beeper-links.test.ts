import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  beeperChatDeepLink,
  beeperFocusLink,
  resolveBeeperLink,
  toE164,
} from "./beeper-links.ts";

describe("beeperChatDeepLink", () => {
  it("only emits focus when there is no portable cloud thread", () => {
    assert.equal(beeperChatDeepLink({}), beeperFocusLink());
    assert.equal(
      beeperChatDeepLink({ phone: "+15551112222", network: "WhatsApp" }),
      beeperFocusLink()
    );
    assert.equal(
      resolveBeeperLink({ phone: "+15551112222", network: "WhatsApp" }).targetsChat,
      false
    );
  });

  it("never invents compose URLs (those toast invalid deep link)", () => {
    const href = beeperChatDeepLink({
      accountId: "local-whatsapp_ba_office",
      network: "WhatsApp",
      phone: "+1 555-111-2222",
    });
    assert.equal(href.startsWith("beeper://compose/"), false);
    assert.equal(href, "beeper://focus");
  });

  it("does not put another Mac's local chat id in select-thread", () => {
    assert.equal(
      beeperChatDeepLink({
        chatId:
          "!room:ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc.local-whatsapp.localhost",
        accountId: "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
        phone: "+15551112222",
      }),
      "beeper://focus"
    );
  });

  it("keeps Copy-chat select-thread for portable cloud Matrix rooms", () => {
    assert.equal(
      beeperChatDeepLink({
        chatId: "!xyz:beeper.local",
        accountId: "whatsapp",
      }),
      "beeper://select-thread/bridge-whatsapp/!xyz:beeper.local?accountID=whatsapp"
    );
    assert.equal(
      resolveBeeperLink({
        chatId: "!xyz:beeper.local",
        accountId: "bridge-whatsapp",
      }).href,
      "beeper://select-thread/bridge-whatsapp/!xyz:beeper.local?accountID=whatsapp"
    );
  });

  it("normalizes US phones to E.164", () => {
    assert.equal(toE164("(917) 555-0100"), "+19175550100");
    assert.equal(toE164("+1 917-555-0100"), "+19175550100");
  });
});
