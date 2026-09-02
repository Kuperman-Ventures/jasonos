// Deep links that open Beeper on *this* Mac. The Desktop API /v1/focus only
// focuses whichever machine the tunnel points at (usually the office desktop).

export function beeperChatDeepLink(opts: {
  chatId?: string | null;
  accountId?: string | null;
}): string {
  const chatId = opts.chatId?.trim();
  if (!chatId) return "beeper://focus";
  const thread = encodeURIComponent(chatId);
  const raw = (opts.accountId ?? "").trim();
  if (!raw) return `beeper://chat/${thread}`;
  const platform = raw.startsWith("bridge-") ? raw : `bridge-${raw}`;
  const account = raw.replace(/^bridge-/, "");
  return `beeper://select-thread/${encodeURIComponent(platform)}/${thread}?accountID=${encodeURIComponent(account)}`;
}
