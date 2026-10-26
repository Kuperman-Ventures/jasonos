import "server-only";

import {
  CONTACT_PHOTO_BUCKET,
  CONTACT_PHOTO_MAX_BYTES,
  contactPhotoObjectPath,
  imageTypeFromBytes,
  isFetchablePhotoUrl,
  publicContactPhotoUrl,
  remotePhotoFailureIsExpired,
} from "@/lib/outreach/contact-photo-cache";

export type StoredContactPhoto =
  | { ok: true; photoUrl: string; storagePath: string }
  | { ok: false; expired: boolean; error: string };

type PhotoBucket = {
  upload: (
    path: string,
    body: Buffer,
    options: { contentType: string; upsert: boolean; cacheControl: string }
  ) => Promise<{ error: { message: string } | null }>;
  remove: (paths: string[]) => Promise<{ error: { message: string } | null }>;
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
};

export type ContactPhotoStorage = {
  storage: {
    from: (bucket: string) => PhotoBucket;
  };
};

/**
 * Download a remote profile picture and save it in the contact-photos bucket.
 * Returns the stable public address to store on the contact.
 */
export async function saveRemoteContactPhoto(opts: {
  storage: ContactPhotoStorage;
  supabaseUrl: string;
  contactId: string;
  remoteUrl: string;
  previousPath?: string | null;
  version: string;
}): Promise<StoredContactPhoto> {
  const downloaded = await downloadRemoteContactPhoto(opts.remoteUrl);
  if (!downloaded.ok) return downloaded;

  const objectPath = contactPhotoObjectPath(opts.contactId, downloaded.ext);
  if (!objectPath) {
    return { ok: false, expired: false, error: "Contact id is not valid." };
  }

  const bucket = opts.storage.storage.from(CONTACT_PHOTO_BUCKET);
  const { error } = await bucket.upload(objectPath, Buffer.from(downloaded.bytes), {
    contentType: downloaded.mime,
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) {
    return { ok: false, expired: false, error: error.message };
  }

  const previous = opts.previousPath?.trim();
  if (previous && previous !== objectPath) {
    await bucket.remove([previous]);
  }

  const published = bucket.getPublicUrl(objectPath).data.publicUrl;
  const photoUrl = withVersion(
    published || publicContactPhotoUrl(opts.supabaseUrl, objectPath, opts.version),
    opts.version
  );
  return { ok: true, photoUrl, storagePath: objectPath };
}

export async function removeStoredContactPhoto(
  storage: ContactPhotoStorage,
  objectPath: string | null | undefined
): Promise<void> {
  const path = objectPath?.trim();
  if (!path) return;
  await storage.storage.from(CONTACT_PHOTO_BUCKET).remove([path]);
}

async function downloadRemoteContactPhoto(
  remoteUrl: string
): Promise<
  | { ok: true; bytes: Uint8Array; ext: string; mime: string }
  | { ok: false; expired: boolean; error: string }
> {
  if (!isFetchablePhotoUrl(remoteUrl)) {
    return { ok: false, expired: true, error: "Photo link is not a public https image." };
  }

  let response: Response;
  try {
    response = await fetch(remoteUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
    });
  } catch (err) {
    return {
      ok: false,
      expired: false,
      error: err instanceof Error ? err.message : "Photo download failed.",
    };
  }

  if (!isFetchablePhotoUrl(response.url)) {
    return { ok: false, expired: true, error: "Photo link redirected to a blocked host." };
  }
  if (!response.ok) {
    return {
      ok: false,
      expired: remotePhotoFailureIsExpired(response.status),
      error: `Photo link returned ${response.status}.`,
    };
  }

  const advertised = Number(response.headers.get("content-length"));
  if (Number.isFinite(advertised) && advertised > CONTACT_PHOTO_MAX_BYTES) {
    return { ok: false, expired: false, error: "Photo is too large to save." };
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > CONTACT_PHOTO_MAX_BYTES) {
    return { ok: false, expired: false, error: "Photo is too large to save." };
  }
  const kind = imageTypeFromBytes(bytes);
  if (!kind) {
    return { ok: false, expired: true, error: "Photo link did not return an image." };
  }
  return { ok: true, bytes, ext: kind.ext, mime: kind.mime };
}

function withVersion(url: string, version: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("v", version);
    return parsed.toString();
  } catch {
    return publicContactPhotoUrl("https://invalid.local", "unused.jpg", version);
  }
}
