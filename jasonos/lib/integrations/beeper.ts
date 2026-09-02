import "server-only";

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
  participants?: { items?: BeeperUser[] };
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

async function resolveBaseUrl(): Promise<string> {
  const fromEnv = process.env.BEEPER_DESKTOP_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  // Optional tunnel URL saved in Settings → Beeper (non-secret config).
  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const sb = createServiceRoleClient();
    const { data } = await sb
      .from("service_connections")
      .select("config")
      .eq("service_name", "beeper")
      .limit(1)
      .maybeSingle();
    const cfg = (data?.config ?? {}) as { base_url?: string };
    const fromSettings = cfg.base_url?.trim();
    if (fromSettings) return fromSettings.replace(/\/$/, "");
  } catch {
    // Settings table may be unavailable; fall through to localhost default.
  }

  return "http://127.0.0.1:23373";
}

function accessToken(): string | null {
  return process.env.BEEPER_ACCESS_TOKEN?.trim() || null;
}

export function isBeeperConfigured(): boolean {
  return Boolean(accessToken());
}

async function beeperFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const token = accessToken();
  if (!token) {
    throw new BeeperUnavailableError(
      "Beeper access token is not configured (set BEEPER_ACCESS_TOKEN)."
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

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.replace(/\s+/g, " ").trim().slice(0, 240) || res.statusText;
  } catch {
    return res.statusText || "unknown error";
  }
}

/** Probe Desktop API. Throws BeeperUnavailableError when closed / unreachable. */
export async function probeBeeperDesktop(): Promise<{ ok: true; baseUrl: string }> {
  const baseUrl = await resolveBaseUrl();
  const res = await beeperFetch("/v1/info", { timeoutMs: 5_000 });
  if (res.status === 401 || res.status === 403) {
    throw new BeeperApiError(
      res.status,
      "Beeper token rejected. Recreate the Approved connection token."
    );
  }
  if (!res.ok) {
    throw new BeeperUnavailableError(BEEPER_UNAVAILABLE_MESSAGE);
  }
  return { ok: true, baseUrl };
}

function peerFromChat(chat: BeeperChat): BeeperPeer {
  const others = (chat.participants?.items ?? []).filter((p) => !p.isSelf);
  const primary = others[0];
  return {
    name: primary?.fullName?.trim() || chat.title?.trim() || null,
    phone: primary?.phoneNumber?.trim() || null,
    email: primary?.email?.trim() || null,
    username: primary?.username?.trim() || null,
  };
}

function pageItems<T>(body: CursorPage<T>): T[] {
  return body.items ?? body.data ?? [];
}

async function searchRecentSingleChats(opts: {
  dateAfter: string;
  limit: number;
}): Promise<BeeperChat[]> {
  const qs = new URLSearchParams({
    type: "single",
    lastActivityAfter: opts.dateAfter,
    limit: String(opts.limit),
    includeMuted: "true",
  });
  const res = await beeperFetch(`/v1/chats/search?${qs}`, { timeoutMs: 12_000 });
  if (res.status === 401 || res.status === 403) {
    throw new BeeperApiError(res.status, await readErrorDetail(res));
  }
  if (!res.ok) {
    // Fallback: list chats without activity filter.
    const listRes = await beeperFetch(
      `/v1/chats?${new URLSearchParams({
        type: "single",
        limit: String(opts.limit),
      })}`,
      { timeoutMs: 12_000 }
    );
    if (!listRes.ok) {
      throw new BeeperApiError(listRes.status, await readErrorDetail(listRes));
    }
    const listBody = (await listRes.json()) as CursorPage<BeeperChat>;
    return pageItems(listBody).filter((c) => !c.type || c.type === "single");
  }
  const body = (await res.json()) as CursorPage<BeeperChat>;
  return pageItems(body).filter((c) => !c.type || c.type === "single");
}

async function listChatMessages(
  chatId: string,
  limit: number
): Promise<BeeperMessage[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  const res = await beeperFetch(
    `/v1/chats/${encodeURIComponent(chatId)}/messages?${qs}`,
    { timeoutMs: 12_000 }
  );
  if (!res.ok) {
    // Per-chat failures shouldn't abort the whole sync.
    console.warn(
      "[beeper.listChatMessages]",
      chatId,
      res.status,
      await readErrorDetail(res)
    );
    return [];
  }
  const body = (await res.json()) as CursorPage<BeeperMessage>;
  return pageItems(body);
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
  const maxChats = Math.max(1, Math.min(80, opts?.maxChats ?? 80));
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
      const peer = peerFromChat(chat);
      const messages = await listChatMessages(chat.id, maxMessagesPerChat);
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
    }
  });
  await Promise.all(workers);

  out.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return out;
}
