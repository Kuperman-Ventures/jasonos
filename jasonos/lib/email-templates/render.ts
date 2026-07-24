import type { EmailTemplate } from "@/lib/email-templates/templates";

/** First token of a full name — greets "Alex Rivera" as "Alex". */
export function firstNameFromFullName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function renderTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = values[key]?.trim() ?? "";
    return v;
  });
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
