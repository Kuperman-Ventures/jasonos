/** Plain-text extraction from RTF and Mac RTFD (TextEdit packages). */

const RTF_OPEN = /^\{\\rtf/i;
const HEX_ESCAPE = /\\'[0-9a-fA-F]{2}/;

export function isRtfName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".rtf") || lower.endsWith(".rtfd") || lower === "txt.rtf";
}

export function isRtfFile(file: { name?: string; type?: string }): boolean {
  const name = (file.name ?? "").toLowerCase();
  const type = (file.type ?? "").toLowerCase();
  if (isRtfName(name)) return true;
  return (
    type === "application/rtf" ||
    type === "text/rtf" ||
    type === "application/x-rtf" ||
    type === "application/rtfd"
  );
}

export function looksLikeRtf(raw: string): boolean {
  return RTF_OPEN.test(raw.trimStart());
}

function decodeHexByte(hh: string): string {
  const code = Number.parseInt(hh, 16);
  if (Number.isNaN(code)) return "";
  if (code < 32 && code !== 9 && code !== 10 && code !== 13) return "";
  return String.fromCharCode(code);
}

function decodeUnicode(n: number): string {
  const code = n < 0 ? n + 65536 : n;
  if (code === 0) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function skipDestinationGroup(input: string, start: number): number {
  let depth = 0;
  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "\\") {
      i += 1;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return input.length - 1;
}

/** Strip RTF control words. Leaves readable body text. */
export function rtfToPlainText(raw: string): string {
  const input = raw.replace(/^\uFEFF/, "");
  if (!looksLikeRtf(input)) return input.trim();

  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "{") {
      if (input.startsWith("{\\*", i) || input.startsWith("{\\*\\", i)) {
        i = skipDestinationGroup(input, i);
      }
      continue;
    }
    if (ch === "}") continue;
    if (ch === "\r" || ch === "\n") continue;
    if (ch !== "\\") {
      out += ch;
      continue;
    }

    const next = input[i + 1];
    if (next === "\\" || next === "{" || next === "}") {
      out += next;
      i += 1;
      continue;
    }
    if (next === "'") {
      const hh = input.slice(i + 2, i + 4);
      if (HEX_ESCAPE.test(`\\'${hh}`)) {
        out += decodeHexByte(hh);
        i += 3;
      }
      continue;
    }
    if (next === "\r" || next === "\n") {
      i += 1;
      continue;
    }

    const rest = input.slice(i);
    const unicode = rest.match(/^\\u(-?\d+)(\??)/);
    if (unicode) {
      out += decodeUnicode(Number(unicode[1]));
      i += unicode[0].length - 1;
      continue;
    }

    const word = rest.match(/^\\([a-zA-Z]+)(-?\d*)\s?/);
    if (!word) {
      i += 1;
      continue;
    }
    const name = word[1]!.toLowerCase();
    if (name === "par" || name === "line" || name === "row") out += "\n";
    else if (name === "tab" || name === "cell") out += "\t";
    else if (name === "emdash" || name === "endash") out += "-";
    else if (name === "lquote" || name === "rquote") out += "'";
    else if (name === "ldblquote" || name === "rdblquote") out += '"';
    else if (name === "bullet") out += "•";
    i += word[0].length - 1;
  }

  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function extractRtfText(bytes: Uint8Array): Promise<string> {
  const raw = new TextDecoder("latin1").decode(bytes);
  const text = rtfToPlainText(raw);
  if (!text) throw new Error("No readable text in that rich-text file.");
  return text;
}
