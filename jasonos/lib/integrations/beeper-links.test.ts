import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { beeperChatDeepLink } from "./beeper-links.ts";

describe("beeperChatDeepLink", () => {
  it("opens the app when chat or account is missing", () => {
    assert.equal(beeperChatDeepLink({}), "beeper://focus");
    assert.equal(
      beeperChatDeepLink({ chatId: "!abc:beeper.com" }),
      "beeper://focus"
    );
  });

  it("matches Beeper's Copy chat deep link for WhatsApp", () => {
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
});
