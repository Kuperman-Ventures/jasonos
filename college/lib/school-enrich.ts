/**
 * Apply the same local catalogs and research sources existing schools got
 * offline (Common App grid, engineering catalog, submissions JSON, seed
 * program Yes/No) onto a school after add or on demand.
 */

import engineeringProgramsFile from "@/data/engineering-programs.json";
import submissionsFile from "@/data/school-submissions-2026-10-03.json";
import schoolsFile from "@/content/schools.json";
import type { ProgramOption } from "./additional-programs";
import { queryCommonAppGrid } from "./common-app-grid";
import { applySchoolFacts, getSchool, updateSchool } from "./db";
import {
  CANONICAL_BY_UNIT_ID,
  canonicalForUnitId,
  normalizeCatalogName,
} from "./school-canonical";
import { lookupSchool } from "./school-lookup";
import { normalizeSubmissions, type SchoolSubmissions } from "./school-submissions";
import {
  RESEARCH_GROUP_NAMES,
  type ResearchGroupName,
} from "./research";
import {
  selectivityTierFromContext,
  selectivityTierFromRate,
  type School,
} from "./types";

type EngCatalogSchool = {
  schoolId: string;
  school: string;
  programs: Array<{
    id: string;
    name: string;
    category: string;
    sourceUrl: string;
    notes?: string;
  }>;
};

type SeedRow = {
  id: string;
  name: string;
  mechanicalEngineering?: string;
  materials?: string;
  materialsOffering?: string;
  materialsProgram?: string;
  materialsSourceUrl?: string;
  aerospaceEngineering?: string;
  aerospaceProgram?: string;
  aerospaceNotes?: string;
  aerospaceSourceUrl?: string;
  campusSetting?: string;
  admissionsContext?: string;
};

const engCatalog = engineeringProgramsFile as EngCatalogSchool[];
const submissionsById = (submissionsFile as { schools: Record<string, unknown> }).schools;
const seedRows = schoolsFile.schools as SeedRow[];

function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function catalogKeysFor(school: Pick<School, "id" | "name" | "unitId">): string[] {
  const keys = new Set<string>();
  keys.add(school.id);
  const canonical = school.unitId != null ? canonicalForUnitId(school.unitId) : null;
  if (canonical) keys.add(canonical.id);
  const norm = normalizeCatalogName(school.name);
  if (norm) keys.add(norm);
  if (canonical) keys.add(normalizeCatalogName(canonical.name));
  return [...keys];
}

export function findEngineeringCatalog(
  school: Pick<School, "id" | "name" | "unitId">,
): EngCatalogSchool | null {
  const keys = catalogKeysFor(school);
  for (const row of engCatalog) {
    if (keys.includes(row.schoolId)) return row;
    if (keys.includes(normalizeCatalogName(row.school))) return row;
  }
  // Fuzzy: normalized name equality against catalog school names.
  const want = normalizeCatalogName(school.name);
  if (!want) return null;
  return (
    engCatalog.find((row) => normalizeCatalogName(row.school) === want) ??
    engCatalog.find((row) => {
      const a = normalizeCatalogName(row.school);
      return a.length >= 8 && (want.startsWith(a) || a.startsWith(want));
    }) ??
    null
  );
}

export function findSubmissionsCatalog(
  school: Pick<School, "id" | "name" | "unitId">,
): { catalogId: string; submissions: SchoolSubmissions } | null {
  const keys = catalogKeysFor(school);
  for (const key of keys) {
    const raw = submissionsById[key];
    const parsed = normalizeSubmissions(raw);
    if (parsed) return { catalogId: key, submissions: parsed };
  }
  // Match by seed id when unitId maps to a canonical school.
  const canonical = school.unitId != null ? canonicalForUnitId(school.unitId) : null;
  if (canonical) {
    const parsed = normalizeSubmissions(submissionsById[canonical.id]);
    if (parsed) return { catalogId: canonical.id, submissions: parsed };
  }
  return null;
}

export function findSeedProgramFacts(
  school: Pick<School, "id" | "name" | "unitId">,
): SeedRow | null {
  const keys = catalogKeysFor(school);
  for (const row of seedRows) {
    if (keys.includes(row.id)) return row;
    if (keys.includes(normalizeCatalogName(row.name))) return row;
  }
  const want = normalizeCatalogName(school.name);
  if (!want) return null;
  return seedRows.find((row) => normalizeCatalogName(row.name) === want) ?? null;
}

