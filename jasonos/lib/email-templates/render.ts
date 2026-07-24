import type { EmailTemplate } from "@/lib/email-templates/templates";

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
