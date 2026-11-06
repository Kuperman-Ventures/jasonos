/** Client helper: upload one or more album images to a school's family photo library. */

import type { SchoolPhoto } from "@/lib/school-photos";

export type UploadSchoolPhotosResult = {
  uploaded: SchoolPhoto[];
  errors: string[];
};

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
      const body = (await response.json().catch(() => ({}))) as {
        photo?: SchoolPhoto;
        error?: string;
      };
      if (!response.ok || !body.photo) {
        errors.push(body.error || `Could not upload ${file.name}`);
        continue;
      }
      uploaded.push(body.photo);
    } catch {
      errors.push(`Could not upload ${file.name}`);
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
