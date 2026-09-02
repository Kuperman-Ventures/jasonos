import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { beeperChatDeepLink, beeperTextFallbackLink } from "./beeper-links.ts";

describe("beeperChatDeepLink", () => {
  it("opens the app when there is no portable recipient or cloud thread", () => {
    assert.equal(beeperChatDeepLink({}), "beeper://focus");
    assert.equal(
      beeperChatDeepLink({ chatId: "!abc:beeper.com" }),
      "beeper://focus"
    );
  });

  it("does not deep-link a laptop with another Mac's local chat id", () => {
    assert.equal(
      beeperChatDeepLink({
        chatId:
          "!KPFTtZYWuERwib8T702N9IfqiCc:ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc.local-whatsapp.localhost",
        accountId: "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
      }),
      "beeper://focus"
    );
  });

  it("composes via phone so any Mac can open the WhatsApp thread", () => {
    assert.equal(
      beeperChatDeepLink({
        chatId:
          "!KPFTtZYWuERwib8T702N9IfqiCc:ba_office.local-whatsapp.localhost",
        accountId: "local-whatsapp_ba_office",
        network: "WhatsApp",
        phone: "+1 555-111-2222",
      }),
      "beeper://compose/local-whatsapp/+15551112222"
    );
  });

  it("does not send a local-whatsapp_ba_ accountID in the URL", () => {
    const href = beeperChatDeepLink({
      accountId: "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
      phone: "9175550100",
    });
    assert.equal(href, "beeper://compose/local-whatsapp/+19175550100");
    assert.equal(href.includes("accountID"), false);
    assert.equal(href.includes("ba_"), false);
  });

  it("uses local-imessage compose when Text only has a phone", () => {
    assert.equal(
      beeperChatDeepLink({ phone: "(917) 555-0100" }),
      "beeper://compose/local-imessage/+19175550100"
    );
    assert.equal(
      beeperTextFallbackLink("(917) 555-0100"),
      "beeper://compose/local-imessage/+19175550100"
    );
  });

  it("composes Instagram by handle when there is no phone", () => {
    assert.equal(
      beeperChatDeepLink({
        accountId: "local-instagram_ba_eRfQ",
        network: "Instagram",
        username: "@mattwondra",
      }),
      "beeper://compose/local-instagram/mattwondra"
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
      "beeper://compose/bridge-whatsapp/+15551112222"
    );
  });

  it("treats localhost chat ids as local even if accountID is a cloud name", () => {
    assert.equal(
      beeperChatDeepLink({
        chatId: "!room:ba_x.local-whatsapp.localhost",
        accountId: "whatsapp",
        phone: "+15551112222",
      }),
      "beeper://compose/local-whatsapp/+15551112222"
    );
  });
});
