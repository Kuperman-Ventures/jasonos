// Home → Text must open Beeper on THIS Mac.
//
// Chat IDs from the tunneled Desktop API are often install-local
// (`!room:ba_….local-whatsapp.localhost`, account `local-whatsapp_ba_…`).
// Putting those in beeper://select-thread/ works on the machine that
// produced them and toasts "invalid deep link" everywhere else.
//
// Portable path: beeper://compose/{platform}/{phone-or-handle}
// with no machine-specific accountID. Each Mac resolves its own account.
// Cloud Matrix rooms (`!id:beeper.local`) can still use select-thread.

export function beeperChatDeepLink(opts: {
  chatId?: string | null;
  accountId?: string | null;
  network?: string | null;
  phone?: string | null;
  username?: string | null;
}): string {
  const chatId = opts.chatId?.trim() || null;
  const phone = toE164(opts.phone);
  const resolved =
    resolvePlatform(opts.accountId, opts.network, chatId) ??
    (phone ? { platform: "local-imessage", queryAccount: null } : null);
  const recipient = phone || handleForCompose(opts.username);

  if (recipient && resolved) {
    return `beeper://compose/${resolved.platform}/${pathSegment(recipient)}`;
  }

  if (chatId && resolved && isPortableChatId(chatId) && resolved.queryAccount) {
    return `beeper://select-thread/${resolved.platform}/${chatId}?accountID=${resolved.queryAccount}`;
  }

  return "beeper://focus";
}

function resolvePlatform(
  accountId?: string | null,
  network?: string | null,
  chatId?: string | null
): { platform: string; queryAccount: string | null } | null {
  const raw = (accountId ?? "").trim();
  const localBridge = localBridgeId(raw);
  if (localBridge) {
    return { platform: localBridge, queryAccount: null };
  }

  const key =
    (raw.startsWith("bridge-")
      ? canonicalNetwork(raw.slice("bridge-".length))
      : canonicalNetwork(raw)) ?? canonicalNetwork(network ?? "");

  if (isLocalChatId(chatId) && key) {
    return { platform: localPlatformFor(key), queryAccount: null };
  }

  if (raw.startsWith("bridge-")) {
    const account = raw.slice("bridge-".length);
    return account ? { platform: raw, queryAccount: account } : null;
  }

  if (raw && !raw.includes("_") && !/^local-/i.test(raw)) {
    const cloudKey = canonicalNetwork(raw) ?? raw.toLowerCase();
    return { platform: `bridge-${cloudKey}`, queryAccount: cloudKey };
  }

  if (key) {
    return { platform: `bridge-${key}`, queryAccount: key };
  }

  return null;
}

function localPlatformFor(key: string): string {
  const map: Record<string, string> = {
    whatsapp: "local-whatsapp",
    instagramgo: "local-instagram",
    imessage: "local-imessage",
    telegram: "local-telegram",
    signal: "local-signal",
    linkedin: "local-linkedin",
    discordgo: "local-discord",
    facebookgo: "local-facebook",
    twitter: "local-twitter",
    hungryserv: "local-hungryserv",
  };
  return map[key] ?? `local-${key}`;
}

function localBridgeId(accountId: string): string | null {
  const match = accountId.match(/^(local-[a-z0-9]+)/i);
  return match ? match[1].toLowerCase() : null;
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

function toE164(phone?: string | null): string | null {
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

function handleForCompose(username?: string | null): string | null {
  const handle = username?.trim().replace(/^@/, "");
  return handle || null;
}

function pathSegment(value: string): string {
  return encodeURIComponent(value).replace(/%2B/g, "+");
}

/** iMessage/SMS on Beeper Desktop v4 when we only have a phone number. */
export function beeperTextFallbackLink(phone?: string | null): string {
  return beeperChatDeepLink({
    phone,
    accountId: "local-imessage",
  });
}
