/**
 * Match existing college list schools to College Scorecard unit IDs.
 *
 * Prints a review table only — does not write to the database.
 *
 * Usage (from college/):
 *   node scripts/backfill-unit-ids.mjs
 *
 * Prefers COLLEGE_SCORECARD_API_KEY or SCORECARD_API_KEY from .env.local.
 * Falls back to DEMO_KEY (rate-limited).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_URL = "https://api.data.gov/ed/collegescorecard/v1/schools.json";

/** Exact names as stored in college.schools (list_order). */
const SCHOOLS = [
  "Massachusetts Institute of Technology (MIT)",
  "Stanford University",
  "University of California, Berkeley (UC Berkeley)",
  "Cornell University",
  "Northwestern University",
  "Carnegie Mellon University (CMU)",
  "University of Pennsylvania (UPenn)",
  "Johns Hopkins University",
  "Georgia Institute of Technology (Georgia Tech)",
  "University of Michigan–Ann Arbor",
  "University of Illinois Urbana-Champaign (UIUC)",
  "University of Texas at Austin (UT Austin)",
  "University of California, Los Angeles (UCLA)",
  "Purdue University",
  "University of Maryland, College Park",
  "University of Washington",
  "University of Wisconsin–Madison",
  "Virginia Polytechnic Institute and State University (Virginia Tech)",
  "Pennsylvania State University (Penn State)",
  "Ohio State University",
  "University of Minnesota Twin Cities",
  "North Carolina State University (NC State)",
  "University of California, Davis (UC Davis)",
  "University of California, Irvine (UC Irvine)",
  "Case Western Reserve University",
  "Rensselaer Polytechnic Institute (RPI)",
  "Rutgers University–New Brunswick",
  "University of Florida",
  "Texas A&M University",
  "Colorado School of Mines",
  "University of Virginia (UVA)",
  "Lehigh University",
  "University of Connecticut (UConn)",
  "University of Delaware",
  "Drexel University",
  "Iowa State University",
  "Clemson University",
  "University of Tennessee, Knoxville",
  "Michigan Technological University (Michigan Tech)",
  "New Jersey Institute of Technology (NJIT)",
  "Worcester Polytechnic Institute (WPI)",
  "Stevens Institute of Technology",
  "Rose-Hulman Institute of Technology",
  "Vassar College",
  "University of Pittsburgh",
];

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function apiKey() {
  const fileEnv = loadEnvLocal();
  return (
    process.env.COLLEGE_SCORECARD_API_KEY?.trim() ||
    process.env.SCORECARD_API_KEY?.trim() ||
    fileEnv.COLLEGE_SCORECARD_API_KEY ||
    fileEnv.SCORECARD_API_KEY ||
    "DEMO_KEY"
  );
}

/** Strip nickname parentheses, e.g. "(MIT)", and commas that break Scorecard search. */
function searchName(name) {
  return name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMatches(name, key) {
  const url = new URL(API_URL);
  url.searchParams.set("api_key", key);
  url.searchParams.set("school.name", searchName(name));
  url.searchParams.set("school.operating", "1");
  url.searchParams.set("school.degrees_awarded.predominant", "3");
  url.searchParams.set("fields", "id,school.name,school.city,school.state");
  url.searchParams.set("per_page", "20");

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status === 429 || response.status >= 500) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!response.ok) {
        throw new Error(`Scorecard ${response.status} for ${name}`);
      }
      const body = await response.json();
      return body.results ?? [];
    } catch (error) {
      if (attempt === 5) throw error;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw new Error(`Scorecard failed for ${name}`);
}

function pad(value, width) {
  const text = String(value ?? "");
  return text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rankMatches(appName, matches) {
  const target = normalizeName(searchName(appName));
  return [...matches].sort((a, b) => {
    const aName = normalizeName(a["school.name"]);
    const bName = normalizeName(b["school.name"]);
    const aExact = aName === target ? 0 : aName.includes(target) || target.includes(aName) ? 1 : 2;
    const bExact = bName === target ? 0 : bName.includes(target) || target.includes(bName) ? 1 : 2;
    if (aExact !== bExact) return aExact - bExact;
    return aName.localeCompare(bName);
  });
}

async function main() {
  const key = apiKey();
  if (key === "DEMO_KEY") {
    console.warn("Using DEMO_KEY (rate-limited). Add COLLEGE_SCORECARD_API_KEY to .env.local for reliability.");
  }

  const rows = [];
  for (const school of SCHOOLS) {
    const raw = await fetchMatches(school, key);
    const matches = rankMatches(school, raw);
    let flag = "";
    if (matches.length === 0) flag = "ZERO MATCHES";
    else if (matches.length > 1) flag = `MULTI (${matches.length})`;

    if (matches.length === 0) {
      rows.push({
        app: school,
        matched: "—",
        city: "—",
        state: "—",
        id: "—",
        flag,
      });
    } else {
      const target = normalizeName(searchName(school));
      for (const [index, match] of matches.entries()) {
        const exact = normalizeName(match["school.name"]) === target;
        rows.push({
          app: index === 0 ? school : "",
          matched: match["school.name"] ?? "",
          city: match["school.city"] ?? "",
          state: match["school.state"] ?? "",
          id: match.id ?? "",
          flag: index === 0 ? flag : exact ? "exact" : "",
        });
        if (index === 0 && matches.length > 1 && exact) {
          rows[rows.length - 1].flag = `${flag}; suggested`;
        } else if (index === 0 && matches.length > 1) {
          // keep MULTI flag; first row is best ranked guess
          rows[rows.length - 1].flag = `${flag}; best-ranked`;
        }
      }
    }

    await sleep(key === "DEMO_KEY" ? 350 : 80);
  }

  console.log("");
  console.log(
    pad("App school name", 52),
    pad("Scorecard name", 48),
    pad("City", 18),
    pad("ST", 4),
    pad("ID", 8),
    "Flag",
  );
  console.log("-".repeat(140));
  for (const row of rows) {
    console.log(
      pad(row.app, 52),
      pad(row.matched, 48),
      pad(row.city, 18),
      pad(row.state, 4),
      pad(row.id, 8),
      row.flag,
    );
  }

  const zero = rows.filter((r) => r.flag === "ZERO MATCHES").length;
  const multi = rows.filter((r) => r.flag.startsWith("MULTI")).length;
  const ok = SCHOOLS.length - zero - multi;
  console.log("");
  console.log(`Schools: ${SCHOOLS.length}  unique match: ${ok}  multi: ${multi}  zero: ${zero}`);
  console.log("Nothing saved. Confirm matches before writing unitId values.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
