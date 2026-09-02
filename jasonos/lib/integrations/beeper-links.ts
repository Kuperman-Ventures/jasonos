// Proven Beeper deep links only.
//
// From Desktop "Copy chat deep link":
//   beeper://select-thread/bridge-whatsapp/!id:beeper.local?accountID=whatsapp
//
// Also valid: beeper://focus (opens/focuses the app).
//
// Do NOT invent beeper://compose/.../+phone URLs. Beeper toasts
// "invalid deep link" for those. Opening a chat by phone must use the
// Desktop API on THIS Mac: POST /v1/chats/start then POST /v1/focus.

export type BeeperLinkResult = {
  href: string;
  /** True only for a portable select-thread link to a specific chat. */
  targetsChat: boolean;
  gap?: "missing_recipient" | "local_chat_only" | "missing_platform";
};

export function beeperFocusLink(): string {
  return "beeper://focus";
}

/**
 * Build a deep link Beeper will accept.
 * - Portable cloud Matrix room → select-thread (Copy-chat shape)
 * - Anything else → focus only (never invent compose)
 */
export function resolveBeeperLink(opts: {
  chatId?: string | null;
  accountId?: string | null;
  network?: string | null;
  phone?: string | null;
  username?: string | null;
}): BeeperLinkResult {
  const chatId = opts.chatId?.trim() || null;
  const networkKey = networkKeyFrom(opts.accountId, opts.network, chatId);
  const hasRecipient = Boolean(toE164(opts.phone) || handleForCompose(opts.username));

  if (chatId && networkKey && isPortableChatId(chatId)) {
    return {
      href: `beeper://select-thread/bridge-${networkKey}/${chatId}?accountID=${networkKey}`,
      targetsChat: true,
    };
  }

  if (chatId && isLocalChatId(chatId)) {
    return {
      href: beeperFocusLink(),
      targetsChat: false,
      gap: hasRecipient ? "local_chat_only" : "missing_recipient",
    };
  }

  if (!hasRecipient) {
    return {
      href: beeperFocusLink(),
      targetsChat: false,
      gap: "missing_recipient",
    };
  }

  // Phone/handle on file, but no portable chat id — open the app only.
  // The client should open the chat via this Mac's Desktop API instead.
  return {
    href: beeperFocusLink(),
    targetsChat: false,
    gap: networkKey ? "local_chat_only" : "missing_platform",
  };
}

export function beeperChatDeepLink(opts: {
  chatId?: string | null;
  accountId?: string | null;
  network?: string | null;
  phone?: string | null;
  username?: string | null;
}): string {
  return resolveBeeperLink(opts).href;
}

export function resolveBeeperTextFallback(
  phone?: string | null
): BeeperLinkResult {
  return resolveBeeperLink({ phone, network: "iMessage" });
}

export function beeperTextFallbackLink(phone?: string | null): string {
  return resolveBeeperTextFallback(phone).href;
}

export function toE164(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, "");
  if (!digits) return null;
  const national =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits.length > 10
        ? digits.slice(-10)
        : digits;
  if (national.length === 10) return `+1${national}`;
  if (national.length < 8) return null;
  return `+${national}`;
}

function networkKeyFrom(
  accountId?: string | null,
  network?: string | null,
  chatId?: string | null
): string | null {
  const fromAccount = keyFromAccountId(accountId);
  if (fromAccount) return fromAccount;
  const fromNetwork = canonicalNetwork(network ?? "");
  if (fromNetwork) return fromNetwork;
  return keyFromChatId(chatId);
}

function keyFromAccountId(accountId?: string | null): string | null {
  const raw = (accountId ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("bridge-")) {
    return canonicalNetwork(raw.slice("bridge-".length));
  }
  const local = raw.match(/^local-([a-z0-9]+)/i);
  if (local) return canonicalNetwork(local[1]);
  if (!raw.includes("_") && !raw.includes(":")) {
    return canonicalNetwork(raw) ?? raw.toLowerCase();
  }
  return canonicalNetwork(raw);
}

function keyFromChatId(chatId?: string | null): string | null {
  if (!chatId) return null;
  const local = chatId.match(/\.local-([a-z0-9]+)\.localhost$/i);
  if (local) return canonicalNetwork(local[1]);
  return null;
}

function canonicalNetwork(raw: string): string | null {
  const compact = raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!compact) return null;
  const aliases: Array<[string, string]> = [
    ["instagramgo", "instagramgo"],
    ["instagram", "instagramgo"],
    ["facebookgo", "facebookgo"],
    ["facebook", "facebookgo"],
    ["messenger", "facebookgo"],
    ["discordgo", "discordgo"],
    ["discord", "discordgo"],
    ["hungryserv", "hungryserv"],
    ["whatsapp", "whatsapp"],
    ["imessage", "imessage"],
    ["androidsms", "imessage"],
    ["telegram", "telegram"],
    ["linkedin", "linkedin"],
    ["twitter", "twitter"],
    ["signal", "signal"],
    ["beeper", "hungryserv"],
    ["matrix", "hungryserv"],
    ["sms", "imessage"],
  ];
  for (const [alias, key] of aliases) {
    if (compact === alias || compact.includes(alias)) return key;
  }
  if (compact === "x") return "twitter";
  return null;
}

function isLocalChatId(chatId?: string | null): boolean {
  if (!chatId) return false;
  return /\.localhost\b/i.test(chatId) || /^local-/i.test(chatId);
}

function isPortableChatId(chatId: string): boolean {
  if (isLocalChatId(chatId)) return false;
  return /:(beeper\.(local|com)|matrix\.org)$/i.test(chatId);
}

function handleForCompose(username?: string | null): string | null {
  const handle = username?.trim().replace(/^@/, "");
  return handle || null;
}
