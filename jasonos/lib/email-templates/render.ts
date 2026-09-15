import type { EmailTemplate, TemplateField } from "@/lib/email-templates/templates";

/** First token of a full name - greets "Alex Rivera" as "Alex". */
export function firstNameFromFullName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

/** Strip em/en dashes from outbound email text (subject + body). */
export function stripEmDashes(text: string): string {
  return text
    .replace(/\u2014/g, "-") // —
    .replace(/\u2013/g, "-"); // –
}

export function restoreBrandCaps(text: string): string {
  return text
    .replace(/\bchiat\s*\/\s*day\b/gi, "Chiat/Day")
    .replace(/\boutfront\b/gi, "OUTFRONT")
    .replace(/\btbwa\b/gi, "TBWA")
    .replace(/\bomnicom\b/gi, "Omnicom");
}

function folded(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when `output` still contains a 5+ word run from the form notes. */
export function copiesNoteWording(
  output: string,
  note: string,
  minWords = 5
): boolean {
  const words = folded(note)
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (words.length < minWords) return false;
  const hay = folded(output);
  for (let i = 0; i <= words.length - minWords; i++) {
    if (hay.includes(words.slice(i, i + minWords).join(" "))) return true;
  }
  return false;
}

const KEEP_FIRST_WORD = /^(OUTFRONT|TBWA|Omnicom|Chiat|Apple|Videri)$/i;

/** Mid-sentence fragment. "We worked together at X" → "we worked together at X". */
export function asClause(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return t;
  const stripped = t.replace(/[.!?]+$/g, "").trim();
  if (!stripped) return t;
  const firstWord = stripped.split(/\s+/)[0] ?? "";
  if (KEEP_FIRST_WORD.test(firstWord)) return stripped;
  if (/^I\b/.test(stripped)) return stripped;
  return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}

/** Standalone sentence. Notes become one punctuated line. */
export function asEmailSentence(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return t;
  let s = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

export function fitSlotValue(
  raw: string,
  slot: TemplateField["slot"] | undefined
): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return t;
  if (slot === "sentence") return restoreBrandCaps(asEmailSentence(t));
  if (slot === "clause") return restoreBrandCaps(asClause(t));
  return restoreBrandCaps(t);
}

export function fitTemplateValues(
  tmpl: EmailTemplate,
  values: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = { ...values };
  for (const field of tmpl.fields) {
    if (field.fromContactFirstName) continue;
    const current = values[field.key] ?? "";
    out[field.key] = fitSlotValue(current, field.slot);
  }
  return out;
}

export function renderTemplate(
  template: string,
  values: Record<string, string>
): string {
  const rendered = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = values[key]?.trim() ?? "";
    return v;
  });
  return stripEmDashes(rendered);
}

export function missingRequiredFields(
  tmpl: EmailTemplate,
  values: Record<string, string>
): string[] {
  return tmpl.fields
    .filter((f) => f.required && !(values[f.key]?.trim()))
    .map((f) => f.label);
}

export function buildMailtoUrl(opts: {
  to: string;
  subject: string;
  body: string;
}): string {
  const to = opts.to.trim();
  const subject = encodeURIComponent(opts.subject);
  const body = encodeURIComponent(opts.body);
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
