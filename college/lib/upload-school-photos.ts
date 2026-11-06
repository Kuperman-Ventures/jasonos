/** Client helper: upload one or more album images to a school's family photo library. */

import type { SchoolPhoto } from "@/lib/school-photos";

export type UploadSchoolPhotosResult = {
  uploaded: SchoolPhoto[];
  errors: string[];
};

/** Turn API / network failures into a short, actionable line for the status bar. */
export function formatPhotoUploadError(
  fileName: string,
  detail: {
    status?: number;
    statusText?: string;
    apiError?: string;
    networkError?: unknown;
  },
): string {
  const name = fileName.trim() || "photo";
  const api = detail.apiError?.trim();
  if (api) return `${name}: ${clarifyUploadApiError(api, detail.status)}`;

  if (detail.networkError instanceof TypeError) {
    return `${name}: Network error — check your connection and try again`;
  }
  if (detail.networkError instanceof Error && detail.networkError.message.trim()) {
    return `${name}: ${detail.networkError.message.trim()}`;
  }

  const status = detail.status;
  if (status === 401) return `${name}: Sign in again, then retry the upload`;
  if (status === 403) return `${name}: You do not have permission to upload photos`;
  if (status === 404) return `${name}: School not found`;
  if (status === 413) return `${name}: File is too large for the server (max 10 MB)`;
  if (status === 503) return `${name}: Photo storage is not configured`;
  if (status && status >= 500) {
    return `${name}: Server error (${status}) — try again in a moment`;
  }
  if (status) {
    const hint = detail.statusText?.trim() || `HTTP ${status}`;
    return `${name}: Upload failed (${hint})`;
  }
  return `${name}: Upload failed — try again`;
}

function clarifyUploadApiError(message: string, status?: number): string {
  const lower = message.toLowerCase();
  if (lower.includes("sign in")) return "Sign in again, then retry the upload";
  if (lower.includes("not configured") || lower.includes("needs supabase")) {
    return "Photo storage is not configured";
  }
  if (lower.includes("bucket") && lower.includes("not found")) {
    return "Photo storage bucket is missing";
  }
  if (lower.includes("row-level security") || lower.includes("rls")) {
    return "Could not save photo (database permission denied)";
  }
  if (status === 413 && !lower.includes("10 mb") && !lower.includes("too large")) {
    return "File is too large for the server (max 10 MB)";
  }
  return message;
}

export async function uploadSchoolPhotos(
  schoolId: string,
  files: FileList | File[],
): Promise<UploadSchoolPhotosResult> {
  const list = Array.from(files);
  const uploaded: SchoolPhoto[] = [];
  const errors: string[] = [];

  for (const file of list) {
    const form = new FormData();
    form.set("file", file);
    form.set("caption", file.name.replace(/\.[^.]+$/, "") || "Family photo");
    try {
      const response = await fetch(`/api/schools/${encodeURIComponent(schoolId)}/photos`, {
        method: "POST",
        body: form,
      });
      const raw = await response.text();
      let body: { photo?: SchoolPhoto; error?: string } = {};
      if (raw.trim()) {
        try {
          body = JSON.parse(raw) as { photo?: SchoolPhoto; error?: string };
        } catch {
          errors.push(
            formatPhotoUploadError(file.name, {
              status: response.status,
              statusText: response.statusText,
              apiError: `Server returned a non-JSON response (${response.status || "unknown"})`,
            }),
          );
          continue;
        }
      }
      if (!response.ok || !body.photo) {
        errors.push(
          formatPhotoUploadError(file.name, {
            status: response.status,
            statusText: response.statusText,
            apiError: body.error,
          }),
        );
        continue;
      }
      uploaded.push(body.photo);
    } catch (error) {
      errors.push(formatPhotoUploadError(file.name, { networkError: error }));
    }
  }

  return { uploaded, errors };
}

export async function fetchFamilyPhotos(schoolId: string): Promise<SchoolPhoto[]> {
  const response = await fetch(`/api/schools/${encodeURIComponent(schoolId)}/photos`);
  if (!response.ok) return [];
  const body = (await response.json().catch(() => ({}))) as { items?: SchoolPhoto[] };
  return Array.isArray(body.items) ? body.items : [];
}

export async function deleteSchoolPhoto(
  schoolId: string,
  photoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(
    `/api/schools/${encodeURIComponent(schoolId)}/photos/${encodeURIComponent(photoId)}`,
    { method: "DELETE" },
  );
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    return { ok: false, error: body.error || "Could not delete photo" };
  }
  return { ok: true };
}
