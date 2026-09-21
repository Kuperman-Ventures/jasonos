export type SourceLink = { title: string; url: string };

export type DeadlineFact = { title: string; dueDate: string | null };

export type FoundFacts = {
  location: string;
  campusSize: string;
  mechanicalEngineering: string;
  materials: string;
  materialsOffering: string;
  admissionsContext: string;
  satContext: string;
  testPolicy: string;
  middle50: string;
  applicationPlatform: string;
  requiredEssays: string;
  teacherRecs: string;
  costOfAttendance: string;
  netPriceEstimate: string;
  meritAidNotes: string;
  website: string;
  deadlines: DeadlineFact[];
  sources: SourceLink[];
};

export type SearchFacts = {
  officialName: string;
  location: string;
  campusSize: string;
  mechanicalEngineering: string;
  materials: string;
  materialsOffering: string;
  testPolicy: string;
  applicationPlatform: string;
  requiredEssays: string;
  teacherRecs: string;
  meritAidNotes: string;
  deadlines: DeadlineFact[];
};

export type ScorecardRow = {
  id: number;
  "school.name": string;
  "school.city"?: string | null;
  "school.state"?: string | null;
  "school.locale"?: number | null;
  "school.school_url"?: string | null;
  "school.ownership"?: number | null;
  "latest.student.size"?: number | null;
  "latest.admissions.admission_rate.overall"?: number | null;
  "latest.admissions.test_requirements"?: number | null;
  "latest.admissions.sat_scores.25th_percentile.critical_reading"?: number | null;
  "latest.admissions.sat_scores.75th_percentile.critical_reading"?: number | null;
  "latest.admissions.sat_scores.25th_percentile.math"?: number | null;
  "latest.admissions.sat_scores.75th_percentile.math"?: number | null;
  "latest.cost.attendance.academic_year"?: number | null;
  "latest.cost.tuition.in_state"?: number | null;
  "latest.cost.tuition.out_of_state"?: number | null;
  "latest.cost.roomboard.oncampus"?: number | null;
  "latest.cost.booksupply"?: number | null;
  "latest.cost.otherexpense.oncampus"?: number | null;
  "latest.cost.avg_net_price.public"?: number | null;
  "latest.cost.avg_net_price.private"?: number | null;
};

const STOP = new Set(["of", "the", "at", "and", "for", "main", "campus"]);

export function emptyFacts(): FoundFacts {
  return {
    location: "",
    campusSize: "",
    mechanicalEngineering: "",
    materials: "",
    materialsOffering: "",
    admissionsContext: "",
    satContext: "",
    testPolicy: "",
    middle50: "",
    applicationPlatform: "",
    requiredEssays: "",
    teacherRecs: "",
    costOfAttendance: "",
    netPriceEstimate: "",
    meritAidNotes: "",
    website: "",
    deadlines: [],
    sources: [],
  };
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !STOP.has(word));
}

export function scoreSchoolName(query: string, name: string): number {
  const wanted = tokens(query);
  const have = tokens(name);
  let score = 0;
  for (const token of wanted) {
    if (have.includes(token)) score += 5;
    else if (token === "tech" && have.some((word) => word.startsWith("technolog"))) score += 4;
    else if (token.length > 3 && have.some((word) => word.startsWith(token))) score += 2;
  }
  if (name.toLowerCase().includes("technical college") && !query.toLowerCase().includes("technical")) {
    score -= 6;
  }
  const branchWords = ["fort", "wayne", "regional", "global", "worldwide"];
  if (have.some((word) => branchWords.includes(word)) && !wanted.some((word) => branchWords.includes(word))) {
    score -= 15;
  }
  const compactQuery = query.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const compactName = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (compactQuery && (compactName.includes(compactQuery) || compactQuery.includes(compactName))) score += 6;
  return score;
}

export function pickScorecardMatch(query: string, rows: ScorecardRow[]): ScorecardRow | null {
  let best: ScorecardRow | null = null;
  let bestScore = 0;
  for (const row of rows) {
    const name = row["school.name"];
    if (!name) continue;
    const score = scoreSchoolName(query, name);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return bestScore >= 4 ? best : null;
}

function localeLabel(code: number | null | undefined): string {
  if (code == null) return "";
  if (code >= 11 && code <= 13) return "Urban";
  if (code >= 21 && code <= 23) return "Suburban";
  if (code >= 31 && code <= 33) return "Town";
  if (code >= 41 && code <= 43) return "Rural";
  return "";
}

function sizeLabel(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(count)) return "";
  if (count < 5000) return "Small";
  if (count < 15000) return "Medium";
  if (count < 30000) return "Large";
  return "Very Large";
}

