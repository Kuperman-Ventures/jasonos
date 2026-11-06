import assert from "node:assert/strict";
import test from "node:test";
import { formatPhotoUploadError } from "./upload-school-photos";

test("formatPhotoUploadError prefers API reason with file name", () => {
  assert.equal(
    formatPhotoUploadError("IMG_0626.jpeg", {
      status: 400,
      apiError: "Photo must be under 10 MB (this file is 12.3 MB)",
    }),
    "IMG_0626.jpeg: Photo must be under 10 MB (this file is 12.3 MB)",
  );
});

test("formatPhotoUploadError clarifies auth and network failures", () => {
  assert.equal(
    formatPhotoUploadError("visit.png", { status: 401 }),
    "visit.png: Sign in again, then retry the upload",
  );
  assert.equal(
    formatPhotoUploadError("visit.png", { networkError: new TypeError("Failed to fetch") }),
    "visit.png: Network error — check your connection and try again",
  );
});

test("formatPhotoUploadError keeps storage detail from the API", () => {
  assert.equal(
    formatPhotoUploadError("campus.heic", {
      status: 400,
      apiError: "Storage upload failed — mime type image/heic is not supported",
    }),
    "campus.heic: Storage upload failed — mime type image/heic is not supported",
  );
});
