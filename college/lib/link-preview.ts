/** Open Graph / meta link previews for URL ingest and Notes. */

export type LinkPreview = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  /** Stripped page text for suggestion models (capped). */
  text: string;
};

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function decodeEntities(value: string): string {
  return decodeHtmlEntities(value);
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]?.trim()) return decodeEntities(match[1].trim());
    }
  }
  return null;
}

function documentTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (!match?.[1]?.trim()) return null;
  return decodeEntities(match[1].trim());
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function absoluteUrl(base: string, maybe: string | null | undefined): string | null {
  if (!maybe?.trim()) return null;
  try {
    return new URL(maybe.trim(), base).href;
  } catch {
    return null;
  }
}

/** Parse Open Graph / Twitter / basic meta from raw HTML. */
export function parseLinkPreviewHtml(html: string, pageUrl: string): LinkPreview {
  const title =
    metaContent(html, ["og:title", "twitter:title"]) || documentTitle(html) || null;
  const description =
    metaContent(html, ["og:description", "twitter:description", "description"]) || null;
  const imageRaw =
    metaContent(html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]) ||
    null;
  const siteName = metaContent(html, ["og:site_name"]) || null;
  const text = stripHtmlToText(html).slice(0, 20000);

  return {
    title: title?.slice(0, 200) || null,
    description: description?.slice(0, 600) || null,
    imageUrl: absoluteUrl(pageUrl, imageRaw),
    siteName: siteName?.slice(0, 120) || null,
    text,
  };
}

export function summarizeLinkPreview(preview: LinkPreview): string {
  if (preview.description?.trim()) return preview.description.trim().slice(0, 480);
  if (preview.text.trim()) return preview.text.trim().slice(0, 480);
  return "";
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("URL must start with http:// or https://");
  }

  const response = await fetch(trimmed, {
    signal: AbortSignal.timeout(12000),
    headers: {
      "User-Agent": "KyleCollegePortal/0.1 (+link-preview)",
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Could not fetch URL (${response.status})`);

  const finalUrl = response.url || trimmed;
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  if (contentType.includes("html") || /<html[\s>]/i.test(raw) || /<head[\s>]/i.test(raw)) {
    return parseLinkPreviewHtml(raw, finalUrl);
  }

  const text = raw.trim().slice(0, 20000);
  return {
    title: null,
    description: text.slice(0, 480) || null,
    imageUrl: null,
    siteName: null,
    text,
  };
}