function money(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function stickerPrice(row: ScorecardRow): string {
  const attendance = row["latest.cost.attendance.academic_year"];
  const published = typeof attendance === "number" && attendance > 0 ? `${money(attendance)} sticker price, latest College Scorecard` : "";
  const ownership = row["school.ownership"];
  const state = row["school.state"]?.trim() ?? "";
  if (ownership !== 1 || state === "NJ" || state === "") return published;
  const tuitionOut = row["latest.cost.tuition.out_of_state"];
  const room = row["latest.cost.roomboard.oncampus"];
  const books = row["latest.cost.booksupply"];
  const other = row["latest.cost.otherexpense.oncampus"];
  if (typeof tuitionOut !== "number" || typeof room !== "number") return published;
  const extras = room + (typeof books === "number" ? books : 0) + (typeof other === "number" ? other : 0);
  const outOfState = `${money(tuitionOut + extras)} out-of-state sticker from College Scorecard tuition plus on-campus room, books, and other expenses`;
  return published ? `${outOfState}. In-state attendance figure ${money(attendance as number)}` : outOfState;
}

function admitRate(rate: number): string {
  const pct = rate * 100;
  const rounded = pct >= 10 ? Math.round(pct).toString() : (Math.round(pct * 10) / 10).toString();
  return `${rounded}%`;
}

function testPolicyLabel(code: number | null | undefined): string {
  if (code === 1) return "Test required";
  if (code === 2) return "Test recommended";
  if (code === 3) return "Tests neither required nor recommended";
  if (code === 5) return "Tests considered but not required";
  return "";
}

function httpsUrl(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function netPriceLine(row: ScorecardRow): string {
  const ownership = row["school.ownership"];
  const publicNet = row["latest.cost.avg_net_price.public"];
  const privateNet = row["latest.cost.avg_net_price.private"];
  const amount =
    ownership === 1
      ? typeof publicNet === "number"
        ? publicNet
        : null
      : typeof privateNet === "number"
        ? privateNet
        : typeof publicNet === "number"
          ? publicNet
          : null;
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return "";
  const audience = ownership === 1 ? "in-state students receiving federal aid" : "students receiving federal aid";
  return `${money(amount)} average net price for ${audience} (College Scorecard)`;
}

function satLine(row: ScorecardRow): string {
  const readLow = row["latest.admissions.sat_scores.25th_percentile.critical_reading"];
  const readHigh = row["latest.admissions.sat_scores.75th_percentile.critical_reading"];
  const mathLow = row["latest.admissions.sat_scores.25th_percentile.math"];
  const mathHigh = row["latest.admissions.sat_scores.75th_percentile.math"];
  const parts: string[] = [];
  if (readLow && readHigh) parts.push(`reading ${readLow}-${readHigh}`);
  if (mathLow && mathHigh) parts.push(`math ${mathLow}-${mathHigh}`);
  return parts.length ? `SAT ${parts.join(", ")}` : "";
}

export function mapScorecard(row: ScorecardRow): FoundFacts {
  const facts = emptyFacts();
  const city = row["school.city"]?.trim() ?? "";
  const state = row["school.state"]?.trim() ?? "";
  facts.location = [city, state].filter(Boolean).join(", ");
  const place = localeLabel(row["school.locale"]);
  const size = sizeLabel(row["latest.student.size"]);
  facts.campusSize = [place, size].filter(Boolean).join(" / ");
  const rate = row["latest.admissions.admission_rate.overall"];
  if (typeof rate === "number" && rate > 0 && rate <= 1) {
    facts.admissionsContext = `Admit rate ${admitRate(rate)} in the latest College Scorecard`;
  }
  facts.satContext = satLine(row);
  facts.middle50 = facts.satContext;
  facts.testPolicy = testPolicyLabel(row["latest.admissions.test_requirements"]);
  facts.costOfAttendance = stickerPrice(row);
  facts.netPriceEstimate = netPriceLine(row);
  const site = httpsUrl(row["school.school_url"]);
  facts.website = site;
  if (site) facts.sources.push({ title: row["school.name"], url: site });
  facts.sources.push({
    title: "College Scorecard",
    url: `https://collegescorecard.ed.gov/school/?${row.id}`,
  });
  return facts;
}

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function yesNo(value: unknown): string {
  const text = clip(value, 8).toLowerCase();
  if (text === "yes") return "Yes";
  if (text === "no") return "No";
  return "";
}

function isoDate(value: unknown, today: string): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return null;
  }
  if (value < today) return null;
  return value;
}

export function parseSearchJson(text: string, today: string): SearchFacts | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const deadlines = Array.isArray(row.deadlines) ? row.deadlines : [];
  const parsedDeadlines: DeadlineFact[] = [];
  for (const item of deadlines) {
    if (!item || typeof item !== "object") continue;
    const deadline = item as Record<string, unknown>;
    const title = clip(deadline.title, 140);
    if (!title) continue;
    const rawDate = typeof deadline.dueDate === "string" ? deadline.dueDate : "";
    const dueDate = isoDate(rawDate, today);
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !dueDate) continue;
    parsedDeadlines.push({ title, dueDate });
    if (parsedDeadlines.length === 8) break;
  }
  return {
    officialName: clip(row.officialName, 160),
    location: clip(row.location, 80),
    campusSize: clip(row.campusSize, 80),
    mechanicalEngineering: yesNo(row.mechanicalEngineering),
    materials: yesNo(row.materials),
    materialsOffering: clip(row.materialsOffering, 180),
    testPolicy: clip(row.testPolicy, 180),
    applicationPlatform: clip(row.applicationPlatform, 180),
    requiredEssays: clip(row.requiredEssays, 500),
    teacherRecs: clip(row.teacherRecs, 180),
    meritAidNotes: clip(row.meritAidNotes, 500),
    deadlines: parsedDeadlines,
  };
}

