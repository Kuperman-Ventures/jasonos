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
  chatID: string;
  timestamp: string;
  text?: string;
  isSender?: boolean;
  isDeleted?: boolean;
  type?: string;
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
    throw new BeeperUnavailableError("Beeper access token is not configured.");
  }

  const timeoutMs = init?.timeoutMs ?? 4_000;
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

/** Probe Desktop API. Throws BeeperUnavailableError when closed / unreachable. */
export async function probeBeeperDesktop(): Promise<{ ok: true }> {
  const res = await beeperFetch("/v1/info", { timeoutMs: 2_500 });
  if (!res.ok) {
    throw new BeeperUnavailableError(BEEPER_UNAVAILABLE_MESSAGE);
  }
  return { ok: true };
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

async function searchMessages(params: {
  dateAfter: string;
  sender: "me" | "others";
  limit: number;
}): Promise<BeeperMessage[]> {
  const qs = new URLSearchParams({
    chatType: "single",
    dateAfter: params.dateAfter,
    sender: params.sender,
    limit: String(params.limit),
    includeMuted: "true",
  });
  const res = await beeperFetch(`/v1/messages/search?${qs}`, {
    timeoutMs: 10_000,
  });
  if (!res.ok) {
    // 4xx from a live server is a real API problem; connection issues throw above.
    if (res.status >= 500) {
      throw new BeeperUnavailableError(BEEPER_UNAVAILABLE_MESSAGE);
    }
    return [];
  }
  const body = (await res.json()) as {
    items?: BeeperMessage[];
    data?: BeeperMessage[];
  };
  return body.items ?? body.data ?? [];
}

async function retrieveChat(chatId: string): Promise<BeeperChat | null> {
  const res = await beeperFetch(`/v1/chats/${encodeURIComponent(chatId)}`, {
    timeoutMs: 6_000,
  });
  if (!res.ok) return null;
  return (await res.json()) as BeeperChat;
}

/**
 * Pull recent 1:1 outbound (+ optional inbound) messages for touch capture.
 * Soft-fails via BeeperUnavailableError when Desktop isn't reachable.
 */
export async function fetchBeeperTouchCandidates(opts?: {
  daysBack?: number;
  maxMessages?: number;
  includeInbound?: boolean;
}): Promise<BeeperTouchCandidate[]> {
  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 30));
  const maxMessages = Math.max(1, Math.min(200, opts?.maxMessages ?? 100));
  const includeInbound = opts?.includeInbound ?? true;

  await probeBeeperDesktop();

  const after = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const perQuery = Math.ceil(maxMessages / (includeInbound ? 2 : 1));

  const outbound = await searchMessages({
    dateAfter: after,
    sender: "me",
    limit: perQuery,
  });
  const inbound = includeInbound
    ? await searchMessages({
        dateAfter: after,
        sender: "others",
        limit: perQuery,
      })
    : [];

  const messages = [...outbound, ...inbound]
    .filter((m) => !m.isDeleted)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, maxMessages);

  if (!messages.length) return [];

  const chatIds = Array.from(new Set(messages.map((m) => m.chatID)));
  const chatById = new Map<string, BeeperChat>();
  await Promise.all(
    chatIds.map(async (id) => {
      const chat = await retrieveChat(id);
      if (chat) chatById.set(id, chat);
    })
  );

  const out: BeeperTouchCandidate[] = [];
  for (const m of messages) {
    const chat = chatById.get(m.chatID);
    if (!chat) continue;
    if (chat.type && chat.type !== "single") continue;
    const peer = peerFromChat(chat);
    const outboundMsg = Boolean(m.isSender);
    out.push({
      messageId: m.id,
      chatId: m.chatID,
      timestamp: m.timestamp,
      text: m.text?.trim() || null,
      network: chat.network ?? null,
      chatTitle: chat.title ?? null,
      peer,
      direction: outboundMsg ? "outbound" : "inbound",
    });
  }

  return out;
}
