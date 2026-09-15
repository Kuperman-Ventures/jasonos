import "server-only";

import {
  beeperFocusChatIds,
  beeperHrefStrings,
  toE164,
} from "@/lib/integrations/beeper-links";
import { beeperTextNetworkRank } from "@/lib/integrations/beeper-text-pref";
import {
  isUsablePhone,
  looksLikeEmail,
  looksLikePersonName,
  preferPersonName,
} from "@/lib/outreach/contact-lookup";
import {
  beeperPhoneSearchQueries,
  contactMatchesBeeperUser,
  isPersonBeeperChat,
  mergePeerFromParticipants,
  pickBeeperChatForContact,
  rankBeeperChatsForContact,
  type BeeperMatchChat,
  type BeeperMatchContact,
} from "@/lib/outreach/beeper-match";

// Beeper Desktop API — local/tunneled chat sync for JasonOS outreach.
//
// Beeper runs on Jason's machine (default http://127.0.0.1:23373). JasonOS on
// Vercel can only reach it when BEEPER_DESKTOP_BASE_URL points at a tunnel
// (Cloudflare / Tailscale Funnel) with Beeper Desktop open + Remote Access.
// When Beeper is closed or unreachable, callers treat that as a soft skip:
// "No Beeper data synced" — not a hard Sync failure.

export const BEEPER_UNAVAILABLE_MESSAGE = "No Beeper data synced";

export interface BeeperPeer {
  name: string | null;
  phone: string | null;
  email: string | null;
  username: string | null;
}

export interface BeeperTouchCandidate {
  messageId: string;
  chatId: string;
  timestamp: string;
  text: string | null;
  network: string | null;
  chatTitle: string | null;
  peer: BeeperPeer;
  direction: "outbound" | "inbound";
}

interface BeeperUser {
  id?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  username?: string;
  isSelf?: boolean;
}

interface BeeperChat {
  id: string;
  title?: string;
  network?: string;
  type?: string;
  accountID?: string;
  localChatID?: string | null;
  lastActivity?: string;
  participants?: { total?: number; items?: BeeperUser[] };
}

interface BeeperMessage {
  id: string;
  chatID?: string;
  chatId?: string;
  timestamp: string;
  text?: string;
  isSender?: boolean;
  isDeleted?: boolean;
  type?: string;
}

interface CursorPage<T> {
  items?: T[];
  data?: T[];
  hasMore?: boolean;
  oldestCursor?: string | null;
}

interface BeeperAccount {
  accountID: string;
  network?: string;
}

type BeeperConnectionConfig = {
  base_url?: string;
  access_token?: string;
};

let cachedAccounts:
  | { at: number; accounts: BeeperAccount[] }
  | null = null;

async function loadBeeperConnectionConfig(): Promise<BeeperConnectionConfig> {
  try {
    const { createPublicServiceRoleClient } = await import("@/lib/supabase/server");
    const sb = createPublicServiceRoleClient();
    const { data } = await sb
      .from("service_connections")
      .select("config")
      .eq("service_name", "beeper")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return ((data?.config ?? {}) as BeeperConnectionConfig) ?? {};
  } catch {
    return {};
  }
}

async function resolveBaseUrl(): Promise<string> {
  const fromEnv = process.env.BEEPER_DESKTOP_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const cfg = await loadBeeperConnectionConfig();
  const fromSettings = cfg.base_url?.trim();
  if (fromSettings) return fromSettings.replace(/\/$/, "");

  return "http://127.0.0.1:23373";
}

/** Prefer Settings → Beeper token; fall back to Vercel env. */
async function resolveAccessToken(): Promise<string | null> {
  const cfg = await loadBeeperConnectionConfig();
  const fromSettings = cfg.access_token?.trim();
  if (fromSettings) return fromSettings;
  return process.env.BEEPER_ACCESS_TOKEN?.trim() || null;
}

