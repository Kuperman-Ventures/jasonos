// Pure Beeper chat ↔ People matching. Sync and Home → Text use this so a
// 1:1 titled with a phone number can still attach when we searched by the
// person's name (iMessage does this constantly).

import {
  looksLikePersonName,
  normalizeName,
  normalizePhone,
} from "./contact-lookup";
import {
  beeperTextNetworkRank,
  pickPreferredTextChat,
} from "../integrations/beeper-text-pref";

export type BeeperMatchChat = {
  network?: string | null;
  accountID?: string | null;
  title?: string | null;
  peerName?: string | null;
  peerPhone?: string | null;
};

export type BeeperMatchContact = {
  name?: string | null;
  phone?: string | null;
};

/** First + last (or more). "Jamie" alone is too weak to claim a phone-titled chat. */
export function hasFullPersonName(name: string | null | undefined): boolean {
  if (!looksLikePersonName(name)) return false;
  return (name ?? "").trim().split(/\s+/).filter(Boolean).length >= 2;
}

/**
 * Queries Beeper chat search actually hits for a People-card phone.
 * iMessage titles look like "+1 917-617-0561"; searching only digits often
 * misses that thread.
 */
export function beeperPhoneSearchQueries(
  phone: string | null | undefined
): string[] {
  const raw = (phone ?? "").trim();
  const digits = normalizePhone(raw);
  const out: string[] = [];
  const add = (value: string | null | undefined) => {
    const next = (value ?? "").trim();
    if (next && !out.includes(next)) out.push(next);
  };
  add(raw);
  if (!digits) return out;
  add(digits);
  if (digits.length === 10) {
    const dashed = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    add(dashed);
    add(`+1 ${dashed}`);
    add(`+1${digits}`);
  }
  return out;
}

export function isPhoneOnlyChat(chat: BeeperMatchChat): boolean {
  const labels = [chat.peerName, chat.title];
  if (labels.some((value) => looksLikePersonName(value))) return false;
  return Boolean(
    normalizePhone(chat.peerPhone) ||
      normalizePhone(chat.title) ||
      normalizePhone(chat.peerName)
  );
}

/** Phone or an exact/contained person name on the chat labels. */
export function chatLabelsMatchContact(
  chat: BeeperMatchChat,
  contact: BeeperMatchContact
): boolean {
  const wantPhone = normalizePhone(contact.phone);
  const chatPhone =
    normalizePhone(chat.peerPhone) ||
    normalizePhone(chat.title) ||
    normalizePhone(chat.peerName);
  if (wantPhone && chatPhone === wantPhone) return true;

  const wantName = normalizeName(contact.name ?? "");
  if (!wantName) return false;
  const labels = [chat.peerName, chat.title]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeName(value));
  return labels.some(
    (label) =>
      label === wantName || label.includes(wantName) || wantName.includes(label)
  );
}

/**
 * Pick the 1:1 for a known person from Beeper search hits.
 *
 * Dara case: title already has the name → label match.
 * Jamie case: iMessage title is the number, but search was for her full name
 * → unique phone-titled text chat still counts.
 */
export function pickBeeperChatForContact<T extends BeeperMatchChat>(
  chats: T[],
  contact: BeeperMatchContact
): T | undefined {
  if (!chats.length) return undefined;

  const labeled = chats.filter((chat) => chatLabelsMatchContact(chat, contact));
  const fromLabels = pickPreferredTextChat(labeled);
  if (fromLabels && beeperTextNetworkRank(fromLabels) === 0) return fromLabels;

  if (hasFullPersonName(contact.name)) {
    const phoneOnly = chats.filter((chat) => isPhoneOnlyChat(chat));
    const texts = phoneOnly.filter((chat) => beeperTextNetworkRank(chat) === 0);
    if (texts.length === 1) return texts[0];
    if (phoneOnly.length === 1) return phoneOnly[0];
  }

  if (fromLabels) return fromLabels;
  if (hasFullPersonName(contact.name) && chats.length === 1) return chats[0];
  return undefined;
}
