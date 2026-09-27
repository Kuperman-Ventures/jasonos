#!/usr/bin/env node
/**
 * One-time Google Routes matrix for Kyle College travel points.
 *
 * Reads GOOGLE_MAPS_API_KEY (+ optional ORIGIN_ADDRESS) from college/.env.local,
 * loads data/travel-points.json, and writes data/drive-matrix.json.
 *
 * Usage (from college/): node scripts/compute-drive-matrix.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const POINTS_PATH = path.join(ROOT, "data", "travel-points.json");
const OUT_PATH = path.join(ROOT, "data", "drive-matrix.json");

const GROUP_SIZE = 25;
const REQUEST_GAP_MS = 1000;
const MAX_RETRIES = 3;
const MATRIX_URL =
  "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

function loadEnvLocal(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDurationSeconds(duration) {
  if (typeof duration === "number" && Number.isFinite(duration)) return duration;
  if (typeof duration !== "string") return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(duration.trim());
  if (!match) return null;
  return Number(match[1]);
}

function metersToMiles(meters) {
  return Math.round(meters / 1609.344);
}

function secondsToMinutes(seconds) {
  return Math.round(seconds / 60);
}

function waypoint(address) {
  return { waypoint: { address } };
}

function statusMessage(status) {
  if (status == null || status === "") return "";
  if (typeof status === "string") return status;
  if (typeof status === "object") {
    return status.message || status.code || JSON.stringify(status);
  }
  return String(status);
}

async function fetchMatrix(apiKey, origins, destinations) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(MATRIX_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "originIndex,destinationIndex,duration,distanceMeters,status,condition",
        },
        body: JSON.stringify({
          origins: origins.map((p) => waypoint(p.address)),
          destinations: destinations.map((p) => waypoint(p.address)),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_UNAWARE",
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
      }
      const data = JSON.parse(text);
      if (!Array.isArray(data)) {
        throw new Error(`Unexpected response shape: ${text.slice(0, 400)}`);
      }
      return data;
    } catch (err) {
      lastError = err;
      console.warn(
        `  request failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message}`,
      );
      if (attempt < MAX_RETRIES) await sleep(REQUEST_GAP_MS * attempt);
    }
  }
  throw lastError ?? new Error("Route matrix request failed");
}

function formatDriveMinutes(minutes) {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

async function main() {
  const fileEnv = loadEnvLocal(ENV_PATH);
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY || fileEnv.GOOGLE_MAPS_API_KEY || "";
  const originAddress =
    process.env.ORIGIN_ADDRESS ||
    fileEnv.ORIGIN_ADDRESS ||
    "Maplewood, NJ 07040";

  if (!apiKey) {
    console.error(
      "Missing GOOGLE_MAPS_API_KEY. Add it to college/.env.local (or the environment) and re-run.",
    );
    process.exit(1);
  }

  if (!fs.existsSync(POINTS_PATH)) {
    console.error(`Missing ${POINTS_PATH}`);
    process.exit(1);
  }

  const { points: rawPoints } = JSON.parse(fs.readFileSync(POINTS_PATH, "utf8"));
  if (!Array.isArray(rawPoints) || rawPoints.length === 0) {
    console.error("travel-points.json has no points");
    process.exit(1);
  }

  const points = rawPoints.map((p) =>
    p.id === "home" ? { ...p, address: originAddress } : p,
  );
  const byId = new Map(points.map((p) => [p.id, p]));

  const pairs = {};
  for (const p of points) {
    pairs[`${p.id}|${p.id}`] = { minutes: 0, miles: 0 };
  }

  const nullPairs = [];
  const groups = chunk(points, GROUP_SIZE);
  let requestCount = 0;

  console.log(
    `Computing matrix for ${points.length} points in ${groups.length} groups (${groups.length * groups.length} requests)…`,
  );

  for (let oi = 0; oi < groups.length; oi++) {
    for (let di = 0; di < groups.length; di++) {
      const origins = groups[oi];
      const destinations = groups[di];
      requestCount += 1;
      console.log(
        `Request ${requestCount}: origins ${oi + 1}/${groups.length} (${origins.length}) → destinations ${di + 1}/${groups.length} (${destinations.length})`,
      );

      const elements = await fetchMatrix(apiKey, origins, destinations);
      for (const el of elements) {
        const from = origins[el.originIndex];
        const to = destinations[el.destinationIndex];
        if (!from || !to) continue;
        if (from.id === to.id) continue;

        const key = `${from.id}|${to.id}`;
        const condition = el.condition || "";
        const status = statusMessage(el.status);
        const ok = condition === "ROUTE_EXISTS" && !status;
        if (!ok) {
          pairs[key] = null;
          nullPairs.push({
            from: from.name,
            to: to.name,
            condition: condition || "(empty)",
            status: status || "(none)",
          });
          continue;
        }

        const seconds = parseDurationSeconds(el.duration);
        const meters = el.distanceMeters;
        if (seconds == null || typeof meters !== "number") {
          pairs[key] = null;
          nullPairs.push({
            from: from.name,
            to: to.name,
            condition: condition || "(empty)",
            status: "missing duration/distance",
          });
          continue;
        }

        pairs[key] = {
          minutes: secondsToMinutes(seconds),
          miles: metersToMiles(meters),
        };
      }

      await sleep(REQUEST_GAP_MS);
    }
  }

  const calculatedDate = new Date().toISOString().slice(0, 10);
  const payload = {
    calculatedDate,
    origin: originAddress,
    pairs,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + "\n");

  console.log("\nNull / failed pairs:");
  if (!nullPairs.length) {
    console.log("  (none)");
  } else {
    for (const row of nullPairs) {
      console.log(
        `  ${row.from} → ${row.to}  condition=${row.condition} status=${row.status}`,
      );
    }
  }

  const schoolPoints = points.filter((p) => p.type === "school");
  const homeRows = schoolPoints
    .map((school) => {
      const cell = pairs[`home|${school.id}`];
      return {
        school: school.name,
        minutes: cell?.minutes ?? null,
        miles: cell?.miles ?? null,
      };
    })
    .sort((a, b) => {
      if (a.minutes == null && b.minutes == null) return a.school.localeCompare(b.school);
      if (a.minutes == null) return 1;
      if (b.minutes == null) return -1;
      return a.minutes - b.minutes || a.school.localeCompare(b.school);
    });

  console.log("\nCheck table — drive from home (shortest → longest):\n");
  console.log(
    `${"School".padEnd(72)} ${"Minutes".padStart(8)} ${"Miles".padStart(7)} ${"Display".padStart(16)}`,
  );
  console.log("-".repeat(106));
  for (const row of homeRows) {
    const mins = row.minutes == null ? "null" : String(row.minutes);
    const miles = row.miles == null ? "null" : String(row.miles);
    const display =
      row.minutes == null ? "—" : `${formatDriveMinutes(row.minutes)} (${row.miles} mi)`;
    console.log(
      `${row.school.padEnd(72)} ${mins.padStart(8)} ${miles.padStart(7)} ${display.padStart(16)}`,
    );
  }

  const pairCount = Object.keys(pairs).length;
  const nullCount = Object.values(pairs).filter((v) => v == null).length;
  console.log(`\nWrote ${OUT_PATH}`);
  console.log(
    `Points: ${points.length} · pairs: ${pairCount} · null pairs: ${nullCount} · requests: ${requestCount}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
