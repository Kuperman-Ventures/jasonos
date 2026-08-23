// Gmail deep-link builder + normalizer.
//
// Why this exists: links like `https://mail.google.com/mail/u/0/#inbox/<id>`
// often "open Gmail but not the specific email." Two things break them:
//
//   1. `u/0` is an account *index*, not an account. When Jason is signed into
//      more than one Google account, `u/0` may be the wrong mailbox — the
//      thread id doesn't exist there, so Gmail just lands on the inbox.
//      Addressing the mailbox by email (`u/<email>`) routes to the right
//      account regardless of sign-in order.
//   2. `#inbox/<id>` only resolves if the thread is still in the Inbox. Once a
//      thread is archived/labeled it 404s to the inbox view. `#all/<id>`
//      resolves the conversation wherever it lives.
//
// Use `gmailThreadUrl()` when building our own links, and `normalizeGmailUrl()`
// to repair links authored elsewhere (e.g. the Morning Brief publisher).

// The primary mailbox the Morning Brief / sync integrations read from. Kept in
// sync with MY_EMAILS[0]. Overridable via env for other deployments. Uses a
// NEXT_PUBLIC fallback so client components (e.g. BriefText) can normalize too.
const DEFAULT_ACCOUNT = "jason@kupermanadvisors.com";

export function gmailAccount(): string {
  return (
    process.env.GMAIL_ACCOUNT_EMAIL ||
    process.env.NEXT_PUBLIC_GMAIL_ACCOUNT_EMAIL ||
    DEFAULT_ACCOUNT
  );
}

/**
 * A permalink that opens a specific Gmail conversation in the right mailbox.
 * `#all/` resolves the thread wherever it lives (inbox, archive, or a label).
 */
export function gmailThreadUrl(threadId: string, accountEmail?: string): string {
  const account = encodeURIComponent(accountEmail || gmailAccount());
  return `https://mail.google.com/mail/u/${account}/#all/${threadId}`;
}

const GMAIL_HOST_RE = /^https?:\/\/mail\.google\.com\/mail\//i;

const GMAIL_THREAD_HASH_RE =
  /#(?:all|inbox|imp|starred|sent|label\/[^/]+)\/([A-Za-z0-9_-]{4,})$/;

/** True when the URL is a Gmail permalink with a concrete thread/message id. */
export function isValidGmailThreadUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  if (!GMAIL_HOST_RE.test(url)) return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  } catch {
    return false;
  }
  return GMAIL_THREAD_HASH_RE.test(url.trim());
}

/**
 * Build or normalize a Gmail conversation link. Returns null when there is no
 * usable thread id (avoids links that open Gmail but not a specific email).
 */
export function sanitizeGmailThreadUrl(
  url: string | null | undefined,
  threadId?: string | null,
  accountEmail?: string | null
): string | null {
  if (threadId && /^[A-Za-z0-9_-]{4,}$/.test(threadId)) {
    const built = gmailThreadUrl(threadId, accountEmail ?? undefined);
    return isValidGmailThreadUrl(built) ? built : null;
  }
  if (!url?.trim()) return null;
  const normalized = normalizeGmailUrl(url.trim());
  return isValidGmailThreadUrl(normalized) ? normalized : null;
}

/**
 * Repair a Gmail URL so it opens the specific thread in the correct account:
 *   - rewrite the `u/<index-or-email>` segment to the configured account, and
 *   - promote `#inbox/<id>` (and other single-view hashes) to `#all/<id>` so
 *     archived/labeled threads still resolve.
 * Non-Gmail URLs (and anything we don't recognize) are returned unchanged.
 */
export function normalizeGmailUrl(url: string): string {
  if (!GMAIL_HOST_RE.test(url)) return url;
  try {
    const account = encodeURIComponent(gmailAccount());
    let out = url;

    // Normalize the mailbox segment: /mail/u/0/ or /mail/u/2/ or a stale email
    // → /mail/u/<account>/. Also handles the account-less /mail/#... form.
    if (/\/mail\/u\/[^/]+\//.test(out)) {
      out = out.replace(/\/mail\/u\/[^/]+\//, `/mail/u/${account}/`);
    } else {
      out = out.replace(/\/mail\/(#|$)/, `/mail/u/${account}/$1`);
    }

    // Promote a single-view hash to #all so the conversation resolves anywhere.
    // Only when the hash points at a specific thread id (has a trailing id).
    out = out.replace(
      /#(?:inbox|imp|starred|sent|label\/[^/]+)\/([A-Za-z0-9_-]+)$/,
      "#all/$1"
    );

    return out;
  } catch {
    return url;
  }
}
