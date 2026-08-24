// Shared markdown-link helpers for published Morning Brief prose.
//
// Google Calendar event URLs put a space in `eid` (base64 of
// "eventId calendarId"). Markdown `[label](https://…)` parsers that stop at
// whitespace then spill the rest of the URL as visible text and blow out
// layout. Match through the closing `)` and turn those spaces into `%20`.

const MD_LINK_SRC = String.raw`\[([^\]]+)\]\((https?:\/\/[^)]+)\)`;

/** New regex each call — a shared `/g` object would leak lastIndex. */
export function mdLinkRe(): RegExp {
  return new RegExp(MD_LINK_SRC, "g");
}

export function matchMdLink(
  input: string
): { label: string; url: string; index: number; length: number } | null {
  const m = input.match(new RegExp(MD_LINK_SRC));
  if (!m || m.index == null) return null;
  return {
    label: m[1].trim(),
    url: hrefFromMarkdownUrl(m[2]),
    index: m.index,
    length: m[0].length,
  };
}

export function bareUrlRe(): RegExp {
  return /(https?:\/\/[^\s<>"'`)\]}]+)/g;
}

/** Encode whitespace in a URL so it is a valid href. Leaves `%xx` alone. */
export function hrefFromMarkdownUrl(raw: string): string {
  return raw.trim().replace(/\s+/g, "%20");
}

export function rewriteMarkdownHrefs(input: string): string {
  return input.replace(
    mdLinkRe(),
    (_m, label: string, url: string) => `[${label}](${hrefFromMarkdownUrl(url)})`
  );
}

export type BriefLinkPiece =
  | { type: "text"; value: string }
  | { type: "link"; label: string; href: string };

function hostnameOf(href: string): string | null {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Short label when the publisher pasted a raw URL instead of `[title](url)`. */
export function friendlyLinkLabel(href: string, label?: string): string {
  const trimmed = (label ?? "").trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) return trimmed;

  const host = hostnameOf(href);
  if (host) {
    if (
      (host === "www.google.com" || host === "google.com" || host.endsWith(".google.com")) &&
      /\/calendar\//.test(href)
    ) {
      return "Open in Calendar";
    }
    if (host === "calendar.google.com") return "Open in Calendar";
    if (host.includes("zoom.us")) return "Zoom";
    if (host === "meet.google.com") return "Meet";
  }

  if (trimmed && trimmed.length <= 48) return trimmed;
  return "Open link";
}

/**
 * Split prose into text + links. Markdown links win over bare URLs.
 * `href` values are whitespace-encoded.
 */
export function tokenizeBriefText(input: string): BriefLinkPiece[] {
  const pieces: BriefLinkPiece[] = [];
  const re = new RegExp(`${mdLinkRe().source}|${bareUrlRe().source}`, "g");
  let i = 0;

  for (const match of input.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > i) {
      pieces.push({ type: "text", value: input.slice(i, start) });
    }
    if (match[1] && match[2]) {
      const href = hrefFromMarkdownUrl(match[2]);
      pieces.push({
        type: "link",
        label: friendlyLinkLabel(href, match[1]),
        href,
      });
    } else if (match[3]) {
      const raw = match[3].replace(/[.,;:!?]+$/, "");
      const href = hrefFromMarkdownUrl(raw);
      pieces.push({
        type: "link",
        label: friendlyLinkLabel(href),
        href,
      });
    }
    i = start + match[0].length;
  }
  if (i < input.length) {
    pieces.push({ type: "text", value: input.slice(i) });
  }
  return pieces.length ? pieces : [{ type: "text", value: input }];
}
