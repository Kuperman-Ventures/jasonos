"use client";

/**
 * Open a Beeper chat on THE Mac running this browser.
 *
 * Deep links like beeper://compose/.../+phone are not real Beeper URLs and
 * toast "invalid deep link". The supported way is this Mac's Desktop API:
 *   GET  /v1/accounts
 *   POST /v1/chats/start  { accountID, user: { phoneNumber } }
 *   POST /v1/focus       { chatID }
 *
 * Tunneled API search still runs on the office Mac — only these localhost
 * calls raise Beeper in front of Jason.
 */

export type LocalBeeperOpenInput = {
  baseUrl: string;
  accessToken: string;
  phone: string;
  contactName?: string | null;
  networkHint?: string | null;
};

export type LocalBeeperOpenResult =
  | { ok: true; chatTitle?: string; network?: string }
  | { ok: false; reason: "unreachable" | "cors" | "auth" | "no_account" | "api"; detail?: string };

type BeeperAccount = {
  accountID?: string;
  id?: string;
  network?: string;
  bridge?: { type?: string; id?: string; provider?: string };
  status?: string;
};

type StartChatResponse = {
  id?: string;
  chatID?: string;
  title?: string;
  network?: string;
};

const TEXT_NETWORK_RANK = [
  "imessage",
  "sms",
  "androidsms",
  "whatsapp",
  "signal",
  "telegram",
];

export async function openBeeperChatOnThisMac(
  input: LocalBeeperOpenInput
): Promise<LocalBeeperOpenResult> {
  const base = input.baseUrl.replace(/\/$/, "");
  const headers: HeadersInit = {
    Accept: "application/json",
    Authorization: `Bearer ${input.accessToken}`,
    "Content-Type": "application/json",
  };

  let accounts: BeeperAccount[];
  try {
    const res = await fetch(`${base}/v1/accounts`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "auth", detail: `accounts ${res.status}` };
    }
    if (!res.ok) {
      return { ok: false, reason: "api", detail: `accounts ${res.status}` };
    }
    const body = (await res.json()) as
      | BeeperAccount[]
      | { accounts?: BeeperAccount[]; items?: BeeperAccount[]; data?: BeeperAccount[] };
    accounts = Array.isArray(body)
      ? body
      : (body.accounts ?? body.items ?? body.data ?? []);
  } catch (err) {
    return classifyFetchError(err);
  }

  const accountId = pickTextAccountId(accounts, input.networkHint);
  if (!accountId) {
    return { ok: false, reason: "no_account" };
  }

  let chatId: string | undefined;
  let chatTitle: string | undefined;
  let network: string | undefined;
  try {
    const res = await fetch(`${base}/v1/chats/start`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        accountID: accountId,
        user: {
          phoneNumber: input.phone,
          fullName: input.contactName?.trim() || undefined,
        },
      }),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "auth", detail: `chats/start ${res.status}` };
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        reason: "api",
        detail: `chats/start ${res.status} ${detail}`.trim(),
      };
    }
    const started = (await res.json()) as StartChatResponse;
    chatId = started.id || started.chatID;
    chatTitle = started.title;
    network = started.network;
    if (!chatId) {
      return { ok: false, reason: "api", detail: "chats/start returned no chat id" };
    }
  } catch (err) {
    return classifyFetchError(err);
  }

  try {
    const res = await fetch(`${base}/v1/focus`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({ chatID: chatId }),
    });
    if (!res.ok) {
      // Chat was created/found; focus failing is still partial success if Beeper is up.
      // Try focusing the app without a chat id.
      await fetch(`${base}/v1/focus`, {
        method: "POST",
        headers,
        cache: "no-store",
        body: JSON.stringify({}),
      }).catch(() => null);
    }
  } catch {
    // Chat exists; deep-link focus as last resort is handled by caller.
  }

  return {
    ok: true,
    chatTitle: chatTitle || input.contactName || undefined,
    network,
  };
}

function pickTextAccountId(
  accounts: BeeperAccount[],
  networkHint?: string | null
): string | null {
  const usable = accounts
    .map((a) => ({
      id: (a.accountID || a.id || "").trim(),
      network: (a.network || a.bridge?.type || a.bridge?.id || "").toLowerCase(),
      status: (a.status || "connected").toLowerCase(),
    }))
    .filter((a) => a.id && a.status !== "disabled" && a.status !== "disconnected");

  if (!usable.length) return null;

  const hint = (networkHint || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (hint) {
    const hinted = usable.find((a) => a.network.includes(hint) || hint.includes(a.network));
    if (hinted) return hinted.id;
  }

  for (const key of TEXT_NETWORK_RANK) {
    const match = usable.find((a) => a.network.includes(key));
    if (match) return match.id;
  }
  return usable[0]?.id ?? null;
}

function classifyFetchError(err: unknown): LocalBeeperOpenResult {
  const message = err instanceof Error ? err.message : String(err);
  // Browsers surface CORS failures as TypeError: Failed to fetch
  if (/failed to fetch|networkerror|load failed|cors/i.test(message)) {
    return { ok: false, reason: "cors", detail: message };
  }
  return { ok: false, reason: "unreachable", detail: message };
}
