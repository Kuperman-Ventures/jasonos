// Pure helpers for contact profile photos. Safe to import from the browser.
// The actual download and Storage upload live in contact-photo-store.ts.

export const CONTACT_PHOTO_BUCKET = "contact-photos";
export const CONTACT_PHOTO_MAX_BYTES = 1_500_000;
const UNREADABLE_BACKOFF_MS = 12 * 60 * 60 * 1000;

const IMAGE_TYPES = [
  { ext: "jpg", mime: "image/jpeg" },
  { ext: "png", mime: "image/png" },
  { ext: "webp", mime: "image/webp" },
  { ext: "gif", mime: "image/gif" },
] as const;

export type ContactImageType = (typeof IMAGE_TYPES)[number];

export type PhotoSaveAction = "keep" | "cache-remote" | "fetch-source";

export function imageTypeFromBytes(bytes: Uint8Array): ContactImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return IMAGE_TYPES[0];
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return IMAGE_TYPES[1];
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return IMAGE_TYPES[2];
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return IMAGE_TYPES[3];
  }
  return null;
}

export function contactPhotoObjectPath(
  contactId: string,
  ext: string
): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactId)) {
    return null;
  }
  if (!IMAGE_TYPES.some((type) => type.ext === ext)) return null;
  return `${contactId.toLowerCase()}.${ext}`;
}

/** True when the address already points at the saved JasonOS copy. */
export function isStoredContactPhotoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.pathname.includes(
      `/storage/v1/object/public/${CONTACT_PHOTO_BUCKET}/`
    );
  } catch {
    return false;
  }
}

export function isFetchablePhotoUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return false;
  }
  if (host === "metadata.google.internal") return false;
  // Raw IP addresses are how a bad photo link could reach the private network.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host.includes(":")) return false;
  return true;
}

export function remotePhotoFailureIsExpired(status: number): boolean {
  return status === 401 || status === 403 || status === 404 || status === 410;
}

export function publicContactPhotoUrl(
  supabaseUrl: string,
  objectPath: string,
  version: string
): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${CONTACT_PHOTO_BUCKET}/${objectPath}?v=${encodeURIComponent(version)}`;
}

/**
 * Decide what to do with the photo already on the contact.
 * A saved copy is reused. A remote link is downloaded once. A link that
 * already failed waits 12 hours before another try.
 */
export function photoSaveAction(input: {
  force?: boolean;
  photoUrl: string | null;
  photoSource: string | null;
  photoUpdatedAt?: string | null;
  now?: number;
}): PhotoSaveAction {
  const url = input.photoUrl?.trim() || null;
  const stored = input.photoSource === "stored" || isStoredContactPhotoUrl(url);
  if (!input.force && stored && url) return "keep";
  if (!input.force && url && !stored) {
    if (input.photoSource === "leaddelta-unreadable") {
      const updatedAt = Date.parse(input.photoUpdatedAt ?? "");
      const now = input.now ?? Date.now();
      if (Number.isFinite(updatedAt) && now - updatedAt < UNREADABLE_BACKOFF_MS) {
        return "keep";
      }
    }
    return "cache-remote";
  }
  return "fetch-source";
}
