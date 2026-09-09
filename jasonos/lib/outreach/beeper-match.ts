// Pure Beeper chat ↔ People matching. Sync and Home → Text use this so a
// 1:1 titled with a phone number can still attach when we searched by the
// person's name (iMessage does this constantly).

import {
  looksLikePersonName,
  normalizeName,
  normalizePhone,
} from "./contact-lookup";
import { beeperTextNetworkRank } from "../integrations/beeper-text-pref";

export type BeeperMatchParticipant = {
  fullName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  isSelf?: boolean;
};

export type BeeperMatchChat = {
  id?: string | null;
  type?: string | null;
  network?: string | null;
  accountID?: string | null;
  title?: string | null;
  peerName?: string | null;
  peerPhone?: string | null;
  participants?: { total?: number; items?: BeeperMatchParticipant[] } | null;
};

export type BeeperMatchContact = {
  name?: string | null;
  phone?: string | null;
};

export type BeeperMatchUser = {
  fullName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  isSelf?: boolean;
};

/** Merged Beeper contacts carry LinkedIn name + iMessage phone on one user. */
export function contactMatchesBeeperUser(
  user: BeeperMatchUser,
  contact: BeeperMatchContact
): boolean {
  if (user.isSelf) return false;
  const wantPhone = normalizePhone(contact.phone);
  const userPhone = normalizePhone(user.phoneNumber);
  if (wantPhone && userPhone === wantPhone) return true;
  const wantName = normalizeName(contact.name ?? "");
  const userName = normalizeName(user.fullName ?? "");
  if (
    wantName &&
    userName &&
    hasFullPersonName(contact.name) &&
    hasFullPersonName(user.fullName) &&
    (userName === wantName ||
      userName.includes(wantName) ||
      wantName.includes(userName))
  ) {
    return true;
  }
  return false;
}

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

export function otherBeeperParticipants(
  chat: BeeperMatchChat
): BeeperMatchParticipant[] {
  return (chat.participants?.items ?? []).filter((person) => !person.isSelf);
}

/**
 * Beeper Merge Chats (Aug 2026) combines LinkedIn + iMessage into one inbox
 * thread. The API still types that as `group` because it has one identity per
 * network. Treat it as a 1:1 when the other people collapse to one person.
 */
export function isPersonBeeperChat(chat: BeeperMatchChat): boolean {
  const type = (chat.type ?? "single").toLowerCase();
  if (type === "single") return true;

  const others = otherBeeperParticipants(chat);
  const total = chat.participants?.total ?? others.length;
  if (others.length <= 1 && total <= 2) return true;
  if (others.length > 6 || total > 8) return false;

  const phones = new Set(
    others
      .map((person) => normalizePhone(person.phoneNumber))
      .filter((value): value is string => Boolean(value))
  );
  const names = new Set(
    others
      .map((person) => person.fullName?.trim() ?? "")
      .filter((name) => hasFullPersonName(name))
      .map((name) => normalizeName(name))
  );
  if (phones.size > 1 || names.size > 1) return false;
  return phones.size === 1 || names.size === 1 || hasFullPersonName(chat.title);
}

/** Combine LinkedIn name + iMessage phone from a merged person chat. */
export function mergePeerFromParticipants(chat: BeeperMatchChat): {
  name: string | null;
  phone: string | null;
  email: string | null;
} {
  const others = otherBeeperParticipants(chat);
  const names = others.map((person) => person.fullName?.trim() || null);
  const title = chat.title?.trim() || null;
  const name =
    names.find((value) => looksLikePersonName(value)) ??
    (looksLikePersonName(title) ? title : null) ??
    names.find(Boolean) ??
    title;

  let phone: string | null = null;
  for (const person of others) {
    if (normalizePhone(person.phoneNumber)) {
      phone = person.phoneNumber?.trim() || null;
      break;
    }
    const labeled = person.fullName?.trim() || null;
    if (labeled && !looksLikePersonName(labeled) && normalizePhone(labeled)) {
      phone = labeled;
      break;
    }
  }
  if (!phone && title && !looksLikePersonName(title) && normalizePhone(title)) {
    phone = title;
  }

  const email =
    others
      .map((person) => person.email?.trim() || null)
      .find((value) => value && value.includes("@")) ?? null;

  return { name, phone, email };
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
  const participantPhones = otherBeeperParticipants(chat)
    .map((person) => normalizePhone(person.phoneNumber))
    .filter((value): value is string => Boolean(value));
  const chatPhone =
    normalizePhone(chat.peerPhone) ||
    normalizePhone(chat.title) ||
    normalizePhone(chat.peerName);
  if (
    wantPhone &&
    (chatPhone === wantPhone || participantPhones.includes(wantPhone))
  ) {
    return true;
  }

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

function chatKey(chat: BeeperMatchChat, index: number): string {
  return chat.id || `idx:${index}`;
}

/**
 * Merged inbox chats (LinkedIn + iMessage) are typed `group` and beat a
 * leftover iMessage shell that still matches the phone but has no timeline.
 */
function mergedInboxRank(chat: BeeperMatchChat): number {
  const type = (chat.type ?? "single").toLowerCase();
  if (type === "group" && isPersonBeeperChat(chat)) return -1;
  return beeperTextNetworkRank(chat);
}

/**
 * Rank every plausible 1:1 / merged person chat for a known contact.
 * Sync tries these in order until one actually has messages.
 */
export function rankBeeperChatsForContact<T extends BeeperMatchChat>(
  chats: T[],
  contact: BeeperMatchContact
): T[] {
  if (!chats.length) return [];

  const labeled = chats.filter((chat) => chatLabelsMatchContact(chat, contact));
  const extras: T[] = [];
  if (hasFullPersonName(contact.name)) {
    const phoneOnly = chats.filter((chat) => isPhoneOnlyChat(chat));
    const texts = phoneOnly.filter(
      (chat) => beeperTextNetworkRank(chat) === 0
    );
    if (texts.length === 1) extras.push(texts[0]);
    else if (phoneOnly.length === 1) extras.push(phoneOnly[0]);
  }

  const byId = new Map<string, T>();
  for (const [index, chat] of [...labeled, ...extras].entries()) {
    const key = chatKey(chat, index);
    if (!byId.has(key)) byId.set(key, chat);
  }
  let ranked = [...byId.values()];
  if (!ranked.length && hasFullPersonName(contact.name) && chats.length === 1) {
    ranked = [...chats];
  }

  return ranked.sort((a, b) => mergedInboxRank(a) - mergedInboxRank(b));
}

/**
 * Pick the 1:1 for a known person from Beeper search hits.
 *
 * Dara case: title already has the name → label match.
 * Jamie case: iMessage title is the number, but search was for her full name
 * → unique phone-titled text chat still counts.
 * Jeff case: LinkedIn + iMessage were merged; prefer that inbox chat over
 * the leftover phone-titled iMessage shell.
 */
export function pickBeeperChatForContact<T extends BeeperMatchChat>(
  chats: T[],
  contact: BeeperMatchContact
): T | undefined {
  return rankBeeperChatsForContact(chats, contact)[0];
}
