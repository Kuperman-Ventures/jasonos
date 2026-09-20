/** Browser OCR for image-only PDF decks (webinar slides without a text layer). */

import {
  cleanPdfText,
  MAX_PDF_PAGES,
  MAX_PDF_TEXT_CHARS,
  MIN_EMBEDDED_TEXT_CHARS,
} from "@/lib/pdf";

export const MAX_OCR_PAGES = 40;

export type PdfReadProgress = {
  phase: "reading" | "ocr-init" | "ocr-page" | "done";
  page?: number;
  total?: number;
  detail: string;
};

export type PdfReadResult = {
  text: string;
  pageCount: number;
  method: "embedded" | "ocr";
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** Prefer the PDF text layer; fall back to OCR in the browser for image-only decks. */
export async function readPdfForIngest(
  bytes: Uint8Array,
  onProgress?: (progress: PdfReadProgress) => void,
): Promise<PdfReadResult> {
  onProgress?.({ phase: "reading", detail: "Reading PDF…" });

  // PDF.js transfers/detaches the ArrayBuffer it receives. Keep a private copy so OCR
  // can still render pages after the text-layer pass.
  const owned = bytes.slice();

  const { extractText, getDocumentProxy, renderPageAsImage } = await import("unpdf");
  const pdf = await getDocumentProxy(owned);
  const pageCount = pdf.numPages ?? 0;
  if (pageCount > MAX_PDF_PAGES) {
    throw new Error(`PDF has too many pages (max ${MAX_PDF_PAGES}). Split the deck and try again.`);
  }

  const extracted = await extractText(pdf, { mergePages: true });
  const embedded = cleanPdfText(typeof extracted.text === "string" ? extracted.text : "");
  if (embedded.length >= MIN_EMBEDDED_TEXT_CHARS) {
    onProgress?.({ phase: "done", detail: "Found selectable text" });
    return {
      text: embedded.slice(0, MAX_PDF_TEXT_CHARS),
      pageCount,
      method: "embedded",
    };
  }

  if (!isBrowser()) {
    throw new Error(
      "No readable text in that PDF. OCR runs in the browser — open Ingest in the app and Choose PDF there.",
    );
  }

  const ocrPages = Math.min(pageCount, MAX_OCR_PAGES);
  onProgress?.({
    phase: "ocr-init",
    total: ocrPages,
    detail: "No text layer — starting OCR (first load may take a minute)…",
  });

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    const parts: string[] = [];
    for (let page = 1; page <= ocrPages; page += 1) {
      onProgress?.({
        phase: "ocr-page",
        page,
        total: ocrPages,
        detail: `OCR page ${page} of ${ocrPages}…`,
      });
      // Render from the open document proxy — do not re-pass the (possibly detached) bytes.
      const dataUrl = (await renderPageAsImage(pdf, page, {
        scale: 2,
        toDataURL: true,
      })) as string;
      const result = await worker.recognize(dataUrl);
      const pageText = cleanPdfText(result.data.text ?? "");
      if (pageText) parts.push(pageText);
    }

    const text = cleanPdfText(parts.join("\n\n")).slice(0, MAX_PDF_TEXT_CHARS);
    if (text.length < MIN_EMBEDDED_TEXT_CHARS) {
      throw new Error(
        "OCR could not read enough text from that PDF. Try a clearer export, or paste the slide notes.",
      );
    }

    onProgress?.({
      phase: "done",
      total: ocrPages,
      detail:
        pageCount > ocrPages
          ? `OCR finished on first ${ocrPages} of ${pageCount} pages`
          : `OCR finished (${ocrPages} pages)`,
    });

    return { text, pageCount, method: "ocr" };
  } finally {
    await worker.terminate();
  }
}
