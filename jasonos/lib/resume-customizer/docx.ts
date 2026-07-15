// Resume Customizer — .docx toolkit.
//
// Format-preservation strategy: a .docx is a ZIP of OOXML parts. All visual
// design (fonts, colors, spacing, margins, headers/footers, tables, theme,
// section structure, branding) lives in parts OTHER than the text nodes —
// styles.xml, theme/theme1.xml, numbering.xml, settings.xml, headerN.xml, the
// paragraph/run *properties* (w:pPr / w:rPr), etc.
//
// So we NEVER regenerate the document. We open the existing zip, edit only the
// <w:t> text inside word/document.xml (leaving every other part byte-identical),
// and re-zip. That guarantees the design stays exactly as authored — only the
// words change.
//
// Known limitation (reported back to the caller): when a paragraph's text is
// split across multiple runs with different formatting (e.g. one bold word
// mid-line), we place the new text into the first run and blank the others, so
// intra-paragraph run styling on the *edited* line collapses to the first
// run's style. Paragraph-level formatting and everything else is preserved.
// These cases are surfaced in `unpreserved` so the UI can flag them.

import "server-only";
import PizZip from "pizzip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Document as XmlDocument, Element as XmlElement } from "@xmldom/xmldom";
import mammoth from "mammoth";

const DOCUMENT_PART = "word/document.xml";

/** Plain-text extraction for feeding the analysis prompt. */
export async function extractResumeText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/** HTML extraction (keeps headings/lists/bold) for a richer preview. */
export async function extractResumeHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

function loadDocumentXml(buffer: Buffer): { zip: PizZip; doc: XmlDocument } {
  const zip = new PizZip(buffer);
  const xml = zip.file(DOCUMENT_PART)?.asText();
  if (!xml) {
    throw new Error("Not a valid .docx — word/document.xml is missing.");
  }
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return { zip, doc };
}

function paragraphText(p: XmlElement): string {
  const runs = p.getElementsByTagName("w:t");
  let text = "";
  for (let i = 0; i < runs.length; i++) text += runs[i].textContent ?? "";
  return text;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Ordered, non-empty paragraphs of the resume. The `text` is what the analysis
 * step keys its Before/After edits to (match on exact paragraph text).
 */
export function extractParagraphs(
  buffer: Buffer
): { index: number; text: string }[] {
  const { doc } = loadDocumentXml(buffer);
  const paragraphs = doc.getElementsByTagName("w:p");
  const out: { index: number; text: string }[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const text = paragraphText(paragraphs[i]).trim();
    if (text) out.push({ index: i, text });
  }
  return out;
}

export interface ParagraphEdit {
  /** Exact paragraph text to find (whitespace-normalized match). */
  before: string;
  /** Replacement text (paste-ready). */
  after: string;
}

export interface ApplyEditsResult {
  /** The rewritten .docx, format preserved. */
  output: Buffer;
  /** How many edits were applied. */
  applied: number;
  /** `before` texts that couldn't be located to edit. */
  unmatched: string[];
  /** Edited paragraphs whose intra-run styling was collapsed (see note above). */
  unpreserved: string[];
}

/**
 * Apply Before/After paragraph edits in place, preserving all formatting.
 * Only <w:t> text within matched paragraphs changes; every other zip part is
 * left byte-identical.
 */
export function applyParagraphEdits(
  buffer: Buffer,
  edits: ParagraphEdit[]
): ApplyEditsResult {
  const { zip, doc } = loadDocumentXml(buffer);
  const paragraphs = doc.getElementsByTagName("w:p");

  const remaining = new Map<string, string>();
  for (const e of edits) {
    const key = normalize(e.before);
    if (key) remaining.set(key, e.after);
  }

  let applied = 0;
  const unpreserved: string[] = [];

  for (let i = 0; i < paragraphs.length && remaining.size > 0; i++) {
    const p = paragraphs[i];
    const key = normalize(paragraphText(p));
    const after = remaining.get(key);
    if (after === undefined) continue;

    const runs = p.getElementsByTagName("w:t");
    if (runs.length === 0) continue;

    // Multiple text runs → we'll collapse intra-run styling onto run 0.
    let nonEmptyRuns = 0;
    for (let j = 0; j < runs.length; j++) {
      if ((runs[j].textContent ?? "").length > 0) nonEmptyRuns++;
    }
    if (nonEmptyRuns > 1) unpreserved.push(key);

    runs[0].setAttribute("xml:space", "preserve");
    runs[0].textContent = after;
    for (let j = 1; j < runs.length; j++) runs[j].textContent = "";

    remaining.delete(key);
    applied++;
  }

  const serialized = new XMLSerializer().serializeToString(doc);
  zip.file(DOCUMENT_PART, serialized);
  const output = zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;

  return { output, applied, unmatched: [...remaining.keys()], unpreserved };
}
