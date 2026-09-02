import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  beeperChatDeepLink,
  beeperTextFallbackLink,
  resolveBeeperLink,
} from "./beeper-links.ts";

describe("beeperChatDeepLink", () => {
  it("opens the app when there is no portable recipient or cloud thread", () => {
    assert.equal(beeperChatDeepLink({}), "beeper://focus");
    assert.equal(
      beeperChatDeepLink({ chatId: "!abc:beeper.com" }),
      "beeper://focus"
    );
    assert.equal(
      resolveBeeperLink({ chatId: "!abc:beeper.com" }).gap,
      "missing_recipient"
    );
  });

  it("does not deep-link a laptop with another Mac's local chat id alone", () => {
    assert.equal(
      beeperChatDeepLink({
        chatId:
          "!KPFTtZYWuERwib8T702N9IfqiCc:ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc.local-whatsapp.localhost",
        accountId: "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
      }),
      "beeper://focus"
    );
  });

  it("composes via phone with bridge-whatsapp (not local-whatsapp)", () => {
    assert.equal(
      beeperChatDeepLink({
        chatId:
          "!KPFTtZYWuERwib8T702N9IfqiCc:ba_office.local-whatsapp.localhost",
        accountId: "local-whatsapp_ba_office",
        network: "WhatsApp",
        phone: "+1 555-111-2222",
      }),
      "beeper://compose/bridge-whatsapp/+15551112222?accountID=whatsapp"
    );
  });

  it("maps local-whatsapp_ba_ accounts to short accountID=whatsapp", () => {
    const href = beeperChatDeepLink({
      accountId: "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
      phone: "9175550100",
    });
    assert.equal(
      href,
      "beeper://compose/bridge-whatsapp/+19175550100?accountID=whatsapp"
    );
    assert.equal(href.includes("local-"), false);
    assert.equal(href.includes("ba_"), false);
  });

  it("uses bridge-imessage compose when Text only has a phone", () => {
    assert.equal(
      beeperChatDeepLink({ phone: "(917) 555-0100" }),
      "beeper://compose/bridge-imessage/+19175550100?accountID=imessage"
    );
    assert.equal(
      beeperTextFallbackLink("(917) 555-0100"),
      "beeper://compose/bridge-imessage/+19175550100?accountID=imessage"
    );
  });

  it("composes Instagram by handle with bridge-instagramgo", () => {
    assert.equal(
      beeperChatDeepLink({
        accountId: "local-instagram_ba_eRfQ",
        network: "Instagram",
        username: "@mattwondra",
      }),
      "beeper://compose/bridge-instagramgo/mattwondra?accountID=instagramgo"
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
  });

  it("does not double-prefix bridge- accounts", () => {
    assert.equal(
      beeperChatDeepLink({
        chatId: "!xyz:beeper.local",
        accountId: "bridge-whatsapp",
      }),
      "beeper://select-thread/bridge-whatsapp/!xyz:beeper.local?accountID=whatsapp"
    );
  });

  it("prefers compose over select-thread when a phone is available", () => {
    assert.equal(
      beeperChatDeepLink({
        chatId: "!xyz:beeper.local",
        accountId: "whatsapp",
        phone: "+15551112222",
      }),
      "beeper://compose/bridge-whatsapp/+15551112222?accountID=whatsapp"
    );
  });

  it("never emits local-whatsapp as a platform path", () => {
    const href = beeperChatDeepLink({
      chatId: "!room:ba_x.local-whatsapp.localhost",
      accountId: "whatsapp",
      phone: "+15551112222",
    });
    assert.equal(
      href,
      "beeper://compose/bridge-whatsapp/+15551112222?accountID=whatsapp"
    );
    assert.equal(/local-whatsapp/.test(href), false);
  });
});
