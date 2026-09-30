// Pure LeadDelta payload helpers. No network / no server-only so unit tests
// can import these without Next's server boundary.

export type LeadDeltaConnection = {
  id?: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  headline?: string | null;
  company?: string | null;
  linkedinUrl?: string | null;
  photoUrl?: string | null;
  emails?: string[];
  raw?: unknown;
};

/**
 * Walk a LeadDelta / MCP payload for a usable https image URL.
 * Field names vary across LeadDelta exports and MCP tool payloads.
 */
export function extractLeadDeltaPhotoUrl(payload: unknown): string | null {
  const urls: string[] = [];
  walk(payload, (key, value) => {
    if (typeof value !== "string") return;
    const k = key.toLowerCase();
    if (
      !(
        k.includes("photo") ||
        k.includes("avatar") ||
        k.includes("picture") ||
        k.includes("image") ||
        k === "img" ||
        k.endsWith("imgurl")
      )
    ) {
      return;
    }
    const url = value.trim();
    if (/^https?:\/\//i.test(url) && !/\.(svg)(\?|$)/i.test(url)) {
      urls.push(url);
    }
  });
  return urls[0] ?? null;
}

export function normalizeLeadDeltaConnection(
  payload: unknown
): LeadDeltaConnection | null {
  if (!payload || typeof payload !== "object") return null;
  const root = unwrapRecord(payload);
  if (!root) return null;

  const firstName = str(root, [
    "firstName",
    "first_name",
    "givenName",
    "given_name",
  ]);
  const lastName = str(root, [
    "lastName",
    "last_name",
    "familyName",
    "family_name",
  ]);
  const fullName =
    str(root, ["fullName", "full_name", "name", "displayName", "display_name"]) ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    null;
  const linkedinUrl = str(root, [
    "linkedinUrl",
    "linkedin_url",
    "profileUrl",
    "profile_url",
    "url",
    "linkedin",
  ]);
  const headline = str(root, ["headline", "title", "jobTitle", "job_title"]);
  const company = str(root, [
    "company",
    "companyName",
    "company_name",
    "organization",
    "org",
  ]);
  const photoUrl = extractLeadDeltaPhotoUrl(root);
  const emails = collectEmails(root);
  const id = str(root, ["id", "connectionId", "connection_id", "_id"]);

  if (!fullName && !linkedinUrl && !photoUrl) return null;
  return {
    id: id ?? undefined,
    fullName,
    firstName,
    lastName,
    headline,
    company,
    linkedinUrl,
    photoUrl,
    emails,
    raw: root,
  };
}

export function normalizeLinkedInUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, "")}`;
    const url = new URL(withProto);
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
    const match = url.pathname.match(/\/in\/([^/?#]+)/i);
    if (!match?.[1]) return null;
    const slug = decodeURIComponent(match[1]).replace(/\/$/, "");
    if (!slug) return null;
    return `https://www.linkedin.com/in/${slug}`;
  } catch {
    return null;
  }
}

export function firstConnectionFromMcp(data: unknown): LeadDeltaConnection | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const normalized = normalizeLeadDeltaConnection(item);
      if (normalized) return normalized;
    }
    return null;
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of [
      "connection",
      "contact",
      "profile",
      "data",
      "result",
      "connections",
      "items",
      "results",
    ]) {
      const value = record[key];
      if (Array.isArray(value)) {
        const hit = firstConnectionFromMcp(value);
        if (hit) return hit;
      } else {
        const hit = normalizeLeadDeltaConnection(value);
        if (hit) return hit;
      }
    }
  }
  return normalizeLeadDeltaConnection(data);
}

function unwrapRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload)) {
    const first = payload.find((item) => item && typeof item === "object");
    return first && !Array.isArray(first)
      ? (first as Record<string, unknown>)
      : null;
  }
  return payload as Record<string, unknown>;
}

function str(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function collectEmails(record: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const push = (value: unknown) => {
    if (typeof value === "string" && value.includes("@")) {
      out.add(value.trim().toLowerCase());
    }
  };
  push(record.email);
  push(record.workEmail);
  push(record.work_email);
  push(record.personalEmail);
  push(record.personal_email);
  for (const key of ["emails", "emailAddresses", "email_addresses"]) {
    const value = record[key];
    if (Array.isArray(value)) value.forEach(push);
  }
  return [...out];
}

function walk(
  value: unknown,
  visit: (key: string, value: unknown) => void,
  key = ""
): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit, key);
    return;
  }
  if (!value || typeof value !== "object") {
    if (key) visit(key, value);
    return;
  }
  for (const [childKey, child] of Object.entries(
    value as Record<string, unknown>
  )) {
    walk(child, visit, childKey);
  }
}
