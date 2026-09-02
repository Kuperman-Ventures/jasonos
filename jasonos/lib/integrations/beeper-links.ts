// Beeper deep links (from Desktop "Copy chat deep link"):
//   beeper://select-thread/bridge-whatsapp/!id:beeper.local?accountID=whatsapp
//
// Platform path is always bridge-{network}. accountID is the short network
// key (whatsapp), never a machine-local id like local-whatsapp_ba_….
//
// Chat ids from the tunneled Desktop API are often install-local
// (`!room:ba_….local-whatsapp.localhost`). Those only work on that Mac —
// do not put them in select-thread for the laptop.
//
// When we have a phone/handle, compose with the real bridge platform:
//   beeper://compose/bridge-whatsapp/+15551234567?accountID=whatsapp
// Invented platforms like local-whatsapp toast "invalid deep link".

export type BeeperLinkResult = {
  href: string;
  /** True when the URL should open a specific chat/compose target. */
  targetsChat: boolean;
  /** Why we could not jump to a specific chat, if any. */
  gap?: "missing_recipient" | "missing_platform" | "local_chat_only";
};

export function beeperChatDeepLink(opts: {
  chatId?: string | null;
  accountId?: string | null;
  network?: string | null;
  phone?: string | null;
  username?: string | null;
}): string {
  return resolveBeeperLink(opts).href;
}

export function resolveBeeperLink(opts: {
  chatId?: string | null;
  accountId?: string | null;
  network?: string | null;
  phone?: string | null;
  username?: string | null;
}): BeeperLinkResult {
  const chatId = opts.chatId?.trim() || null;
  const phone = toE164(opts.phone);
  const handle = handleForCompose(opts.username);
  const recipient = phone || handle;
  const networkKey = networkKeyFrom(opts.accountId, opts.network, chatId);

  // Prefer compose with a portable recipient — works on any Mac that has
  // that network connected. Never use local-* platform names.
  if (recipient && networkKey) {
    return {
      href: `beeper://compose/bridge-${networkKey}/${pathSegment(recipient)}?accountID=${networkKey}`,
      targetsChat: true,
    };
  }

  // Cloud Matrix rooms can use Copy-chat select-thread across devices.
  if (chatId && networkKey && isPortableChatId(chatId)) {
    return {
      href: `beeper://select-thread/bridge-${networkKey}/${chatId}?accountID=${networkKey}`,
      targetsChat: true,
    };
  }

  if (!recipient) {
    return {
      href: "beeper://focus",
      targetsChat: false,
      gap: "missing_recipient",
    };
  }

  // Phone on file but no network hint — try iMessage/SMS compose.
  return {
    href: `beeper://compose/bridge-imessage/${pathSegment(recipient)}?accountID=imessage`,
    targetsChat: true,
  };
}

/** Phone-only Text when Beeper search is unavailable. */
export function beeperTextFallbackLink(phone?: string | null): string {
  return resolveBeeperTextFallback(phone).href;
}

export function resolveBeeperTextFallback(
  phone?: string | null
): BeeperLinkResult {
  return resolveBeeperLink({ phone, network: "iMessage" });
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

  // bridge-whatsapp → whatsapp
  if (raw.startsWith("bridge-")) {
    return canonicalNetwork(raw.slice("bridge-".length));
  }

  // local-whatsapp_ba_… → whatsapp
  const local = raw.match(/^local-([a-z0-9]+)/i);
  if (local) {
    return canonicalNetwork(local[1]);
  }

  // Bare short ids: whatsapp, telegram, hungryserv, …
  if (!raw.includes("_") && !raw.includes(":")) {
    return canonicalNetwork(raw) ?? raw.toLowerCase();
  }

  return canonicalNetwork(raw);
}

function keyFromChatId(chatId?: string | null): string | null {
  if (!chatId) return null;
  // !room:ba_x.local-whatsapp.localhost → whatsapp
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