function fillBlank(current: string, next: string): string {
  return current || next;
}

export function mergeFacts(scorecard: FoundFacts | null, search: SearchFacts | null, sources: SourceLink[]): FoundFacts {
  const facts = scorecard ? { ...scorecard, deadlines: [...scorecard.deadlines], sources: [...scorecard.sources] } : emptyFacts();
  if (!search || sources.length === 0) return facts;
  facts.location = fillBlank(facts.location, search.location);
  facts.campusSize = fillBlank(facts.campusSize, search.campusSize);
  facts.mechanicalEngineering = fillBlank(facts.mechanicalEngineering, search.mechanicalEngineering);
  facts.materials = fillBlank(facts.materials, search.materials);
  facts.materialsOffering = fillBlank(facts.materialsOffering, search.materialsOffering);
  facts.testPolicy = fillBlank(facts.testPolicy, search.testPolicy);
  facts.applicationPlatform = fillBlank(facts.applicationPlatform, search.applicationPlatform);
  facts.requiredEssays = fillBlank(facts.requiredEssays, search.requiredEssays);
  facts.teacherRecs = fillBlank(facts.teacherRecs, search.teacherRecs);
  facts.meritAidNotes = fillBlank(facts.meritAidNotes, search.meritAidNotes);
  const seen = new Set(facts.deadlines.map((item) => `${item.title}|${item.dueDate ?? ""}`));
  for (const deadline of search.deadlines) {
    const key = `${deadline.title}|${deadline.dueDate ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    facts.deadlines.push(deadline);
  }
  const urls = new Set(facts.sources.map((item) => item.url));
  for (const source of sources) {
    if (!source.url || urls.has(source.url)) continue;
    urls.add(source.url);
    facts.sources.push(source);
  }
  return facts;
}

export function formatSources(sources: SourceLink[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const source of sources) {
    if (!source.url || seen.has(source.url) || !/^https?:\/\//i.test(source.url)) continue;
    seen.add(source.url);
    lines.push(`${source.title || "Source"} | ${source.url}`);
  }
  return lines.join("\n");
}

export function sourceLines(text: string): SourceLink[] {
  return text
    .split("\n")
    .map((line) => {
      const split = line.lastIndexOf(" | ");
      if (split === -1) return null;
      const url = line.slice(split + 3).trim();
      if (!/^https?:\/\//i.test(url)) return null;
      return { title: line.slice(0, split).trim() || "Source", url };
    })
    .filter((item): item is SourceLink => Boolean(item));
}

function joined(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function lookupSummary(input: {
  name: string;
  facts: FoundFacts;
  scorecard: "hit" | "miss" | "failed";
  search: "filled" | "empty" | "skipped" | "failed";
}): string {
  const scorecardBits: string[] = [];
  if (input.facts.location) scorecardBits.push("location");
  if (input.facts.campusSize) scorecardBits.push("campus size");
  if (input.facts.admissionsContext) scorecardBits.push("admit rate");
  if (input.facts.satContext || input.facts.middle50) scorecardBits.push("SAT range");
  if (input.facts.testPolicy) scorecardBits.push("test policy");
  if (input.facts.costOfAttendance) scorecardBits.push("sticker price");
  if (input.facts.netPriceEstimate) scorecardBits.push("net price");
  if (input.facts.website) scorecardBits.push("website");

  const searchBits: string[] = [];
  if (input.facts.applicationPlatform) searchBits.push("application platform");
  if (input.facts.requiredEssays) searchBits.push("essays");
  if (input.facts.teacherRecs) searchBits.push("teacher recommendations");
  if (input.facts.mechanicalEngineering || input.facts.materials) searchBits.push("engineering programs");
  if (input.facts.deadlines.length === 1) searchBits.push("1 deadline");
  if (input.facts.deadlines.length > 1) searchBits.push(`${input.facts.deadlines.length} deadlines`);

  const parts = [`Added ${input.name}.`];
  if (input.scorecard === "hit" && scorecardBits.length) {
    parts.push(`College Scorecard filled ${joined(scorecardBits)}.`);
  } else if (input.scorecard === "miss") {
    parts.push("College Scorecard had no matching school, so the SAT range and sticker price were left blank.");
  } else if (input.scorecard === "failed") {
    parts.push("College Scorecard did not respond, so the SAT range and sticker price were left blank.");
  }

  if (input.search === "filled" && searchBits.length) {
    parts.push(`Web search filled ${joined(searchBits)}.`);
  } else if (input.search === "empty") {
    parts.push("Web search did not find essays, recommendations, or deadlines.");
  } else if (input.search === "skipped" || input.search === "failed") {
    parts.push("Web search did not run, so essays, recommendations, and deadlines were left blank.");
  }

  parts.push("Interest, selectivity tier, and net price stay blank.");
  return parts.join(" ");
}
