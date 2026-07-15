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
  /**
   * Matched edits that were NOT applied because the "after" would wrap onto an
   * extra line (which would grow the page count). Values are normalized
   * `before` text. Prevents a tailored resume from spilling onto a new page.
   */
  overLength: string[];
}

// ---------------------------------------------------------------------------
// Line-budget estimation. We keep the resume's page count by never letting an
// edited paragraph occupy MORE lines than it already does (and we never add or
// remove paragraphs). To decide that, we estimate how many text lines a
// paragraph occupies from the document's real page width, margins, default
// font size, and the paragraph's own indent — deliberately biased slightly
// conservative so we don't under-count lines and accidentally grow a page.
// ---------------------------------------------------------------------------

function usableWidthTwips(doc: XmlDocument): number {
  const sects = doc.getElementsByTagName("w:sectPr");
  const sect = sects.length ? sects[sects.length - 1] : null;
  let pageW = 12240; // US Letter default
  let left = 1440;
  let right = 1440;
  if (sect) {
    const pgSz = sect.getElementsByTagName("w:pgSz")[0];
    if (pgSz) pageW = parseInt(pgSz.getAttribute("w:w") ?? "", 10) || pageW;
    const pgMar = sect.getElementsByTagName("w:pgMar")[0];
    if (pgMar) {
      left = parseInt(pgMar.getAttribute("w:left") ?? "", 10) || left;
      right = parseInt(pgMar.getAttribute("w:right") ?? "", 10) || right;
    }
  }
  return Math.max(2000, pageW - left - right);
}

function defaultFontHalfPoints(zip: PizZip): number {
  const styles = zip.file("word/styles.xml")?.asText();
  if (styles) {
    const def = styles.match(
      /<w:docDefaults>[\s\S]*?<w:rPrDefault>[\s\S]*?<w:sz\s+w:val="(\d+)"/
    );
    if (def) return parseInt(def[1], 10) || 22;
    const any = styles.match(/<w:sz\s+w:val="(\d+)"/);
    if (any) return parseInt(any[1], 10) || 22;
  }
  return 22; // 11pt
}

function paragraphIndentTwips(p: XmlElement): number {
  const pPr = p.getElementsByTagName("w:pPr")[0];
  if (!pPr) return 0;
  const ind = pPr.getElementsByTagName("w:ind")[0];
  if (!ind) return 0;
  const left = ind.getAttribute("w:left") ?? ind.getAttribute("w:start");
  return left ? Math.max(0, parseInt(left, 10) || 0) : 0;
}

function estimateLines(textLen: number, charsPerLine: number): number {
  if (textLen <= 0) return 1;
  return Math.max(1, Math.ceil(textLen / charsPerLine));
}

/**
 * Apply Before/After paragraph edits in place, preserving all formatting AND
 * the page count. Only <w:t> text within matched paragraphs changes; every
 * other zip part is left byte-identical. An edit is applied only if the
 * replacement text fits within the SAME number of lines the paragraph already
 * uses — so keyword swaps that consume a line's trailing slack are allowed, but
 * anything that would wrap onto a new line (and risk a new page) is skipped and
 * reported in `overLength`.
 */
export function applyParagraphEdits(
  buffer: Buffer,
  edits: ParagraphEdit[]
): ApplyEditsResult {
  const { zip, doc } = loadDocumentXml(buffer);
  const paragraphs = doc.getElementsByTagName("w:p");

  const usable = usableWidthTwips(doc);
  const fontHalfPt = defaultFontHalfPoints(zip);
  // Average glyph advance for a proportional body font ≈ 0.52 × point size,
  // nudged up ~5% for safety. In twips: (fontHalfPt/2 pt) × 0.52 × 1.05 × 20.
  const avgCharTwips = Math.max(60, fontHalfPt * 5.46);

  const remaining = new Map<string, string>();
  for (const e of edits) {
    const key = normalize(e.before);
    if (key) remaining.set(key, e.after);
  }

  let applied = 0;
  const unpreserved: string[] = [];
  const overLength: string[] = [];

  for (let i = 0; i < paragraphs.length && remaining.size > 0; i++) {
    const p = paragraphs[i];
    const key = normalize(paragraphText(p));
    const after = remaining.get(key);
    if (after === undefined) continue;

    const runs = p.getElementsByTagName("w:t");
    if (runs.length === 0) continue;

    // Line-budget check: subtract this paragraph's indent, keep a small safety
    // margin for list indents defined via numbering (not direct w:ind).
    const paraWidth = Math.max(1500, usable - paragraphIndentTwips(p) - 180);
    const cpl = Math.max(20, Math.floor(paraWidth / avgCharTwips));
    const beforeLines = estimateLines(key.length, cpl);
    const afterLines = estimateLines(normalize(after).length, cpl);
    if (afterLines > beforeLines) {
      overLength.push(key);
      remaining.delete(key);
      continue;
    }

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

  return {
    output,
    applied,
    unmatched: [...remaining.keys()],
    unpreserved,
    overLength,
  };
}
