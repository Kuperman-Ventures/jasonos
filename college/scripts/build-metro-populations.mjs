/**
 * Build data/metro-populations.json from Census CBSA population estimates.
 *
 * Downloads cbsa-est2025-alldata.csv (Latin-1), keeps Metropolitan /
 * Micropolitan Statistical Area rows, and writes:
 *   { "31080": { "name": "...", "type": "Metropolitan", "population": 12844441 } }
 *
 * Usage (from college/):
 *   node scripts/build-metro-populations.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT, "data", "metro-populations.json");
const CSV_URL =
  "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/metro/totals/cbsa-est2025-alldata.csv";

const KEEP_LSAD = new Set([
  "Metropolitan Statistical Area",
  "Micropolitan Statistical Area",
]);

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      fields.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

async function downloadLatin1(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Census download failed: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("latin1");
}

function typeFromLsad(lsad) {
  if (lsad === "Metropolitan Statistical Area") return "Metropolitan";
  if (lsad === "Micropolitan Statistical Area") return "Micropolitan";
  return lsad;
}

async function main() {
  console.log("Downloading", CSV_URL);
  const text = await downloadLatin1(CSV_URL);
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) throw new Error("Census CSV was empty");

  const headers = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(headers.map((name, i) => [name, i]));
  for (const needed of ["CBSA", "NAME", "LSAD", "POPESTIMATE2025"]) {
    if (idx[needed] == null) {
      throw new Error(`Census CSV missing column ${needed}. Headers: ${headers.join(", ")}`);
    }
  }

  /** @type {Record<string, { name: string; type: string; population: number }>} */
  const out = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const lsad = cols[idx.LSAD]?.trim() ?? "";
    if (!KEEP_LSAD.has(lsad)) continue;
    const cbsa = String(cols[idx.CBSA] ?? "").trim();
    if (!cbsa) continue;
    const population = Number(cols[idx.POPESTIMATE2025]);
    if (!Number.isFinite(population)) continue;
    out[cbsa] = {
      name: (cols[idx.NAME] ?? "").trim(),
      type: typeFromLsad(lsad),
      population: Math.round(population),
    };
  }

  const keys = Object.keys(out);
  if (keys.length === 0) throw new Error("No metro/micro rows parsed");

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`Wrote ${keys.length} areas → ${path.relative(ROOT, OUT_PATH)}`);

  const la = out["31080"];
  const houghton = out["26340"];
  console.log("Check 31080:", la);
  console.log("Check 26340:", houghton);
  if (!la || la.population !== 12_844_441) {
    console.warn("Expected 31080 population 12844441, got", la?.population);
  }
  if (!houghton || houghton.population !== 40_028) {
    console.warn("Expected 26340 population 40028, got", houghton?.population);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
