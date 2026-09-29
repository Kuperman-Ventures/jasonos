/** Extra engineering programs listed on a school’s Snapshot Programs section. */

export type AdditionalProgram = {
  id: string;
  name: string;
  /** Optional official page for the program. */
  sourceUrl: string;
};

export function normalizeAdditionalPrograms(raw: unknown): AdditionalProgram[] {
  if (!Array.isArray(raw)) return [];
  const out: AdditionalProgram[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!id || !name) continue;
    const sourceUrl = typeof item.sourceUrl === "string" ? item.sourceUrl.trim() : "";
    out.push({ id, name, sourceUrl });
  }
  return out;
}
