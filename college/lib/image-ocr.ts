/** Browser OCR for a single image (PNG/JPG/WebP/GIF). */

import { cleanPdfText, MAX_PDF_TEXT_CHARS, MIN_EMBEDDED_TEXT_CHARS } from "@/lib/pdf";

export type ImageOcrProgress = {
  detail: string;
};

export async function readImageForIngest(
  file: File,
  onProgress?: (progress: ImageOcrProgress) => void,
): Promise<{ text: string; method: "ocr" }> {
  onProgress?.({ detail: "Starting image OCR…" });
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    onProgress?.({ detail: "Reading text from image…" });
    const result = await worker.recognize(file);
    const text = cleanPdfText(result.data.text ?? "").slice(0, MAX_PDF_TEXT_CHARS);
    if (text.length < MIN_EMBEDDED_TEXT_CHARS) {
      throw new Error(
        "Could not read enough text from that image. Try a clearer scan, or save it as-is to Notes.",
      );
    }
    onProgress?.({ detail: "OCR finished" });
    return { text, method: "ocr" };
  } finally {
    await worker.terminate();
  }
}
