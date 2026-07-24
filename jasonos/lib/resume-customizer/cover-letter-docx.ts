// Build a downloadable Word (.docx) cover letter from structured content.
// Uses PizZip (already in the stack) to assemble a minimal OOXML package —
// same letter layout as the on-screen / print preview, but editable in Word.

import "server-only";
import PizZip from "pizzip";

export interface CoverLetterDocxInput {
  company: string | null;
  roleTitle: string | null;
  salutation: string | null;
  opening: string | null;
  background: string | null;
  highlights: string[];
  closing: string | null;
}

const LETTERHEAD = {
  name: "Jason Kuperman",
  location: "Greater New York City Area",
  phone: "862.400.1149",
  email: "jason.kuperman@outlook.com",
  linkedin: "www.linkedin.com/in/kuperman",
};

function escXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function todayLong(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function reLine(input: CoverLetterDocxInput): string {
  return [input.roleTitle, input.company].filter(Boolean).join(" — ");
}

function para(
  text: string,
  opts: {
    bold?: boolean;
    center?: boolean;
    size?: number; // half-points; 24 = 12pt
    spaceAfter?: number; // twips
    spaceBefore?: number;
  } = {}
): string {
  const size = opts.size ?? 22; // 11pt — keeps the letter on one page
  const after = opts.spaceAfter ?? 160;
  const before = opts.spaceBefore ?? 0;
  const align = opts.center ? `<w:jc w:val="center"/>` : "";
  const bold = opts.bold ? "<w:b/><w:bCs/>" : "";
  return `<w:p>
  <w:pPr>
    <w:spacing w:before="${before}" w:after="${after}" w:line="276" w:lineRule="auto"/>
    ${align}
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/>
      <w:sz w:val="${size}"/><w:szCs w:val="${size}"/>
      ${bold}
    </w:rPr>
    <w:t xml:space="preserve">${escXml(text)}</w:t>
  </w:r>
</w:p>`;
}

function bullet(text: string): string {
  return `<w:p>
  <w:pPr>
    <w:pStyle w:val="ListParagraph"/>
    <w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>
    <w:spacing w:before="0" w:after="40" w:line="276" w:lineRule="auto"/>
    <w:ind w:left="360"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
    </w:rPr>
    <w:t xml:space="preserve">${escXml(text)}</w:t>
  </w:r>
</w:p>`;
}

function emptyPara(after = 80): string {
  return `<w:p><w:pPr><w:spacing w:after="${after}"/></w:pPr></w:p>`;
}

function buildDocumentXml(input: CoverLetterDocxInput): string {
  const parts: string[] = [];

  parts.push(
    para(LETTERHEAD.name, {
      bold: true,
      center: true,
      size: 36,
      spaceAfter: 40,
    })
  );
  parts.push(
    para(
      `${LETTERHEAD.location} | ${LETTERHEAD.phone} | ${LETTERHEAD.email} | ${LETTERHEAD.linkedin}`,
      { center: true, size: 18, spaceAfter: 200 }
    )
  );

  // Hairline under the letterhead (bottom border on an empty para).
  parts.push(`<w:p>
  <w:pPr>
    <w:pBdr>
      <w:bottom w:val="single" w:sz="12" w:space="8" w:color="111111"/>
    </w:pBdr>
    <w:spacing w:after="200"/>
  </w:pPr>
</w:p>`);

  parts.push(para(todayLong(), { size: 20, spaceAfter: 80 }));

  const re = reLine(input);
  if (re) parts.push(para(`Re: ${re}`, { bold: true, spaceAfter: 160 }));

  parts.push(
    para(input.salutation?.trim() || "Dear Hiring Committee:", {
      spaceAfter: 160,
    })
  );

  if (input.opening?.trim()) {
    parts.push(para(input.opening.trim()));
  }
  if (input.background?.trim()) {
    parts.push(para(input.background.trim()));
  }

  if (input.highlights.length) {
    parts.push(
      para(
        "Select highlights of my career contributions and achievements thus far include:",
        { spaceAfter: 60 }
      )
    );
    for (const h of input.highlights) {
      if (h.trim()) parts.push(bullet(h.trim()));
    }
    parts.push(emptyPara(120));
  }

  if (input.closing?.trim()) {
    parts.push(para(input.closing.trim()));
  }

  parts.push(para("Sincerely,", { spaceBefore: 120, spaceAfter: 40 }));
  parts.push(para(LETTERHEAD.name, { spaceAfter: 0 }));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${parts.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1008" w:right="1008" w:bottom="1008" w:left="1008"
               w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
    Target="styles.xml"/>
  <Relationship Id="rId2"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering"
    Target="numbering.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="360" w:hanging="180"/></w:pPr>
      <w:rPr>
        <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>
      </w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>`;

/** Build a .docx buffer for the cover letter. */
export function buildCoverLetterDocx(input: CoverLetterDocxInput): Buffer {
  const zip = new PizZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("word/document.xml", buildDocumentXml(input));
  zip.file("word/_rels/document.xml.rels", DOC_RELS);
  zip.file("word/styles.xml", STYLES);
  zip.file("word/numbering.xml", NUMBERING);
  return zip.generate({ type: "nodebuffer" }) as Buffer;
}

export function coverLetterFilename(input: CoverLetterDocxInput): string {
  const company = (input.company ?? "Company").replace(/[\\/:*?"<>|]+/g, "").trim();
  const role = (input.roleTitle ?? "").replace(/[\\/:*?"<>|]+/g, "").trim();
  const base = role ? `${company} - ${role} Cover Letter` : `${company} - Cover Letter`;
  return `${base}.docx`;
}
