import "server-only";

import {
  looksLikePersonName,
  preferPersonName,
} from "@/lib/outreach/contact-lookup";
import {
  beeperPhoneSearchQueries,
  isPersonBeeperChat,
  mergePeerFromParticipants,
  pickBeeperChatForContact,
  rankBeeperChatsForContact,
  type BeeperMatchChat,
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

type BeeperConnectionConfig = {
  base_url?: string;
  access_token?: string;
};

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
  scope?: "titles" | "participants"
): URLSearchParams {
  const qs = new URLSearchParams({
    type: "any",
    limit: "80",
    includeMuted: "true",
    query,
  });
  if (scope) qs.set("scope", scope);
  return qs;
}

async function searchChatsForContact(contact: {
  name?: string | null;
  phone?: string | null;
}): Promise<BeeperChat[]> {
  const name = preferPersonName(contact.name);
  const phone = contact.phone?.trim() || null;
  const groups: BeeperChat[][] = [];

  if (phone) {
    const phoneHits = await Promise.all(
      beeperPhoneSearchQueries(phone).map((query) =>
        searchChatsPage(contactSearchParams(query))
      )
    );
    groups.push(...phoneHits);
  }

  if (name) {
    const [titles, participants, unified] = await Promise.all([
      searchChatsPage(contactSearchParams(name, "titles")),
      searchChatsPage(contactSearchParams(name, "participants")),
      unifiedSearchChats(name),
    ]);
    groups.push(titles, participants, unified);
  }

  return mergeChats(groups);
}

export type FocusBeeperResult =
  | {
      ok: true;
      opened: "chat" | "app";
      chatTitle?: string;
      phone?: string | null;
    }
  | { ok: false; error: string };

async function findBeeperChatForContact(contact: {
  name?: string | null;
  phone?: string | null;
}): Promise<BeeperChat | undefined> {
  const chats = await searchChatsForContact(contact);
  return pickBeeperChatForContact(chats.map(withMatchFields), contact);
}

/**
 * Search a known person by phone and name, including Beeper's merged inbox
 * chats (LinkedIn + iMessage as one conversation). Pull recent messages from
 * the first ranked 1:1 that actually has a timeline — leftover iMessage
 * shells after a merge often match the number but return no messages.
 */
export async function fetchBeeperTouchCandidatesForContact(
  contact: { name?: string | null; phone?: string | null },
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

  const chats = await searchChatsForContact(contact);
  const ranked = rankBeeperChatsForContact(
    chats.map(withMatchFields),
    contact
  );
  for (const chat of ranked.slice(0, 6)) {
    const messages = await listChatMessages(
      chat.id,
      maxMessagesPerChat,
      afterMs
    );
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
}

/**
 * Open the matched 1:1 on the tunneled Beeper Desktop (office Mac).
 * Home → Text must call this. Do not swap it for beeper:// deep links or
 * browser calls to localhost — those broke Desktop and never worked on the laptop.
 */
export async function focusBeeperChatForContact(contact: {
  name?: string | null;
  phone?: string | null;
}): Promise<FocusBeeperResult> {
  await probeBeeperDesktop();
  const match = await findBeeperChatForContact(contact);
  const peer = match ? peerFromChat(match) : null;

  const body = match ? { chatID: match.id } : {};
  const res = await beeperFetch("/v1/focus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: 8_000,
  });
  if (res.status === 401 || res.status === 403) {
    throw new BeeperApiError(res.status, await readErrorDetail(res));
  }
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    return { ok: false, error: `Could not open Beeper (${detail})` };
  }
  if (match) {
    return {
      ok: true,
      opened: "chat",
      chatTitle: match.title || contact.name || undefined,
      phone: peer?.phone ?? null,
    };
  }
  return { ok: true, opened: "app" };
}
