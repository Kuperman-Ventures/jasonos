"use client";

import { useEffect, useRef, useState } from "react";
import { CaretLeft, Trash, UploadSimple } from "@phosphor-icons/react";
import { SchoolMark } from "./SchoolMark";
import { SafetyBadge } from "./SafetyBadge";
import {
  interestLabel,
  statusLabel,
  tierLabel,
  type School,
} from "@/lib/types";
import { websiteHref, websiteHostLabel } from "@/lib/school-photo";
import {
  formatTravelLabel,
} from "@/lib/drive-matrix";
import {
  displayThumb,
  schoolPhotosForSchool,
  type SchoolPhoto,
} from "@/lib/school-photos";
import { formatUndergrads } from "@/lib/campus-size";
import {
  deleteSchoolPhoto,
  fetchFamilyPhotos,
  uploadSchoolPhotos,
} from "@/lib/upload-school-photos";

export function MobileSchoolSnapshot({
  school,
  canDeletePhotos = false,
  onBack,
}: {
  school: School;
  canDeletePhotos?: boolean;
  onBack: () => void;
}) {
  const [familyPhotos, setFamilyPhotos] = useState<SchoolPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const schoolPhotos = schoolPhotosForSchool(school.id, school.name);
  const siteHref = websiteHref(school.website);
  const travel = formatTravelLabel(
    school.driveMinutes,
    school.driveMiles,
    school.travelMode,
  );
  const selectivity = tierLabel(school.selectivityTier) || "Not set";
  const interest = interestLabel(school.interestLevel) || "Not set";
  const appStatus = school.applicationStatus
    ? statusLabel(school.applicationStatus)
    : "Not started";
  const undergrads =
    school.undergradEnrollment != null && Number.isFinite(school.undergradEnrollment)
      ? formatUndergrads(school.undergradEnrollment)
      : "";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const items = await fetchFamilyPhotos(school.id);
      if (!cancelled) setFamilyPhotos(items);
    })();
    return () => {
      cancelled = true;
    };
  }, [school.id]);

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setStatus(`Uploading ${files.length} photo${files.length === 1 ? "" : "s"}…`);
    const result = await uploadSchoolPhotos(school.id, files);
    if (result.uploaded.length) {
      setFamilyPhotos((prev) => [...result.uploaded, ...prev]);
    }
    if (result.errors.length) {
      setStatus(result.errors[0] ?? "Some photos failed");
    } else {
      setStatus(
        result.uploaded.length === 1
          ? "Photo added for the family"
          : `${result.uploaded.length} photos added for the family`,
      );
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    window.setTimeout(() => setStatus(""), 3200);
  }

  async function onDeletePhoto(photoId: string) {
    if (!canDeletePhotos || deleteBusyId) return;
    if (!window.confirm("Delete this photo for the whole family?")) return;
    setDeleteBusyId(photoId);
    const result = await deleteSchoolPhoto(school.id, photoId);
    if (!result.ok) {
      setStatus(result.error || "Could not delete photo");
    } else {
      setFamilyPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
      setStatus("Photo deleted");
    }
    setDeleteBusyId(null);
    window.setTimeout(() => setStatus(""), 2800);
  }

  return (
    <section className="mobile-snap" data-viewport="mobile" aria-label={`${school.name} snapshot`}>
      <header className="mobile-snap-bar">
        <button type="button" className="mobile-snap-back" onClick={onBack}>
          <CaretLeft size={20} weight="bold" aria-hidden="true" />
          List
        </button>
        <button
          type="button"
          className="mobile-snap-upload"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <UploadSimple size={18} weight="bold" aria-hidden="true" />
          {busy ? "Uploading…" : "Upload photos"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => void onPickFiles(event.target.files)}
        />
      </header>

      {status ? (
        <p className="mobile-snap-status" role="status">
          {status}
        </p>
      ) : null}

      <div className="mobile-snap-hero">
        <SchoolMark name={school.name} website={school.website} />
        <div>
          <h1>
            {school.name}
            <SafetyBadge school={school} />
          </h1>
          <p>{school.location.trim() || "Location not set"}</p>
        </div>
      </div>

      <dl className="mobile-snap-facts">
        <div>
          <dt>Interest</dt>
          <dd data-level={school.interestLevel || undefined}>{interest}</dd>
        </div>
        <div>
          <dt>Selectivity</dt>
          <dd>{selectivity}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{appStatus}</dd>
        </div>
        {travel !== "—" ? (
          <div>
            <dt>Travel</dt>
            <dd>{travel}</dd>
          </div>
        ) : null}
        {undergrads ? (
          <div>
            <dt>Undergrads</dt>
            <dd>{undergrads}</dd>
          </div>
        ) : null}
        {school.campusSetting.trim() ? (
          <div>
            <dt>Setting</dt>
            <dd>{school.campusSetting.trim()}</dd>
          </div>
        ) : null}
        {school.testPolicy.trim() || school.familyTestPolicy.trim() ? (
          <div>
            <dt>Test policy</dt>
            <dd>{school.testPolicy.trim() || school.familyTestPolicy.trim()}</dd>
          </div>
        ) : null}
      </dl>

      {familyPhotos.length ? (
        <section className="mobile-snap-photos" aria-label="Family photos">
          <h2>Our photos · {familyPhotos.length}</h2>
          <div className="mobile-snap-strip">
            {familyPhotos.map((photo) => {
              const url = displayThumb(photo);
              return (
                <div key={photo.id} className="mobile-snap-thumb-wrap">
                  <a
                    className="mobile-snap-thumb"
                    href={photo.src ?? url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    style={
                      url
                        ? {
                            backgroundImage: `url(${JSON.stringify(url).slice(1, -1)})`,
                          }
                        : undefined
                    }
                    aria-label={photo.caption}
                  />
                  {canDeletePhotos ? (
                    <button
                      type="button"
                      className="mobile-snap-delete"
                      aria-label={`Delete ${photo.caption}`}
                      disabled={deleteBusyId === photo.id}
                      onClick={() => void onDeletePhoto(photo.id)}
                    >
                      <Trash size={14} weight="bold" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="mobile-snap-empty">
          No family photos yet. Upload from your album — everyone in the household will see them.
        </p>
      )}

      {schoolPhotos.length ? (
        <section className="mobile-snap-photos" aria-label="School photos">
          <h2>From the school · {schoolPhotos.length}</h2>
          <div className="mobile-snap-strip">
            {schoolPhotos.slice(0, 8).map((photo) => {
              const url = displayThumb(photo);
              return (
                <a
                  key={photo.id}
                  className="mobile-snap-thumb"
                  href={photo.src ?? url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  style={
                    url
                      ? {
                          backgroundImage: `url(${JSON.stringify(url).slice(1, -1)})`,
                        }
                      : undefined
                  }
                  aria-label={photo.caption}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {siteHref ? (
        <a className="mobile-snap-site" href={siteHref} target="_blank" rel="noreferrer">
          Open {websiteHostLabel(school.website) || "school site"} ↗
        </a>
      ) : null}
    </section>
  );
}
