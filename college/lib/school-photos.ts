/**
 * School (Wikimedia) photos and virtual tour links for the Photos tab.
 * Images load from the URLs in data/school-photos.json — nothing is mirrored.
 */

import catalog from "@/data/school-photos.json";

export type SchoolPhotoKind = "family" | "school";

/** One photo in the Photos tab roll (family or school). */
export type SchoolPhoto = {
  id: string;
  schoolId: string;
  src: string | null;
  /** Grid / filmstrip image; falls back to src when missing. */
  thumbSrc: string | null;
  caption: string;
  kind: SchoolPhotoKind;
  /** Family only */
  userId?: string;
  visitDate?: string | null;
  starred?: boolean;
  /** School only — attribution required for Wikimedia licenses */
  credit?: string;
  license?: string;
  licenseUrl?: string | null;
  sourceUrl?: string | null;
  category?: string;
};

type CatalogPhoto = {
  caption: string;
  thumbUrl: string;
  fullUrl: string;
  credit: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
};

type CatalogSchool = {
  school: string;
  virtualTourUrl: string | null;
  visitAddress?: string;
  visitDetails?: string;
  photos: CatalogPhoto[];
};

const CATALOG = catalog as CatalogSchool[];

const BY_NAME = new Map(CATALOG.map((entry) => [entry.school, entry]));

export function catalogSchoolNames(): string[] {
  return CATALOG.map((entry) => entry.school);
}

export function catalogEntryForSchool(schoolName: string): CatalogSchool | null {
  return BY_NAME.get(schoolName) ?? null;
}

export function virtualTourUrlForSchool(schoolName: string): string | null {
  return BY_NAME.get(schoolName)?.virtualTourUrl ?? null;
}

/** Admissions / visitor-center address from the photos catalog. */
export function visitAddressForSchool(schoolName: string): string {
  return BY_NAME.get(schoolName)?.visitAddress?.trim() ?? "";
}

export function visitDetailsForSchool(schoolName: string): string {
  return BY_NAME.get(schoolName)?.visitDetails?.trim() ?? "";
}

/** School photos for this school name, in JSON order. Empty when none. */
export function schoolPhotosForSchool(schoolId: string, schoolName: string): SchoolPhoto[] {
  const entry = BY_NAME.get(schoolName);
  if (!entry) return [];
  return entry.photos.map((photo, index) => ({
    id: `${schoolId}-school-${index}`,
    schoolId,
    src: photo.fullUrl,
    thumbSrc: photo.thumbUrl,
    caption: photo.caption,
    kind: "school" as const,
    credit: photo.credit,
    license: photo.license,
    licenseUrl: photo.licenseUrl,
    sourceUrl: photo.sourceUrl,
  }));
}

export function displayThumb(photo: SchoolPhoto): string | null {
  return photo.thumbSrc || photo.src;
}

export function displayFull(photo: SchoolPhoto): string | null {
  return photo.src || photo.thumbSrc;
}

export function formatVisitDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Short school label for section headings (paren nickname or first word). */
export function schoolPhotosHeadingName(name: string): string {
  const paren = name.match(/\(([^)]+)\)/);
  if (paren?.[1]) return paren[1].trim();
  const dash = name.split(/[–—-]/)[0]?.trim();
  if (dash && dash.length < name.length) return dash;
  return name;
}
