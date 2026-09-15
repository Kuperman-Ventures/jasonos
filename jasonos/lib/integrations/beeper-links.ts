// Ordered Beeper open attempts for Home → Text.
//
// Beeper toasts "invalid deep link" when the URL shape is wrong for that
// install. Office Desktop chat IDs (`!room:….localhost`) and invented
// platforms (`local-whatsapp`) fail on the laptop. Raw `beeper://{chatID}`
// is not a real scheme.
//
// Callers try the next candidate when the previous attempt fails. HTTP
// `/v1/focus` can detect HTTP errors; the browser cascade uses blur/timeout.

export type BeeperLinkKind =
  | "compose"
  | "select-thread"
  | "native-sms"
  | "native-imessage"
  | "focus-app";

export type BeeperHrefCandidate = {
  href: string;
  kind: BeeperLinkKind;
  /** True when this URL does not embed another Mac's chat id. */
  portable: boolean;
  label: string;
};

export type BeeperOpenInput = {
  chatId?: string | null;
  localChatId?: string | null;
  accountId?: string | null;
  network?: string | null;
  phone?: string | null;
  username?: string | null;
};

const MAX_HREFS = 10;

export function isLocalChatId(chatId?: string | null): boolean {
  if (!chatId) return false;
  return /\.localhost\b/i.test(chatId) || /^local-/i.test(chatId);
}

export function isPortableChatId(chatId?: string | null): boolean {
  if (!chatId || isLocalChatId(chatId)) return false;
  return /:(beeper\.(local|com)|matrix\.org)$/i.test(chatId);
}

/**
 * IDs that `/v1/focus` can take without Desktop building a bad deep link.
 * Numeric `localChatID` is this-install. Cloud Matrix rooms are portable.
 * `*.localhost` Matrix rooms are office-only — skip them.
 */
export function isFocusableChatId(chatId?: string | null): boolean {
  const id = chatId?.trim();
  if (!id) return false;
  if (isLocalChatId(id)) return false;
  if (/^\d+$/.test(id)) return true;
  return isPortableChatId(id);
}

export function beeperFocusChatIds(input: BeeperOpenInput): string[] {
  const out: string[] = [];
  const push = (value?: string | null) => {
    const id = value?.trim();
    if (!id || out.includes(id) || !isFocusableChatId(id)) return;
    out.push(id);
  };
  push(input.localChatId);
  push(input.chatId);
  if (input.chatId) {
    try {
      push(decodeURIComponent(input.chatId));
    } catch {
      /* ignore malformed encoding */
    }
  }
  return out;
}

export function networkKeyFrom(
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

export function buildBeeperHrefCascade(
  input: BeeperOpenInput
): BeeperHrefCandidate[] {
  const out: BeeperHrefCandidate[] = [];
  const seen = new Set<string>();
  const add = (candidate: BeeperHrefCandidate) => {
    if (seen.has(candidate.href)) return;
    if (hrefLooksUnsafe(candidate.href)) return;
    seen.add(candidate.href);
    out.push(candidate);
  };

  const e164 = toE164(input.phone);
  const national = e164?.startsWith("+1") ? e164.slice(2) : null;
  const handle = handleForCompose(input.username);
  const matchedKey = networkKeyFrom(
    input.accountId,
    input.network,
    input.chatId
  );
  const networkKeys = unique(
    [matchedKey, e164 ? "imessage" : null].filter(
      (value): value is string => Boolean(value)
    )
  );

  // Level 1 — compose by phone on the matched network, then iMessage.
  // Copy-chat uses bridge-{network} + short accountID, never local-*.
  for (const key of networkKeys) {
    if (!e164) break;
    add(
      composeCandidate(
        `bridge-${key}`,
        e164,
        key,
        `compose bridge-${key} ${e164}`
      )
    );
    add(composeCandidate(key, e164, key, `compose ${key} ${e164}`));
    add(
      composeCandidate(
        `bridge-${key}`,
        e164,
        null,
        `compose bridge-${key} ${e164} (no account)`
      )
    );
    add({
      href: `beeper://compose/bridge-${key}/user/${pathSegment(e164)}?accountID=${key}`,
      kind: "compose",
      portable: true,
      label: `compose bridge-${key} user ${e164}`,
    });
  }

  // Level 2 — same chat, national digits (iMessage titles are often 10-digit).
  if (e164 && national && national !== e164) {
    const key = networkKeys[0] ?? "imessage";
    add(
      composeCandidate(
        `bridge-${key}`,
        national,
        key,
        `compose bridge-${key} ${national}`
      )
    );
  }

  // Level 3 — LinkedIn / IG handle when there is no usable phone compose.
  if (handle) {
    const key = matchedKey ?? "linkedin";
    add(
      composeCandidate(
        `bridge-${key}`,
        handle,
        key,
        `compose bridge-${key} ${handle}`
      )
    );
    add(composeCandidate(key, handle, key, `compose ${key} ${handle}`));
  }

  // Level 4 — Copy-chat select-thread, cloud Matrix rooms only.
  if (isPortableChatId(input.chatId) && matchedKey) {
    add({
      href: `beeper://select-thread/bridge-${matchedKey}/${input.chatId}?accountID=${matchedKey}`,
      kind: "select-thread",
      portable: true,
      label: `select-thread bridge-${matchedKey}`,
    });
    add({
      href: `beeper://select-thread/${matchedKey}/${input.chatId}?accountID=${matchedKey}`,
      kind: "select-thread",
      portable: true,
      label: `select-thread ${matchedKey}`,
    });
  }

  // Level 5 — native Messages if Beeper protocol handling is dead.
  if (e164) {
    add({
      href: `sms:${e164}`,
      kind: "native-sms",
      portable: true,
      label: "Messages SMS",
    });
    add({
      href: `imessage:${e164}`,
      kind: "native-imessage",
      portable: true,
      label: "Messages iMessage",
    });
  }

  // Level 6 — just bring Beeper forward.
  add({
    href: "beeper://focus",
    kind: "focus-app",
    portable: true,
    label: "open Beeper",
  });

  return out.slice(0, MAX_HREFS);
}

export function beeperHrefStrings(input: BeeperOpenInput): string[] {
  return buildBeeperHrefCascade(input).map((candidate) => candidate.href);
}

/** Try each href until `attempt` returns true. */
export async function walkBeeperHrefCascade(
  hrefs: readonly string[],
  attempt: (href: string) => Promise<boolean>
): Promise<string | null> {
  for (const href of hrefs) {
    if (await attempt(href)) return href;
  }
  return null;
}

function composeCandidate(
  platform: string,
  recipient: string,
  accountID: string | null,
  label: string
): BeeperHrefCandidate {
  const path = pathSegment(recipient);
  const query = accountID
    ? `?accountID=${encodeURIComponent(accountID)}`
    : "";
  return {
    href: `beeper://compose/${platform}/${path}${query}`,
    kind: "compose",
    portable: true,
    label,
  };
}

function hrefLooksUnsafe(href: string): boolean {
  if (/local-/i.test(href)) return true;
  if (/\.localhost/i.test(href)) return true;
  // Raw chat id with no select-thread / compose path.
  if (/^beeper:\/\/!/i.test(href)) return true;
  return false;
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

function handleForCompose(username?: string | null): string | null {
  const handle = username?.trim().replace(/^@/, "");
  return handle || null;
}

function pathSegment(value: string): string {
  return encodeURIComponent(value).replace(/%2B/g, "+");
}

function unique<T>(items: T[]): T[] {
  const out: T[] = [];
  for (const item of items) {
    if (!out.includes(item)) out.push(item);
  }
  return out;
}