export async function isBeeperConfigured(): Promise<boolean> {
  return Boolean(await resolveAccessToken());
}

async function beeperFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const token = await resolveAccessToken();
  if (!token) {
    throw new BeeperUnavailableError(
      "Beeper access token is not configured. Paste a new token in Settings → Beeper (or set BEEPER_ACCESS_TOKEN)."
    );
  }

  const timeoutMs = init?.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const root = await resolveBaseUrl();

  try {
    const res = await fetch(`${root}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    return res;
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") {
      throw new BeeperUnavailableError(BEEPER_UNAVAILABLE_MESSAGE);
    }
    throw new BeeperUnavailableError(BEEPER_UNAVAILABLE_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
}

export class BeeperUnavailableError extends Error {
  constructor(message = BEEPER_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "BeeperUnavailableError";
  }
}

export class BeeperApiError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(`Beeper API ${status}: ${detail}`);
    this.name = "BeeperApiError";
    this.status = status;
  }
}

const TOKEN_EXPIRED_HINT =
  "Beeper token expired. In Beeper Desktop → Settings → Integrations → Approved connections, create a new token, then paste it in JasonOS Settings → Beeper (or update BEEPER_ACCESS_TOKEN) and hit Test Connection.";

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.replace(/\s+/g, " ").trim().slice(0, 240) || res.statusText;
  } catch {
    return res.statusText || "unknown error";
  }
}

async function throwIfAuthFailed(res: Response): Promise<void> {
  if (res.status !== 401 && res.status !== 403) return;
  // Consume body so callers don't re-read it; always give the actionable hint.
  await readErrorDetail(res);
  throw new BeeperApiError(res.status, TOKEN_EXPIRED_HINT);
}

/** Probe Desktop API. Throws BeeperUnavailableError when closed / unreachable. */
export async function probeBeeperDesktop(): Promise<{ ok: true; baseUrl: string }> {
  const baseUrl = await resolveBaseUrl();
  const res = await beeperFetch("/v1/info", { timeoutMs: 5_000 });
  await throwIfAuthFailed(res);
  if (!res.ok) {
    throw new BeeperUnavailableError(BEEPER_UNAVAILABLE_MESSAGE);
  }
  return { ok: true, baseUrl };
}

function peerFromChat(chat: BeeperChat): BeeperPeer {
  const merged = mergePeerFromParticipants({
    title: chat.title,
    participants: chat.participants,
  });
  const others = (chat.participants?.items ?? []).filter((p) => !p.isSelf);
  const username =
    others.find((p) => looksLikePersonName(p.fullName))?.username?.trim() ||
    others[0]?.username?.trim() ||
    null;
  return {
    name: merged.name,
    phone: merged.phone,
    email: merged.email,
    username,
  };
}

function pageItems<T>(body: CursorPage<T>): T[] {
  return body.items ?? body.data ?? [];
}

function withMatchFields(chat: BeeperChat): BeeperChat & BeeperMatchChat {
  const peer = peerFromChat(chat);
  return {
    ...chat,
    peerName: peer.name,
    peerPhone: peer.phone,
  };
}

async function searchChatsPage(qs: URLSearchParams): Promise<BeeperChat[]> {
  const res = await beeperFetch(`/v1/chats/search?${qs}`, { timeoutMs: 12_000 });
  await throwIfAuthFailed(res);
  if (!res.ok && qs.get("type") === "any") {
    qs.set("type", "single");
    return searchChatsPage(qs);
  }
  if (!res.ok) return [];
  const body = (await res.json()) as CursorPage<BeeperChat>;
  return pageItems(body).filter(isPersonBeeperChat);
}

async function unifiedSearchChats(query: string): Promise<BeeperChat[]> {
  const qs = new URLSearchParams({ query });
  const res = await beeperFetch(`/v1/search?${qs}`, { timeoutMs: 10_000 });
  await throwIfAuthFailed(res);
  if (!res.ok) return [];
  const body = (await res.json()) as {
    results?: { chats?: BeeperChat[] };
    chats?: BeeperChat[];
  };
  const chats = body.results?.chats ?? body.chats ?? [];
  return chats.filter(isPersonBeeperChat);
}

function mergeChats(groups: BeeperChat[][]): BeeperChat[] {
  const byId = new Map<string, BeeperChat>();
  for (const group of groups) {
    for (const chat of group) {
      if (chat.id && !byId.has(chat.id)) byId.set(chat.id, chat);
    }
  }
  return [...byId.values()];
}

async function searchRecentSingleChats(opts: {
  dateAfter: string;
  limit: number;
}): Promise<BeeperChat[]> {
  const base = {
    lastActivityAfter: opts.dateAfter,
    limit: String(opts.limit),
    includeMuted: "true",
  };
  const [singles, groups] = await Promise.all([
    searchChatsPage(
      new URLSearchParams({ ...base, type: "single" })
    ),
    searchChatsPage(
      new URLSearchParams({
        ...base,
        type: "group",
        limit: String(Math.min(80, opts.limit)),
      })
    ),
  ]);
  const chats = mergeChats([singles, groups]);
  if (chats.length) return chats;

  // Fallback: list chats without activity filter.
  const listRes = await beeperFetch(
    `/v1/chats?${new URLSearchParams({
      type: "any",
      limit: String(opts.limit),
    })}`,
    { timeoutMs: 12_000 }
  );
  await throwIfAuthFailed(listRes);
  if (!listRes.ok) {
    throw new BeeperApiError(listRes.status, await readErrorDetail(listRes));
  }
  const listBody = (await listRes.json()) as CursorPage<BeeperChat>;
  return pageItems(listBody).filter(isPersonBeeperChat);
}

async function listChatMessages(
  chatId: string,
  limit: number,
  afterMs?: number
): Promise<BeeperMessage[]> {
  const out: BeeperMessage[] = [];
  let cursor: string | null = null;
  const pageSize = Math.max(1, Math.min(40, limit));

  for (let page = 0; page < 4 && out.length < limit; page += 1) {
    const qs = new URLSearchParams({ limit: String(pageSize) });
    if (cursor) {
      qs.set("cursor", cursor);
      qs.set("direction", "before");
    }
    const res = await beeperFetch(
      `/v1/chats/${encodeURIComponent(chatId)}/messages?${qs}`,
      { timeoutMs: 12_000 }
    );
    if (!res.ok) {
      console.warn(
        "[beeper.listChatMessages]",
        chatId,
        res.status,
        await readErrorDetail(res)
      );
      break;
    }
    const body = (await res.json()) as CursorPage<BeeperMessage>;
    const items = pageItems(body);
    if (!items.length) break;
    out.push(...items);
    const oldest = items[items.length - 1];
    const oldestMs = oldest?.timestamp
      ? new Date(oldest.timestamp).getTime()
      : NaN;
    if (afterMs && Number.isFinite(oldestMs) && oldestMs < afterMs) break;
    if (!body.hasMore || !body.oldestCursor) break;
    cursor = body.oldestCursor;
  }
  return out;
}

function candidatesFromChat(
  chat: BeeperChat,
  messages: BeeperMessage[],
  afterMs: number,
  includeInbound: boolean
): BeeperTouchCandidate[] {
  const peer = peerFromChat(chat);
  const out: BeeperTouchCandidate[] = [];
  for (const m of messages) {
    if (m.isDeleted) continue;
    const ts = new Date(m.timestamp).getTime();
    if (!Number.isFinite(ts) || ts < afterMs) continue;
    const outbound = Boolean(m.isSender);
    if (!outbound && !includeInbound) continue;
    out.push({
      messageId: m.id,
      chatId: chat.id,
      timestamp: m.timestamp,
      text: m.text?.trim() || null,
      network: chat.network ?? null,
      chatTitle: chat.title ?? null,
      peer,
      direction: outbound ? "outbound" : "inbound",
    });
  }
  return out;
}

/**
 * Pull recent 1:1 messages for touch capture.
 *
 * Strategy: find recently active DM chats, then list messages per chat.
 * (Global messages/search with sender filters proved brittle and returned
 * empty results even when Desktop was reachable.)
 */
export async function fetchBeeperTouchCandidates(opts?: {
  daysBack?: number;
  maxChats?: number;
  maxMessagesPerChat?: number;
  includeInbound?: boolean;
}): Promise<BeeperTouchCandidate[]> {
  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 30));
  const maxChats = Math.max(1, Math.min(250, opts?.maxChats ?? 200));
  const maxMessagesPerChat = Math.max(
    1,
    Math.min(40, opts?.maxMessagesPerChat ?? 20)
  );
  const includeInbound = opts?.includeInbound ?? true;

  await probeBeeperDesktop();

  const afterMs = Date.now() - daysBack * 86_400_000;
  const after = new Date(afterMs).toISOString();

  const chats = await searchRecentSingleChats({
    dateAfter: after,
    limit: maxChats,
  });
  if (!chats.length) return [];

  const out: BeeperTouchCandidate[] = [];

  // Bound concurrency so we don't stampede Desktop API through the tunnel.
  const queue = [...chats];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const chat = queue.shift();
      if (!chat) return;
      const messages = await listChatMessages(chat.id, maxMessagesPerChat, afterMs);
      out.push(...candidatesFromChat(chat, messages, afterMs, includeInbound));
    }
  });
  await Promise.all(workers);

  out.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return out;
}

function contactSearchParams(
  query: string,
  opts?: {
    scope?: "titles" | "participants";
    type?: "single" | "group" | "any";
  }
): URLSearchParams {
  const qs = new URLSearchParams({
    // Prefer explicit single+group over type=any — some Desktop builds 400
    // on "any" and our fallback only retried "single", missing merged chats.
    type: opts?.type ?? "single",
    limit: "80",
    includeMuted: "true",
    query,
  });
  if (opts?.scope) qs.set("scope", opts.scope);
  return qs;
}

async function searchChatsPageBothTypes(
  query: string,
  scope?: "titles" | "participants"
): Promise<BeeperChat[]> {
  const [singles, groups] = await Promise.all([
    searchChatsPage(contactSearchParams(query, { scope, type: "single" })),
    searchChatsPage(contactSearchParams(query, { scope, type: "group" })),
  ]);
  return mergeChats([singles, groups]);
}

function asBeeperMatchContact(contact: {
  name?: string | null;
  phone?: string | null;
  emails?: string[] | null;
}): BeeperMatchContact {
  const emails = [...(contact.emails ?? [])];
  if (looksLikeEmail(contact.phone)) emails.push(contact.phone!.trim());
  return {
    name: contact.name,
    phone: isUsablePhone(contact.phone) ? contact.phone : null,
    emails,
  };
}

async function searchChatsForContact(contact: {
  name?: string | null;
  phone?: string | null;
  emails?: string[] | null;
}): Promise<BeeperChat[]> {
  const matchContact = asBeeperMatchContact(contact);
  const name = preferPersonName(matchContact.name);
  const phone = matchContact.phone?.trim() || null;
  const groups: BeeperChat[][] = [];

  if (phone) {
    const phoneHits = await Promise.all(
      beeperPhoneSearchQueries(phone).map((query) =>
        searchChatsPageBothTypes(query)
      )
    );
    groups.push(...phoneHits);
  }

  if (name) {
    const [titles, participants, unified] = await Promise.all([
      searchChatsPageBothTypes(name, "titles"),
      searchChatsPageBothTypes(name, "participants"),
      unifiedSearchChats(name),
    ]);
    groups.push(titles, participants, unified);
  }

  // Email can resolve LinkedIn / merged Beeper contacts when phone was junk.
  for (const email of matchContact.emails ?? []) {
    const q = email.trim();
    if (!q) continue;
    groups.push(await searchChatsPageBothTypes(q, "participants"));
  }

  return mergeChats(groups);
}

async function listBeeperAccounts(): Promise<BeeperAccount[]> {
  if (cachedAccounts && Date.now() - cachedAccounts.at < 60_000) {
    return cachedAccounts.accounts;
  }
  const res = await beeperFetch("/v1/accounts", { timeoutMs: 10_000 });
  await throwIfAuthFailed(res);
  if (!res.ok) return cachedAccounts?.accounts ?? [];
  const body = (await res.json()) as BeeperAccount[] | { items?: BeeperAccount[] };
  const accounts = Array.isArray(body) ? body : body.items ?? [];
  cachedAccounts = { at: Date.now(), accounts };
  return accounts;
}

async function searchAccountContacts(
  accountID: string,
  query: string
): Promise<BeeperUser[]> {
  const qs = new URLSearchParams({ query });
  const res = await beeperFetch(
    `/v1/accounts/${encodeURIComponent(accountID)}/contacts?${qs}`,
    { timeoutMs: 10_000 }
  );
  if (!res.ok) return [];
  const body = (await res.json()) as CursorPage<BeeperUser>;
  return pageItems(body);
}

async function startDirectChat(
  accountID: string,
  user: Pick<
    BeeperUser,
    "id" | "fullName" | "phoneNumber" | "email" | "username"
  >
): Promise<BeeperChat | null> {
  if (!user.id && !user.phoneNumber && !user.email && !user.username) {
    return null;
  }
  const res = await beeperFetch("/v1/chats/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accountID,
      user: {
        id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        username: user.username,
      },
    }),
    timeoutMs: 12_000,
  });
  if (!res.ok) return null;
  const chat = (await res.json()) as BeeperChat;
  return chat?.id ? chat : null;
}

async function retrieveChat(chatId: string): Promise<BeeperChat | null> {
  const res = await beeperFetch(
    `/v1/chats/${encodeURIComponent(chatId)}`,
    { timeoutMs: 8_000 }
  );
  if (!res.ok) return null;
  const chat = (await res.json()) as BeeperChat;
  return chat?.id ? chat : null;
}

/** Resolve an existing 1:1 on this Desktop from the People-card phone. */
async function startChatFromPhone(contact: {
  name?: string | null;
  phone?: string | null;
}): Promise<BeeperChat | null> {
  const phoneNumber = toE164(contact.phone);
  if (!phoneNumber) return null;
  const accounts = await listBeeperAccounts();
  const ranked = [...accounts].sort(
    (a, b) => beeperTextNetworkRank(a) - beeperTextNetworkRank(b)
  );
  for (const account of ranked.slice(0, 4)) {
    const chat = await startDirectChat(account.accountID, {
      phoneNumber,
      fullName: contact.name ?? undefined,
    });
    if (chat?.id) return chat;
  }
  return null;
}

async function postFocus(body: {
  chatID?: string;
}): Promise<{ ok: boolean; status: number; detail: string }> {
  const res = await beeperFetch("/v1/focus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: 8_000,
  });
  if (res.status === 401 || res.status === 403) {
    throw new BeeperApiError(res.status, await readErrorDetail(res));
  }
  const detail = res.ok ? "" : await readErrorDetail(res);
  if (!res.ok) return { ok: false, status: res.status, detail };
  try {
    const json = (await res.json()) as { success?: boolean };
    if (json && json.success === false) {
      return { ok: false, status: res.status, detail: "focus returned success:false" };
    }
  } catch {
    /* empty / non-JSON body still counts as HTTP ok */
  }
  return { ok: true, status: res.status, detail: "" };
}

/**
 * Beeper Merge Chats (v4.2+) keeps LinkedIn + iMessage on one merged contact.
 * Chat search often still misses that inbox thread; contacts + chats/start
 * is how Desktop resolves it.
 */
async function resolveChatsViaMergedContacts(contact: {
  name?: string | null;
  phone?: string | null;
  emails?: string[] | null;
}): Promise<BeeperChat[]> {
  const accounts = await listBeeperAccounts();
  if (!accounts.length) return [];
  const matchContact = asBeeperMatchContact(contact);
  const queries = [
    ...beeperPhoneSearchQueries(matchContact.phone),
    ...(matchContact.emails ?? []),
    preferPersonName(matchContact.name),
  ].filter((value): value is string => Boolean(value));
  if (!queries.length) return [];

  const rankedAccounts = [...accounts].sort(
    (a, b) =>
      beeperTextNetworkRank(a) - beeperTextNetworkRank(b)
  );
  const chats: BeeperChat[] = [];

  for (const account of rankedAccounts.slice(0, 6)) {
    for (const query of queries.slice(0, 3)) {
      const users = await searchAccountContacts(account.accountID, query);
      const user = users.find((candidate) =>
        contactMatchesBeeperUser(candidate, matchContact)
      );
      if (!user) continue;
      const chat = await startDirectChat(account.accountID, user);
      if (chat && isPersonBeeperChat(chat)) chats.push(chat);
      if (chats.length >= 3) return mergeChats([chats]);
    }
  }
  return mergeChats([chats]);
}

async function searchMessagesInChat(
  chatId: string,
  afterIso: string,
  limit: number
): Promise<BeeperMessage[]> {
  const qs = new URLSearchParams({
    dateAfter: afterIso,
    limit: String(Math.max(1, Math.min(40, limit))),
    includeMuted: "true",
    excludeLowPriority: "false",
  });
  qs.set("chatIDs", chatId);
  const res = await beeperFetch(`/v1/messages/search?${qs}`, {
    timeoutMs: 15_000,
  });
  if (!res.ok) return [];
  const body = (await res.json()) as CursorPage<BeeperMessage>;
  return pageItems(body);
}

export type FocusBeeperResult =
  | {
      ok: true;
      opened: "chat" | "app";
      chatTitle?: string;
      phone?: string | null;
      /** Well-formed beeper:// / sms: URLs for this Mac, already ordered. */
      hrefs: string[];
    }
  | { ok: false; error: string };

async function findBeeperChatForContact(contact: {
  name?: string | null;
  phone?: string | null;
  emails?: string[] | null;
}): Promise<BeeperChat | undefined> {
  const matchContact = asBeeperMatchContact(contact);
  const fromSearch = pickBeeperChatForContact(
    (await searchChatsForContact(contact)).map(withMatchFields),
    matchContact
  );
  if (fromSearch) return fromSearch;
  return pickBeeperChatForContact(
    (await resolveChatsViaMergedContacts(contact)).map(withMatchFields),
    matchContact
  );
}

function hrefsForContact(
  contact: { name?: string | null; phone?: string | null },
  match?: BeeperChat | null,
  peer?: BeeperPeer | null
): string[] {
  return beeperHrefStrings({
    chatId: match?.id,
    localChatId: match?.localChatID,
    accountId: match?.accountID,
    network: match?.network,
    phone: peer?.phone ?? contact.phone,
    username: peer?.username,
  });
}

/**
 * Search a known person by phone and name, including Beeper's merged inbox
 * chats (LinkedIn + iMessage as one conversation). Pull recent messages from
 * the first ranked 1:1 that actually has a timeline — leftover iMessage
 * shells after a merge often match the number but return no messages.
 */
export async function fetchBeeperTouchCandidatesForContact(
  contact: { name?: string | null; phone?: string | null; emails?: string[] | null },
  opts?: {
    daysBack?: number;
    maxMessagesPerChat?: number;
    includeInbound?: boolean;
  }
): Promise<{
  chatId: string;
  phone: string | null;
  candidates: BeeperTouchCandidate[];
} | null> {
  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 30));
  const maxMessagesPerChat = Math.max(
    1,
    Math.min(40, opts?.maxMessagesPerChat ?? 20)
  );
  const includeInbound = opts?.includeInbound ?? true;
  const afterMs = Date.now() - daysBack * 86_400_000;
  const matchContact = asBeeperMatchContact(contact);

  const afterIso = new Date(afterMs).toISOString();
  const tryChats = async (pool: BeeperChat[]) => {
    const ranked = rankBeeperChatsForContact(
      pool.map(withMatchFields),
      matchContact
    );
    for (const chat of ranked.slice(0, 6)) {
      let messages = await searchMessagesInChat(
        chat.id,
        afterIso,
        maxMessagesPerChat
      );
      if (!messages.length) {
        messages = await listChatMessages(
          chat.id,
          maxMessagesPerChat,
          afterMs
        );
      }
      const candidates = candidatesFromChat(
        chat,
        messages,
        afterMs,
        includeInbound
      );
      if (!candidates.length) continue;
      const peer = peerFromChat(chat);
      return {
        chatId: chat.id,
        phone: peer.phone,
        candidates,
      };
    }
    return null;
  };

  const fromSearch = await tryChats(await searchChatsForContact(contact));
  if (fromSearch) return fromSearch;
  return tryChats(await resolveChatsViaMergedContacts(contact));
}

/**
 * Open the person's chat. Tries several `/v1/focus` chatID shapes on the
 * tunneled Desktop, skipping office-only `*.localhost` ids that make Beeper
 * toast "invalid deep link". Always returns portable compose links so the
 * browser can retry formats on this Mac if HTTP focus did not land a chat.
 */
export async function focusBeeperChatForContact(contact: {
  name?: string | null;
  phone?: string | null;
  emails?: string[] | null;
}): Promise<FocusBeeperResult> {
  await probeBeeperDesktop();
  let match = await findBeeperChatForContact(contact);

  if (match?.id && !match.localChatID) {
    const detailed = await retrieveChat(match.id);
    if (detailed) match = { ...match, ...detailed, id: detailed.id || match.id };
  }

  let focusIds = beeperFocusChatIds({
    chatId: match?.id,
    localChatId: match?.localChatID,
  });
  if (!focusIds.length) {
    const started = await startChatFromPhone(contact);
    if (started) {
      match = match
        ? {
            ...match,
            ...started,
            id: started.id || match.id,
            localChatID: started.localChatID ?? match.localChatID,
            title: match.title || started.title,
          }
        : started;
      focusIds = beeperFocusChatIds({
        chatId: match.id,
        localChatId: match.localChatID,
      });
    }
  }

  const peer = match ? peerFromChat(match) : null;
  const hrefs = hrefsForContact(contact, match, peer);

  let opened: "chat" | "app" = "app";
  let lastDetail = "";
  for (const chatID of focusIds) {
    const res = await postFocus({ chatID });
    if (res.ok) {
      opened = "chat";
      break;
    }
    lastDetail = res.detail;
  }

  if (opened !== "chat") {
    const res = await postFocus({});
    if (!res.ok) lastDetail = res.detail || lastDetail;
  }

  if (opened !== "chat" && !hrefs.length) {
    return {
      ok: false,
      error: lastDetail
        ? `Could not open Beeper (${lastDetail})`
        : "Could not open Beeper.",
    };
  }

  if (opened === "chat" && match) {
    return {
      ok: true,
      opened: "chat",
      chatTitle: match.title || contact.name || undefined,
      phone: peer?.phone ?? null,
      hrefs,
    };
  }
  return {
    ok: true,
    opened: "app",
    chatTitle: match?.title || contact.name || undefined,
    phone: peer?.phone ?? contact.phone ?? null,
    hrefs,
  };
}
