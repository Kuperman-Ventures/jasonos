import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chatLabelsMatchContact,
  hasFullPersonName,
  isPhoneOnlyChat,
  pickBeeperChatForContact,
} from "./beeper-match";

const jamie = { name: "Jamie Valencour", phone: null };
const jamieWithPhone = { name: "Jamie Valencour", phone: "+1 864-270-7048" };
const dara = { name: "Dara Akbarian", phone: null };

const imessagePhone = {
  id: "im-jamie",
  network: "iMessage",
  title: "+1 864-270-7048",
  peerName: "+1 864-270-7048",
  peerPhone: "+1 864-270-7048",
};

const linkedInNamed = {
  id: "li-jamie",
  network: "LinkedIn",
  title: "Jamie Valencour",
  peerName: "Jamie Valencour",
  peerPhone: null,
};

const daraNamed = {
  id: "im-dara",
  network: "iMessage",
  title: "Dara Akbarian",
  peerName: "+1 917-555-0100",
  peerPhone: "+1 917-555-0100",
};

describe("hasFullPersonName", () => {
  it("requires a first and last name", () => {
    assert.equal(hasFullPersonName("Jamie Valencour"), true);
    assert.equal(hasFullPersonName("Jamie"), false);
    assert.equal(hasFullPersonName("+1 864-270-7048"), false);
  });
});

describe("isPhoneOnlyChat", () => {
  it("detects iMessage threads titled with a number", () => {
    assert.equal(isPhoneOnlyChat(imessagePhone), true);
    assert.equal(isPhoneOnlyChat(daraNamed), false);
    assert.equal(isPhoneOnlyChat(linkedInNamed), false);
  });
});

describe("chatLabelsMatchContact", () => {
  it("matches Dara when the title has her name even without a phone on file", () => {
    assert.equal(chatLabelsMatchContact(daraNamed, dara), true);
  });

  it("does not match Jamie to a number-titled chat without her phone", () => {
    assert.equal(chatLabelsMatchContact(imessagePhone, jamie), false);
  });

  it("matches Jamie once the phone is on the People card", () => {
    assert.equal(chatLabelsMatchContact(imessagePhone, jamieWithPhone), true);
  });
});

describe("pickBeeperChatForContact", () => {
  it("picks a unique phone-titled iMessage when the search was for a full name", () => {
    assert.equal(
      pickBeeperChatForContact([imessagePhone], jamie)?.id,
      "im-jamie"
    );
  });

  it("prefers that iMessage over a LinkedIn chat that already has the name", () => {
    assert.equal(
      pickBeeperChatForContact([linkedInNamed, imessagePhone], jamie)?.id,
      "im-jamie"
    );
  });

  it("still picks Dara by the name in the title", () => {
    assert.equal(pickBeeperChatForContact([daraNamed], dara)?.id, "im-dara");
  });

  it("does not grab a random phone chat from a crowded search", () => {
    const crowded = [
      { ...imessagePhone, id: "a", title: "+1 111-111-1111", peerPhone: "+11111111111" },
      { ...imessagePhone, id: "b", title: "+1 222-222-2222", peerPhone: "+12222222222" },
    ];
    assert.equal(pickBeeperChatForContact(crowded, jamie), undefined);
  });

  it("returns undefined when search found nothing", () => {
    assert.equal(pickBeeperChatForContact([], jamie), undefined);
  });
});
