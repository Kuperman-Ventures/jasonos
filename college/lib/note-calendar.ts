/** Resolve a calendar date for a note by rescanning linked page / file text. */

import { parseEventDateFromText } from "@/lib/event-date";
import { fetchLinkPreview, summarizeLinkPreview } from "@/lib/link-preview";
import { extractPdfText } from "@/lib/pdf";

export type NoteCalendarScanInput = {
  title: string;
  body?: string | null;
  previewSummary?: string | null;
  url?: string | null;
  assetUrl?: string | null;
  mimeType?: string | null;
};

export type NoteCalendarScanResult = {
  date: string | null;
  scannedText: string;
  source: "local" | "url" | "asset" | "mixed";
};

async function textFromAsset(assetUrl: string): Promise<string> {
  try {
    const response = await fetch(assetUrl, {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "KyleCollegePortal/0.1 (+calendar-scan)" },
      redirect: "follow",
    });
    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") ?? "";
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (
      contentType.includes("pdf") ||
      assetUrl.toLowerCase().includes(".pdf") ||
      (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
    ) {
      const { text } = await extractPdfText(bytes);
      return text;
    }
    if (contentType.includes("html") || contentType.includes("text")) {
      return new TextDecoder().decode(bytes).slice(0, 40000);
    }
  } catch {
    /* keep going with other sources */
  }
  return "";
}

/** Best-effort public Drive download URL for a /file/d/<id>/… link. */
function driveDownloadUrl(pageUrl: string): string | null {
  try {
    const match = pageUrl.match(/\/file\/d\/([^/]+)/i);
    if (!match?.[1]) return null;
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(match[1])}`;
  } catch {
    return null;
  }
}

/** Re-fetch the destination (and any stored asset) so day-level dates beat filename guesses. */
export async function scanNoteForEventDate(
  input: NoteCalendarScanInput,
): Promise<NoteCalendarScanResult> {
  const localParts = [input.title, input.previewSummary, input.body, input.url];
  let scanned = localParts.filter(Boolean).join("\n");
  let source: NoteCalendarScanResult["source"] = "local";

  if (input.url?.trim()) {
    try {
      const preview = await fetchLinkPreview(input.url.trim());
      const summary = summarizeLinkPreview(preview);
      scanned = [scanned, preview.title, summary, preview.text].filter(Boolean).join("\n");
      source = source === "local" ? "url" : "mixed";
    } catch {
      /* local text still used */
    }

    const drive = driveDownloadUrl(input.url.trim());
    if (drive) {
      const driveText = await textFromAsset(drive);
      if (driveText) {
        scanned = [scanned, driveText].filter(Boolean).join("\n");
        source = source === "local" ? "asset" : "mixed";
      }
    }
  }

  if (input.assetUrl?.trim()) {
    const assetText = await textFromAsset(input.assetUrl.trim());
    if (assetText) {
      scanned = [scanned, assetText].filter(Boolean).join("\n");
      source = source === "local" ? "asset" : "mixed";
    }
  }

  return {
    date: parseEventDateFromText(scanned),
    scannedText: scanned.slice(0, 4000),
    source,
  };
}
