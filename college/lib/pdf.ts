/** Extract readable text from PDF bytes (webinar decks, handouts). */

/** Browser-side read limit — we only send extracted text to the server. */
export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_PAGES = 80;
export const MAX_PDF_TEXT_CHARS = 40000;
export const MIN_EMBEDDED_TEXT_CHARS = 20;

export function isPdfFile(file: { name?: string; type?: string }): boolean {
  const type = (file.type ?? "").toLowerCase();
  const name = (file.name ?? "").toLowerCase();
  return type === "application/pdf" || type === "application/x-pdf" || name.endsWith(".pdf");
}

export function cleanPdfText(raw: string): string {
  return raw.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Embedded text layer only (no OCR). Used by server multipart and unit tests. */
export async function extractPdfText(bytes: Uint8Array): Promise<{
  text: string;
  pageCount: number;
}> {
  if (!bytes.byteLength) {
    throw new Error("That PDF was empty.");
  }
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF is too large (max 25 MB). Try a smaller export or fewer slides.");
  }

  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const pageCount = pdf.numPages ?? 0;
  if (pageCount > MAX_PDF_PAGES) {
    throw new Error(`PDF has too many pages (max ${MAX_PDF_PAGES}). Split the deck and try again.`);
  }

  const extracted = await extractText(pdf, { mergePages: true });
  const text = cleanPdfText(typeof extracted.text === "string" ? extracted.text : "");

  if (text.length < MIN_EMBEDDED_TEXT_CHARS) {
    throw new Error(
      "No readable text layer in that PDF. In the browser, Choose PDF will OCR image-only slides.",
    );
  }

  return {
    text: text.slice(0, MAX_PDF_TEXT_CHARS),
    pageCount,
  };
}

/** Turn a non-JSON HTTP body into a usable error (Vercel 413, HTML errors, etc.). */
export function messageFromFailedResponse(raw: string, status: number): string {
  const clipped = raw.replace(/\s+/g, " ").trim().slice(0, 160);
  if (status === 413 || /request entity too large/i.test(clipped)) {
    return "That file was too large to upload as-is. PDFs are read in your browser now — try Choose PDF again.";
  }
  if (clipped) return clipped;
  return `Request failed (${status || "unknown"})`;
}
