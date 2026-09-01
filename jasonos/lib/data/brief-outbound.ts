import { hrefFromMarkdownUrl, mdLinkRe } from "./brief-links";
import { isValidGmailThreadUrl, sanitizeGmailThreadUrl } from "../integrations/gmail-links";

// Outbound-link policy for published Morning Briefs.
//
// The publisher sometimes pastes a newsletter-issue landing page, a Gmail
// permalink, or a Google redirect onto a digest *story*. Home then offers
// "Open article in browser" and Jason lands on the wrong page (or a Google
// error). If we cannot tell the URL is the article (or a real email /
// calendar / meeting link in the right context), we do not make it a
// hyperlink — the title and summary still show.

export type BriefLinkKind = "article" | "email" | "calendar" | "meeting";

const ALL_KINDS: BriefLinkKind[] = ["article", "email", "calendar", "meeting"];

const BARE_URL_RE = /(https?:\/\/[^\s<>"'`)\]}]+)/g;

function parseHref(raw: string): URL | null {
  try {
    const u = new URL(hrefFromMarkdownUrl(raw));
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

function hostOf(u: URL): string {
  return u.hostname.toLowerCase();
}

function apexHost(hostname: string): string {
  return hostname.replace(/^www\./, "");
}

function isGoogleCalendarUrl(u: URL): boolean {
  const host = hostOf(u);
  if (host === "calendar.google.com") return true;
  if (host === "www.google.com" || host === "google.com") {
    return /\/calendar\//.test(u.pathname);
  }
  return false;
}

function isGoogleMeetUrl(u: URL): boolean {
  return hostOf(u) === "meet.google.com";
}

function isZoomUrl(u: URL): boolean {
  const host = hostOf(u);
  return host === "zoom.us" || host.endsWith(".zoom.us");
}

function isGmailUrl(u: URL): boolean {
  return hostOf(u) === "mail.google.com";
}

/** Google search / redirect / news / sorry pages — not a destination we trust. */
function isGoogleInterstitialUrl(u: URL): boolean {
  const host = hostOf(u);
  if (isGoogleCalendarUrl(u) || isGoogleMeetUrl(u) || isGmailUrl(u)) return false;
  return (
    host === "google.com" ||
    host === "www.google.com" ||
    host === "news.google.com" ||
    host === "accounts.google.com"
  );
}

function isTrackingOrViewOnline(u: URL): boolean {
  const hay = `${u.pathname}${u.search}`;
  return /unsubscribe|email-preferences|view-in-browser|viewonline|manage-preferences/i.test(
    hay
  );
}

/**
 * Morning Brew family edition pages (`/issues/come-get-your-honey`) are the
 * whole newsletter, not the story the digest titled. A french-press teaser
 * on that page is not a match.
 */
function isNewsletterIssueLanding(u: URL): boolean {
  if (!/\/issues\//i.test(u.pathname)) return false;
  const apex = apexHost(hostOf(u));
  return apex === "morningbrew.com" || apex.endsWith("brew.com");
}

function usableGmailHref(raw: string): string | null {
  return sanitizeGmailThreadUrl(raw);
}

/**
 * Classify a URL, or `null` when it should never be a hyperlink.
 * Gmail without a concrete thread id, Google error/redirect pages, and
 * newsletter-issue landings are `null`.
 */
export function classifyBriefUrl(raw: string): BriefLinkKind | null {
  const u = parseHref(raw);
  if (!u) return null;

  if (isGmailUrl(u)) {
    const usable = usableGmailHref(raw) ?? usableGmailHref(u.href);
    if (usable && isValidGmailThreadUrl(usable)) return "email";
    return null;
  }
  if (isGoogleCalendarUrl(u)) return "calendar";
  if (isGoogleMeetUrl(u) || isZoomUrl(u)) return "meeting";
  if (isGoogleInterstitialUrl(u)) return null;
  if (isTrackingOrViewOnline(u)) return null;
  if (isNewsletterIssueLanding(u)) return null;

  return "article";
}

export function isAllowedBriefHref(
  href: string,
  allow: readonly BriefLinkKind[] = ALL_KINDS
): boolean {
  const kind = classifyBriefUrl(href);
  return kind !== null && allow.includes(kind);
}

/** Article URL for a digest story, or null if we would be guessing. */
export function usableArticleUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return classifyBriefUrl(url) === "article" ? hrefFromMarkdownUrl(url) : null;
}

function canonicalArticleKey(url: string): string {
  try {
    const u = new URL(hrefFromMarkdownUrl(url));
    u.hash = "";
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ]) {
      u.searchParams.delete(key);
    }
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const search = u.searchParams.toString();
    return `${u.hostname.toLowerCase()}${path}${search ? `?${search}` : ""}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * Turn markdown / bare URLs into plain text when the href is not allowed.
 * Keeps the human label so the item still reads; drops a rejected bare URL.
 */
export function unlinkDisallowedHrefs(
  input: string,
  allow: readonly BriefLinkKind[] = ALL_KINDS
): string {
  if (!input) return input;
  let out = input.replace(mdLinkRe(), (full, label: string, url: string) => {
    const href = hrefFromMarkdownUrl(url);
    if (isAllowedBriefHref(href, allow)) return `[${label}](${href})`;
    return String(label ?? "").trim() || full;
  });
  out = out.replace(BARE_URL_RE, (raw) => {
    const cleaned = raw.replace(/[.,;:!?]+$/, "");
    const trailing = raw.slice(cleaned.length);
    if (isAllowedBriefHref(cleaned, allow)) return raw;
    return trailing;
  });
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

const ARTICLE_ONLY: BriefLinkKind[] = ["article"];

export function unlinkNonArticleHrefs(input: string): string {
  return unlinkDisallowedHrefs(input, ARTICLE_ONLY);
}

export interface StoryUrlFields {
  url: string | null;
  summary: string;
}

/** Drop a story URL that is not a real article page. Summary stays readable. */
export function sanitizeStoryArticleLink<T extends StoryUrlFields>(story: T): T {
  const url = usableArticleUrl(story.url);
  const summary = unlinkNonArticleHrefs(story.summary);
  if (url === story.url && summary === story.summary) return story;
  return { ...story, url, summary };
}

/**
 * The same URL on two differently titled stories is a publisher shortcut
 * (one LinkedIn roundup reused, one issue page reused). Neither is a match.
 */
export function dropReusedArticleUrls<T extends { url: string | null }>(
  stories: T[]
): T[] {
  const counts = new Map<string, number>();
  for (const s of stories) {
    if (!s.url) continue;
    const key = canonicalArticleKey(s.url);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return stories.map((s) => {
    if (!s.url) return s;
    if ((counts.get(canonicalArticleKey(s.url)) ?? 0) <= 1) return s;
    return { ...s, url: null };
  });
}

export function sanitizeNewsletterGroups<
  T extends { stories: Array<{ url: string | null; summary: string }> },
>(groups: T[]): T[] {
  const cleaned = groups.map((g) => ({
    ...g,
    stories: g.stories.map((s) => sanitizeStoryArticleLink(s)),
  }));
  const counts = new Map<string, number>();
  for (const g of cleaned) {
    for (const s of g.stories) {
      if (!s.url) continue;
      const key = canonicalArticleKey(s.url);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return cleaned.map((g) => ({
    ...g,
    stories: g.stories.map((s) => {
      if (!s.url) return s;
      if ((counts.get(canonicalArticleKey(s.url)) ?? 0) <= 1) return s;
      return { ...s, url: null };
    }),
  }));
}
