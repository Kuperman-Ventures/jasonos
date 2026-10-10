import catalogJson from "./resorts.json";
import type {
  SkiPass,
  SkiResort,
  SkiResortCatalog,
  SkiResortSourceLinks,
} from "./types";

const PASSES = new Set<SkiPass>(["epic", "independent"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSourceLinks(value: unknown): SkiResortSourceLinks {
  if (!isRecord(value)) return {};
  return {
    epicPass: optionalString(value.epicPass),
    snowReport: optionalString(value.snowReport),
    webcam: optionalString(value.webcam),
    hotelSearch: optionalString(value.hotelSearch),
  };
}

function parseResort(value: unknown, index: number): SkiResort {
  if (!isRecord(value)) {
    throw new Error(`resorts.json: resort ${index} must be an object`);
  }
  const pass = value.pass;
  if (typeof value.id !== "string" || !value.id) {
    throw new Error(`resorts.json: resort ${index} needs an id`);
  }
  if (typeof value.slug !== "string" || !value.slug) {
    throw new Error(`resorts.json: resort ${index} needs a slug`);
  }
  if (typeof value.name !== "string" || !value.name) {
    throw new Error(`resorts.json: resort ${index} needs a name`);
  }
  if (typeof pass !== "string" || !PASSES.has(pass as SkiPass)) {
    throw new Error(`resorts.json: resort ${index} pass must be epic or independent`);
  }
  return {
    id: value.id,
    slug: value.slug,
    name: value.name,
    pass: pass as SkiPass,
    driveMinutes: optionalNumber(value.driveMinutes),
    overnight: value.overnight === true,
    twoHour: value.twoHour === true,
    christmasOpen: value.christmasOpen === true,
    latitude: optionalNumber(value.latitude),
    longitude: optionalNumber(value.longitude),
    sourceLinks: parseSourceLinks(value.sourceLinks),
  };
}

export function parseResortCatalog(raw: unknown): SkiResortCatalog {
  if (!isRecord(raw)) {
    throw new Error("resorts.json must be an object");
  }
  if (raw.version !== 1) {
    throw new Error("resorts.json version must be 1");
  }
  if (raw.updatedAt !== null && typeof raw.updatedAt !== "string") {
    throw new Error("resorts.json updatedAt must be a string or null");
  }
  if (!Array.isArray(raw.resorts)) {
    throw new Error("resorts.json resorts must be an array");
  }
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    resorts: raw.resorts.map(parseResort),
  };
}

export function loadResortCatalog(): SkiResortCatalog {
  return parseResortCatalog(catalogJson);
}
