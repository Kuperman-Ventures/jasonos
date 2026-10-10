// Ski Tracker domain model.
// Stored catalog starts as resorts.json. Live weather and optional weekend
// summaries will live in jasonos.ski_* tables once ingest is wired.

export type SkiPass = "epic" | "independent";

export type SkiResortSourceLinks = {
  epicPass?: string;
  snowReport?: string;
  webcam?: string;
  hotelSearch?: string;
};

export type SkiResort = {
  id: string;
  slug: string;
  name: string;
  pass: SkiPass;
  driveMinutes: number | null;
  overnight: boolean;
  twoHour: boolean;
  christmasOpen: boolean;
  latitude: number | null;
  longitude: number | null;
  sourceLinks: SkiResortSourceLinks;
};

export type SkiResortCatalog = {
  version: number;
  updatedAt: string | null;
  resorts: SkiResort[];
};

export type SkiTrackerPayload = {
  status: "coming_soon";
  catalogSource: "json" | "database";
  resorts: SkiResort[];
  weatherFetchedAt: string | null;
  analysis: string | null;
};
