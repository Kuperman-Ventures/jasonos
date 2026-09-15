/**
 * Resolve a contact's firm for research and matching.
 * Prefer the linked company name; otherwise the `firm:<slug>` tag.
 */
export function resolveContactFirm(
  companyName: string | null | undefined,
  tags: string[] | null | undefined
): string | null {
  const fromCompany = companyName?.trim() || null;
  if (fromCompany) return fromCompany;
  const tag = (tags ?? []).find((t) => t.startsWith("firm:"));
  if (!tag) return null;
  const fromTag = tag.slice("firm:".length).replace(/-/g, " ").trim();
  return fromTag || null;
}
