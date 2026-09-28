import { HANDOFF_OPENING } from "./types";

const OPENING = new RegExp(HANDOFF_OPENING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

export function meetingBrief(input: {
  name: string | null;
  tracyBody: string;
  resumeText: string | null;
  whyTheyReplied: string | null;
}): string | null {
  const fromTracy = tracyCommentary(input.tracyBody);
  const resume = resumeHighlights(input.resumeText);
  const why = cleanBlock(input.whyTheyReplied);
  const parts: string[] = [];
  if (input.name) parts.push(input.name);
  if (fromTracy) parts.push(`From Tracy\n${fromTracy}`);
  if (why && !fromTracy.toLowerCase().includes(why.toLowerCase().slice(0, 40))) {
    parts.push(`What they said\n${why}`);
  }
  if (resume) parts.push(`Resume\n${resume}`);
  const text = parts.join("\n\n").trim();
  return text.length >= 40 ? text : null;
}

function plainMail(body: string): string {
  return body
    .replace(/\r/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function tracyCommentary(body: string): string {
  const text = plainMail(body);
  const cut = text.split(/\n-{2,}\s*original message\s*-{2,}|\nfrom:\s/i)[0] ?? text;
  const lines = cut
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !OPENING.test(line))
    .filter((line) => !/^attached please find the resume\b/i.test(line))
    .filter((line) => !/linkedin\.com\/in\//i.test(line))
    .filter((line) => !/@/.test(line))
    .filter((line) => !/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(line));
  return clip(lines.join("\n"), 1400);
}

function resumeHighlights(resumeText: string | null): string {
  const lines = (resumeText ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/^[\s•·*\-–]+/, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 18 && line.length <= 180)
    .filter((line) => !/@/.test(line))
    .filter((line) => !/linkedin\.com/i.test(line))
    .filter((line) => !/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(line));
  const picked: string[] = [];
  for (const line of lines) {
    const interesting = /\b(19|20)\d{2}\b/.test(line) || /[.!?]$/.test(line) || line.length >= 40;
    if (!interesting && picked.length >= 2) continue;
    if (picked.some((have) => have.toLowerCase() === line.toLowerCase())) continue;
    picked.push(line);
    if (picked.length >= 8) break;
  }
  return picked.map((line) => `- ${line}`).join("\n");
}

function cleanBlock(value: string | null): string {
  return clip((value ?? "").replace(/\s+/g, " ").trim(), 500);
}

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}
