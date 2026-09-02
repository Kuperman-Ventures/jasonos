// Beeper's own "Copy chat deep link" (Developer menu) is:
//   beeper://select-thread/{platformName}/{chatId}?accountID={accountID}
// e.g. beeper://select-thread/bridge-whatsapp/!abc:beeper.local?accountID=whatsapp
//
// Do not invent schemes like beeper://chat/ — Beeper toasts "invalid deep link"
// and still launches the app. Do not percent-encode ! or : in the chat id.

export function beeperChatDeepLink(opts: {
  chatId?: string | null;
  accountId?: string | null;
}): string {
  const chatId = opts.chatId?.trim();
  const raw = (opts.accountId ?? "").trim();
  if (!chatId || !raw) return "beeper://focus";
  const account = raw.replace(/^bridge-/, "");
  const platform = raw.startsWith("bridge-") ? raw : `bridge-${account}`;
  return `beeper://select-thread/${platform}/${chatId}?accountID=${account}`;
}
