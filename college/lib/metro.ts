/**
 * Census metro / micro area lookup from campus coordinates.
 */

import metroPopulations from "@/data/metro-populations.json";
import { timeSourceCall } from "./data-source-checks";

export type MetroLookup = {
  metroArea: string | null;
  metroPopulation: number | null;
};

export type MetroPopulationEntry = {
  name: string;
  type: string;
  population: number;
};

const GEOCODER_URL =
  "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";

type CensusGeography = {
  GEOID?: string;
  NAME?: string;
};

type CensusGeocoderResponse = {
  result?: {
    geographies?: Record<string, CensusGeography[]>;
  };
};

const metroTable = metroPopulations as Record<string, MetroPopulationEntry>;

function emptyMetro(): MetroLookup {
  return { metroArea: null, metroPopulation: null };
}

function fromGeoid(geoid: string | undefined): MetroLookup {
  if (!geoid) return emptyMetro();
  const entry = metroTable[geoid];
  if (!entry) return emptyMetro();
  return {
    metroArea: entry.name,
    metroPopulation: entry.population,
  };
}

/**
 * Resolve metro area name + 2025 population for a campus lat/lon.
 * Callers should clear both fields when campusSetting is College town or Small town.
 */
export async function lookupMetro(lat: number, lon: number): Promise<MetroLookup> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return emptyMetro();

  const url = new URL(GEOCODER_URL);
  url.searchParams.set("x", String(lon));
  url.searchParams.set("y", String(lat));
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set(
    "layers",
    "Metropolitan Statistical Areas,Micropolitan Statistical Areas",
  );
  url.searchParams.set("format", "json");

  const body = await timeSourceCall("census-geocoder", async () => {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      throw new Error(`Census geocoder returned ${response.status}`);
    }
    return (await response.json()) as CensusGeocoderResponse;
  });
  const geos = body.result?.geographies ?? {};
  const metro = geos["Metropolitan Statistical Areas"]?.[0];
  if (metro?.GEOID) return fromGeoid(metro.GEOID);
  const micro = geos["Micropolitan Statistical Areas"]?.[0];
  if (micro?.GEOID) return fromGeoid(micro.GEOID);
  return emptyMetro();
}

/** Look up a known CBSA code in the committed population table (no network). */
export function metroFromCbsa(cbsa: string): MetroLookup {
  return fromGeoid(cbsa.trim());
}
