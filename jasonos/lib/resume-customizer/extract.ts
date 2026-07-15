// Job-description ingestion. Accepts a pasted string, a Word (.docx) file, or a
// PDF and returns plain text for the analysis step. PDF uses unpdf (serverless-
// friendly pdf.js) so there's no native/fs dependency on Vercel.

import "server-only";
import mammoth from "mammoth";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).trim();
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

/** Route a job-description File to the right extractor. */
export async function extractJobDescriptionFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  const type = file.type;

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }
  if (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return extractDocxText(buffer);
  }
  if (type.startsWith("text/") || name.endsWith(".txt")) {
    return buffer.toString("utf8").trim();
  }
  throw new Error(
    "Unsupported job-description file. Upload a PDF, Word (.docx), or paste the text."
  );
}
