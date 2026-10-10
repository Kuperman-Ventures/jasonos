import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { loadResortCatalog } from "./catalog";
import type { SkiPass, SkiResort, SkiTrackerPayload } from "./types";

function hasConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function isPass(value: unknown): value is SkiPass {
  return value === "epic" || value === "independent";
}

function rowToResort(row: Record<string, unknown>): SkiResort | null {
  if (typeof row.id !== "string" || typeof row.slug !== "string" || typeof row.name !== "string") {
    return null;
  }
  if (!isPass(row.pass)) return null;
  const links = row.source_links;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    pass: row.pass,
    driveMinutes: typeof row.drive_minutes === "number" ? row.drive_minutes : null,
    overnight: row.overnight === true,
    twoHour: row.two_hour === true,
    christmasOpen: row.christmas_open === true,
    latitude: typeof row.latitude === "number" ? row.latitude : null,
    longitude: typeof row.longitude === "number" ? row.longitude : null,
    sourceLinks:
      links && typeof links === "object" && !Array.isArray(links)
        ? {
            epicPass:
              typeof (links as { epicPass?: unknown }).epicPass === "string"
                ? (links as { epicPass: string }).epicPass
                : undefined,
            snowReport:
              typeof (links as { snowReport?: unknown }).snowReport === "string"
                ? (links as { snowReport: string }).snowReport
                : undefined,
            webcam:
              typeof (links as { webcam?: unknown }).webcam === "string"
                ? (links as { webcam: string }).webcam
                : undefined,
            hotelSearch:
              typeof (links as { hotelSearch?: unknown }).hotelSearch === "string"
                ? (links as { hotelSearch: string }).hotelSearch
                : undefined,
          }
        : {},
  };
}

async function loadDatabaseResorts(): Promise<SkiResort[] | null> {
  if (!hasConfig()) return null;
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("ski_resorts")
      .select(
        "id,slug,name,pass,drive_minutes,overnight,two_hour,christmas_open,latitude,longitude,source_links"
      )
      .order("name", { ascending: true });
    if (error || !data) return null;
    return data
      .map((row) => rowToResort(row as Record<string, unknown>))
      .filter((row): row is SkiResort => row !== null);
  } catch (error) {
    console.error("[ski-tracker] ski_resorts query failed", error);
    return null;
  }
}

export async function getSkiTrackerStatus(): Promise<SkiTrackerPayload> {
  const dbResorts = await loadDatabaseResorts();
  const catalog = loadResortCatalog();
  const resorts = dbResorts && dbResorts.length > 0 ? dbResorts : catalog.resorts;

  return {
    status: "coming_soon",
    catalogSource: dbResorts && dbResorts.length > 0 ? "database" : "json",
    resorts,
    weatherFetchedAt: null,
    analysis: null,
  };
}
