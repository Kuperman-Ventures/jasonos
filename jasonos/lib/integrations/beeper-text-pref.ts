// Home → Text network preference. Pure — no Desktop calls.

export type BeeperTextChat = {
  network?: string | null;
  accountID?: string | null;
};

/** 0 = iMessage/SMS (best), 1 = LinkedIn, 2 = everything else. */
export function beeperTextNetworkRank(chat: BeeperTextChat): number {
  const hay = `${chat.network ?? ""} ${chat.accountID ?? ""}`.toLowerCase();
  if (
    hay.includes("imessage") ||
    hay.includes("androidsms") ||
    /(^|[^a-z])sms([^a-z]|$)/.test(hay)
  ) {
    return 0;
  }
  if (hay.includes("linkedin")) return 1;
  return 2;
}

/** Among already-matched 1:1s, prefer iMessage, then LinkedIn, then any other. */
export function pickPreferredTextChat<T extends BeeperTextChat>(
  chats: T[]
): T | undefined {
  if (!chats.length) return undefined;
  return [...chats].sort(
    (a, b) => beeperTextNetworkRank(a) - beeperTextNetworkRank(b)
  )[0];
}
