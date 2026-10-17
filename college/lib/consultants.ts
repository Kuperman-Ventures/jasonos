import type { ConsultantSupport, Firm } from "@/lib/types";

export const SUPPORT_CHOICES: { id: ConsultantSupport; label: string }[] = [
  { id: "applications", label: "College Application Support" },
  { id: "testing", label: "Testing Support" },
  { id: "both", label: "College Application Support and Testing Support" },
];

export function isConsultantSupport(value: string): value is ConsultantSupport {
  return value === "applications" || value === "testing" || value === "both";
}

export function supportLabel(support: ConsultantSupport | ""): string {
  return SUPPORT_CHOICES.find((choice) => choice.id === support)?.label ?? "Support not set";
}

export function consultantId(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "consultant";
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

export function normalizeConsultant(raw: unknown): Firm | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!name || !id) return null;
  const pricing = typeof row.pricing === "string" ? row.pricing.trim() : "";
  const price = typeof row.price === "string" ? row.price.trim() : pricing;
  const support = typeof row.support === "string" && isConsultantSupport(row.support) ? row.support : "";
  return {
    id,
    name,
    url: typeof row.url === "string" ? row.url.trim() : "",
    location: typeof row.location === "string" ? row.location.trim() : "",
    people: typeof row.people === "string" ? row.people.trim() : "",
    pricing,
    price,
    model: typeof row.model === "string" ? row.model.trim() : "",
    support,
  };
}

/** Null means the seed list. An array, including an empty one, is the saved list. */
export function consultantFirmsFromState(raw: unknown, seed: Firm[]): Firm[] {
  if (!Array.isArray(raw)) return seed.map((firm) => normalizeConsultant(firm)).filter((firm): firm is Firm => firm !== null);
  const firms: Firm[] = [];
  for (const row of raw) {
    const firm = normalizeConsultant(row);
    if (firm && !firms.some((existing) => existing.id === firm.id)) firms.push(firm);
  }
  return firms;
}

export function createConsultant(
  input: { name: string; url?: string; location?: string; price?: string; support?: string },
  taken: Iterable<string>,
): Firm | null {
  const name = input.name.trim();
  if (!name) return null;
  const support = input.support && isConsultantSupport(input.support) ? input.support : "";
  return {
    id: consultantId(name, taken),
    name,
    url: input.url?.trim() ?? "",
    location: input.location?.trim() ?? "",
    people: "",
    pricing: "",
    price: input.price?.trim() ?? "",
    model: "",
    support,
  };
}
