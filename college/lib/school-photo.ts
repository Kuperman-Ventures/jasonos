/** Campus / school hero photos. Prefer Wikipedia thumbnails; fall back to none. */

const TITLE_OVERRIDES: Record<string, string> = {
  mit: "Massachusetts Institute of Technology",
  cmu: "Carnegie Mellon University",
  upenn: "University of Pennsylvania",
  uiuc: "University of Illinois Urbana-Champaign",
  ucla: "University of California, Los Angeles",
  uva: "University of Virginia",
  uconn: "University of Connecticut",
  rpi: "Rensselaer Polytechnic Institute",
  wpi: "Worcester Polytechnic Institute",
  njit: "New Jersey Institute of Technology",
  "georgia-tech": "Georgia Institute of Technology",
  "ut-austin": "University of Texas at Austin",
  "penn-state": "Pennsylvania State University",
  "nc-state": "North Carolina State University",
  "texas-a-and-m-university": "Texas A&M University",
  "uc-berkeley": "University of California, Berkeley",
  "uc-davis": "University of California, Davis",
  "uc-irvine": "University of California, Irvine",
};

export function wikipediaTitleForSchool(id: string, name: string): string {
  return TITLE_OVERRIDES[id] ?? name.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

export function websiteHref(website: string): string {
  const trimmed = website.trim();
  if (!trimmed) return "";
  return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
}

export function websiteHostLabel(website: string): string {
  const href = websiteHref(website);
  if (!href) return "";
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return trimmedHostFallback(website);
  }
}

function trimmedHostFallback(website: string): string {
  return website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

type WikiSummary = {
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
};

/** Fetch a campus/building thumbnail from Wikipedia (CORS-friendly REST API). */
export async function fetchSchoolPhotoUrl(id: string, name: string): Promise<string | null> {
  const title = wikipediaTitleForSchool(id, name);
  if (!title) return null;
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as WikiSummary;
    return body.originalimage?.source || body.thumbnail?.source || null;
  } catch {
    return null;
  }
}
