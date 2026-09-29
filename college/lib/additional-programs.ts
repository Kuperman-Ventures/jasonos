/** Extra engineering programs listed on a school’s Snapshot Programs section. */

export type ProgramSource = "catalog" | "scorecard" | "manual";

export type ProgramOption = {
  id: string;
  name: string;
  category: string;
  sourceUrl: string;
  notes: string;
  source: "catalog" | "scorecard";
};

export type AdditionalProgram = {
  id: string;
  name: string;
  /** Optional official page for the program. */
  sourceUrl: string;
  category: string;
  source: ProgramSource;
};

export function normalizeProgramOptions(raw: unknown): ProgramOption[] {
  if (!Array.isArray(raw)) return [];
  const out: ProgramOption[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!id || !name) continue;
    const category =
      typeof item.category === "string" && item.category.trim()
        ? item.category.trim()
        : "Other";
    const sourceUrl = typeof item.sourceUrl === "string" ? item.sourceUrl.trim() : "";
    const notes = typeof item.notes === "string" ? item.notes.trim() : "";
    const source = item.source === "scorecard" ? "scorecard" : "catalog";
    out.push({ id, name, category, sourceUrl, notes, source });
  }
  return out;
}

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
    const category = typeof item.category === "string" ? item.category.trim() : "";
    const source: ProgramSource =
      item.source === "catalog" || item.source === "scorecard" || item.source === "manual"
        ? item.source
        : "manual";
    out.push({ id, name, sourceUrl, category, source });
  }
  return out;
}
