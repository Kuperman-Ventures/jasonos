import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { beeperChatDeepLink } from "./beeper-links.ts";

describe("beeperChatDeepLink", () => {
  it("opens the app when there is no chat", () => {
    assert.equal(beeperChatDeepLink({}), "beeper://focus");
  });

  it("uses a chat path when account is unknown", () => {
    assert.equal(
      beeperChatDeepLink({ chatId: "!abc:beeper.com" }),
      "beeper://chat/!abc%3Abeeper.com"
    );
  });

  it("builds select-thread with a WhatsApp account", () => {
    assert.equal(
      beeperChatDeepLink({
        chatId: "!xyz:beeper.local",
        accountId: "whatsapp",
      }),
      "beeper://select-thread/bridge-whatsapp/!xyz%3Abeeper.local?accountID=whatsapp"
    );
  });
});