function catalogProgramsToOptions(row: EngCatalogSchool): ProgramOption[] {
  return row.programs.map((program) => ({
    id: program.id,
    name: program.name,
    category: program.category,
    sourceUrl: program.sourceUrl,
    notes: program.notes?.trim() ?? "",
    source: "catalog" as const,
  }));
}

function parseAdmitPct(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/** Research groups we can mark done from filled fields (not Fall 2028 detail). */
export function researchGroupsFilledByFields(
  school: School,
): ResearchGroupName[] {
  const done: ResearchGroupName[] = [];
  if (school.campusSetting?.trim()) done.push("Setting");
  if (
    school.mechanicalEngineering?.trim() &&
    school.materials?.trim() &&
    school.aerospaceEngineering?.trim()
  ) {
    done.push("Programs");
  }
  if (school.residencyDataStatus?.trim()) done.push("Admissions by residency");
  if (
    school.testPolicy?.trim() &&
    school.applicationPlatform?.trim() &&
    school.requiredEssays?.trim()
  ) {
    done.push("Application requirements");
  }
  if (school.meritAidNotes?.trim()) done.push("Aid");
  if (school.submissions && school.submissionsCheckedDate?.trim()) {
    done.push("Submissions");
  }
  return done.filter((name) =>
    (RESEARCH_GROUP_NAMES as readonly string[]).includes(name),
  );
}

function mergeResearchCompleted(
  current: string[] | undefined,
  extra: ResearchGroupName[],
): string[] {
  const set = new Set([...(current ?? []), ...extra]);
  return RESEARCH_GROUP_NAMES.filter((name) => set.has(name));
}

export type EnrichSchoolResult = {
  school: School;
  applied: string[];
};

/**
 * Fill blank fields from local catalogs + Common App + optional web lookup.
 * Does not overwrite non-blank values.
 */
export async function enrichSchoolRecord(
  schoolId: string,
  options: { webLookup?: boolean } = {},
): Promise<EnrichSchoolResult> {
  const webLookup = options.webLookup !== false;
  let school = await getSchool(schoolId);
  const applied: string[] = [];
  const patch: Record<string, unknown> = {};

  // Prefer the family's display name for known unit IDs.
  const canonical =
    school.unitId != null ? canonicalForUnitId(school.unitId) : null;
  if (canonical && school.name !== canonical.name) {
    patch.name = canonical.name;
  }

  // Common App grid (platform, essays, recs, test policy, deadlines).
  if (
    !school.applicationPlatform?.trim() ||
    !school.requiredEssays?.trim() ||
    !school.teacherRecs?.trim() ||
    !school.testPolicy?.trim() ||
    !school.deadlines?.length
  ) {
    const lookup = queryCommonAppGrid(canonical?.name ?? school.name);
    if (lookup.status === "hit" && lookup.facts) {
      school = await applySchoolFacts(school.id, lookup.facts, { onlyBlank: true });
      applied.push("common-app");
    }
  }

  // Seed program Yes/Partial/No + campus setting when blank.
  const seed = findSeedProgramFacts(school);
  if (seed) {
    const seedPatch: Record<string, unknown> = {};
    if (!school.campusSetting?.trim() && seed.campusSetting?.trim()) {
      seedPatch.campusSetting = seed.campusSetting.trim();
    }
    if (!school.mechanicalEngineering?.trim() && seed.mechanicalEngineering?.trim()) {
      seedPatch.mechanicalEngineering = seed.mechanicalEngineering.trim();
    }
    if (!school.materials?.trim() && seed.materials?.trim()) {
      seedPatch.materials = seed.materials.trim();
    }
    if (!school.materialsOffering?.trim() && seed.materialsOffering?.trim()) {
      seedPatch.materialsOffering = seed.materialsOffering.trim();
    }
    if (!school.materialsProgram?.trim() && seed.materialsProgram?.trim()) {
      seedPatch.materialsProgram = seed.materialsProgram.trim();
    }
    if (!school.materialsSourceUrl?.trim() && seed.materialsSourceUrl?.trim()) {
      seedPatch.materialsSourceUrl = seed.materialsSourceUrl.trim();
    }
    if (!school.aerospaceEngineering?.trim() && seed.aerospaceEngineering?.trim()) {
      seedPatch.aerospaceEngineering = seed.aerospaceEngineering.trim();
    }
    if (!school.aerospaceProgram?.trim() && seed.aerospaceProgram?.trim()) {
      seedPatch.aerospaceProgram = seed.aerospaceProgram.trim();
    }
    if (!school.aerospaceNotes?.trim() && seed.aerospaceNotes?.trim()) {
      seedPatch.aerospaceNotes = seed.aerospaceNotes.trim();
    }
    if (!school.aerospaceSourceUrl?.trim() && seed.aerospaceSourceUrl?.trim()) {
      seedPatch.aerospaceSourceUrl = seed.aerospaceSourceUrl.trim();
    }
    if (!school.admissionsContext?.trim() && seed.admissionsContext?.trim()) {
      seedPatch.admissionsContext = seed.admissionsContext.trim();
    }
    if (Object.keys(seedPatch).length) {
      Object.assign(patch, seedPatch);
      applied.push("seed");
    }
  }

  // Catalog engineering program list (prefer over Scorecard CIP-only rows).
  const eng = findEngineeringCatalog(school);
  const hasCatalogPrograms = school.programOptions?.some((p) => p.source === "catalog");
  if (eng && eng.programs.length && !hasCatalogPrograms) {
    patch.programOptions = catalogProgramsToOptions(eng);
    patch.programOptionsCheckedDate = todayIsoDate();
    applied.push("engineering-catalog");
  }

  // Submissions research dump.
  if (!school.submissions || !school.submissionsCheckedDate?.trim()) {
    const subs = findSubmissionsCatalog(school);
    if (subs) {
      patch.submissions = subs.submissions;
      patch.submissionsCheckedDate =
        (submissionsFile as { checkedDate?: string }).checkedDate ?? todayIsoDate();
      applied.push("submissions");
    }
  }

  // Selectivity tier from admit rate text or numeric rates.
  if (!school.selectivityTier?.trim()) {
    const fromContext = selectivityTierFromContext(school.admissionsContext ?? "");
    const fromRate =
      selectivityTierFromRate(school.rateThatAppliesToKyle) ||
      selectivityTierFromRate(school.overallAdmitRate) ||
      selectivityTierFromRate(parseAdmitPct(school.admissionsContext ?? ""));
    const tier = fromContext || fromRate;
    if (tier) {
      patch.selectivityTier = tier;
      applied.push("selectivity-tier");
    }
  }

  if (Object.keys(patch).length) {
    school = await updateSchool(school.id, patch);
  }

  // Web / Perplexity fill for remaining blanks (essays detail, Partial programs, merit).
  if (webLookup) {
    try {
      const lookup = await lookupSchool(canonical?.name ?? school.name);
      const before = school;
      school = await applySchoolFacts(school.id, lookup.facts, { onlyBlank: true });
      const changed =
        before.applicationPlatform !== school.applicationPlatform ||
        before.requiredEssays !== school.requiredEssays ||
        before.teacherRecs !== school.teacherRecs ||
        before.testPolicy !== school.testPolicy ||
        before.mechanicalEngineering !== school.mechanicalEngineering ||
        before.materials !== school.materials ||
        before.aerospaceEngineering !== school.aerospaceEngineering ||
        before.meritAidNotes !== school.meritAidNotes ||
        before.campusSetting !== school.campusSetting ||
        before.deadlines.length !== school.deadlines.length;
      if (changed) applied.push("web-lookup");
    } catch (error) {
      console.error("School enrich web lookup failed", error);
    }
  }

  // Mark research groups complete when the fields they need are present.
  const filled = researchGroupsFilledByFields(school);
  const nextCompleted = mergeResearchCompleted(school.researchCompleted, filled);
  if (
    nextCompleted.length !== (school.researchCompleted?.length ?? 0) ||
    nextCompleted.some((g, i) => g !== school.researchCompleted?.[i])
  ) {
    school = await updateSchool(school.id, { researchCompleted: nextCompleted });
    applied.push("research-flags");
  }

  return { school, applied };
}

/** Known unit IDs that already have curated Kyle-list research. */
export function knownUnitIds(): number[] {
  return Object.keys(CANONICAL_BY_UNIT_ID).map(Number);
}
