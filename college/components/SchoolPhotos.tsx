"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { CaretLeft, CaretRight, Star, UploadSimple, X } from "@phosphor-icons/react";
import type { MemberProfile } from "@/lib/member-avatars";
import { memberInitials } from "@/lib/member-avatars";
import {
  displayFull,
  displayThumb,
  formatVisitDate,
  schoolPhotosForSchool,
  schoolPhotosHeadingName,
  virtualTourEmbedUrlForSchool,
  virtualTourUrlForSchool,
  type SchoolPhoto,
} from "@/lib/school-photos";
import type { School } from "@/lib/types";
import { SchoolMark } from "./SchoolMark";

const PH_COLORS = ["var(--ph-1)", "var(--ph-2)", "var(--ph-3)"];
const WHEEL_MS = 280;
const SWIPE_PX = 40;

type RollItem = SchoolPhoto & {
  section: string;
  whoName: string | null;
  whoInitial: string | null;
  whoAvatar: string | null;
};

function profileFor(
  profiles: MemberProfile[],
  userId: string | undefined,
): MemberProfile | null {
  if (!userId) return null;
  return profiles.find((p) => p.id === userId) ?? null;
}

function thumbStyle(photo: SchoolPhoto, index: number, full = false): CSSProperties {
  const url = full ? displayFull(photo) : displayThumb(photo);
  if (url) {
    return {
      backgroundImage: `url(${JSON.stringify(url).slice(1, -1)})`,
      backgroundSize: full ? "contain" : "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  return { backgroundColor: PH_COLORS[index % 3] };
}

function schoolMeta(photo: SchoolPhoto): ReactNode {
  const license = photo.licenseUrl ? (
    <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">
      {photo.license}
    </a>
  ) : (
    photo.license
  );
  return (
    <>
      Photo: {photo.credit} · {license} ·{" "}
      {photo.sourceUrl ? (
        <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">
          View source
        </a>
      ) : null}
    </>
  );
}

export function SchoolPhotos({
  school,
  memberProfiles,
}: {
  school: School;
  memberProfiles: MemberProfile[];
}) {
  const headingName = schoolPhotosHeadingName(school.name);
  const schoolPhotos = schoolPhotosForSchool(school.id, school.name);
  const virtualTourUrl = virtualTourUrlForSchool(school.name);
  const virtualTourEmbedUrl = virtualTourEmbedUrlForSchool(school.name);
  // Family uploads need image storage tagged like Notes — not wired yet.
  const [familyPhotos] = useState<SchoolPhoto[]>([]);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const roll: RollItem[] = [
    ...familyPhotos.map((photo) => {
      const profile = profileFor(memberProfiles, photo.userId);
      const name = profile?.displayName ?? "Family";
      return {
        ...photo,
        section: "Our visit",
        whoName: name,
        whoInitial: memberInitials(name),
        whoAvatar: profile?.avatarUrl ?? null,
      };
    }),
    ...schoolPhotos.map((photo) => ({
      ...photo,
      section: `From ${headingName}`,
      whoName: null as string | null,
      whoInitial: null as string | null,
      whoAvatar: null as string | null,
    })),
  ];

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourLoaded, setTourLoaded] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const tourCloseBtnRef = useRef<HTMLButtonElement>(null);
  const tourOpenerRef = useRef<HTMLButtonElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const lastWheel = useRef(0);
  const touchX = useRef<number | null>(null);
  const titleId = useId();
  const tourTitleId = useId();

  const openViewer = useCallback((index: number, opener: HTMLElement | null) => {
    setTourOpen(false);
    setTourLoaded(false);
    openerRef.current = opener;
    setViewerIndex(index);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerIndex(null);
    queueMicrotask(() => openerRef.current?.focus());
  }, []);

  const openTour = useCallback(() => {
    setViewerIndex(null);
    setTourLoaded(false);
    setTourOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    setTourLoaded(false);
    queueMicrotask(() => tourOpenerRef.current?.focus());
  }, []);

  const step = useCallback(
    (delta: number) => {
      if (roll.length === 0 || viewerIndex == null) return;
      setViewerIndex((cur) => {
        if (cur == null) return cur;
        return (cur + delta + roll.length) % roll.length;
      });
    },
    [roll.length, viewerIndex],
  );

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (tourOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeTour();
      }
      return;
    }
    if (viewerIndex == null) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeViewer();
    }
  });

  useEffect(() => {
    if (viewerIndex == null && !tourOpen) return;
    document.body.style.overflow = "hidden";
    if (tourOpen) {
      tourCloseBtnRef.current?.focus();
    } else {
      closeBtnRef.current?.focus();
    }
    const onKey = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [viewerIndex, tourOpen, onKeyDown]);

  useEffect(() => {
    if (viewerIndex == null || !stripRef.current) return;
    const active = stripRef.current.children[viewerIndex] as HTMLElement | undefined;
    if (!active) return;
    stripRef.current.scrollLeft =
      active.offsetLeft - stripRef.current.clientWidth / 2 + active.clientWidth / 2;
  }, [viewerIndex]);

  const visitDate = familyPhotos[0]?.visitDate
    ? formatVisitDate(familyPhotos[0].visitDate)
    : "";
  const current = viewerIndex != null ? roll[viewerIndex] : null;

  return (
    <section className="school-photos">
      <div className="school-photos-header">
        <div className="school-photos-kicker">
          <span className="school-photos-mark">
            <SchoolMark name={school.name} website={school.website} />
          </span>
          <b>{school.name}</b>
          <span className="school-photos-label">Photos</span>
        </div>
      </div>

      <div className="school-photos-group">
        <div className="school-photos-group-head">
          <h2>
            Our visit
            {visitDate ? <span> · {visitDate}</span> : null}
          </h2>
          <span className="school-photos-count">
            {familyPhotos.length} {familyPhotos.length === 1 ? "photo" : "photos"}
          </span>
        </div>
        <div className="school-photos-ours">
          {familyPhotos.map((photo, index) => {
            const profile = profileFor(memberProfiles, photo.userId);
            const name = profile?.displayName ?? "Family";
            return (
              <figure key={photo.id}>
                <button
                  type="button"
                  className="school-photos-thumb"
                  style={thumbStyle(photo, index + 1)}
                  aria-label={`Open: ${photo.caption}`}
                  onClick={(event) => openViewer(index, event.currentTarget)}
                >
                  <span className="school-photos-who" title={name}>
                    {profile?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatarUrl} alt="" />
                    ) : (
                      memberInitials(name)
                    )}
                  </span>
                  {photo.starred ? (
                    <Star
                      className="school-photos-star"
                      weight="duotone"
                      size={18}
                      aria-label="Starred"
                    />
                  ) : null}
                </button>
                <figcaption>{photo.caption}</figcaption>
              </figure>
            );
          })}
          <button
            type="button"
            className="school-photos-add"
            onClick={() => uploadInputRef.current?.click()}
          >
            <UploadSimple size={24} weight="duotone" aria-hidden="true" />
            Add photos
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={() => {
              /* Upload storage not wired — see Step 1 report. */
              if (uploadInputRef.current) uploadInputRef.current.value = "";
            }}
          />
        </div>
      </div>

      <div className="school-photos-group">
        <div className="school-photos-group-head">
          <h2>From {headingName}</h2>
          <span className="school-photos-count">
            {virtualTourEmbedUrl ? (
              <>
                <button
                  ref={tourOpenerRef}
                  type="button"
                  className="school-photos-tour-btn"
                  onClick={openTour}
                >
                  Virtual tour
                </button>
                {" · "}
              </>
            ) : virtualTourUrl ? (
              <>
                <a href={virtualTourUrl} target="_blank" rel="noopener noreferrer">
                  Virtual tour ↗
                </a>
                {" · "}
              </>
            ) : null}
            {schoolPhotos.length} photos
          </span>
        </div>
        <div className="school-photos-theirs">
          {schoolPhotos.length ? (
            schoolPhotos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                className="school-photos-thumb"
                style={thumbStyle(photo, index)}
                aria-label={`Open: ${photo.caption}`}
                onClick={(event) =>
                  openViewer(familyPhotos.length + index, event.currentTarget)
                }
              />
            ))
          ) : (
            <span className="school-photos-empty">No school photos yet.</span>
          )}
        </div>
        {schoolPhotos.length ? (
          <p className="school-photos-note">
            Photos from Wikimedia Commons. Credits appear when a photo is opened.
          </p>
        ) : null}
      </div>

      {current && viewerIndex != null ? (
        <div
          className="school-photos-viewer"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onWheel={(event) => {
            event.preventDefault();
            const d =
              Math.abs(event.deltaX) > Math.abs(event.deltaY)
                ? event.deltaX
                : event.deltaY;
            if (Math.abs(d) < 8 || Date.now() - lastWheel.current < WHEEL_MS) return;
            lastWheel.current = Date.now();
            step(d > 0 ? 1 : -1);
          }}
          onTouchStart={(event) => {
            touchX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchX.current == null) return;
            const dx = (event.changedTouches[0]?.clientX ?? 0) - touchX.current;
            if (Math.abs(dx) > SWIPE_PX) step(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="school-photos-viewer-top">
            <span className="school-photos-viewer-label" id={titleId}>
              {current.section}
            </span>
            <div className="school-photos-viewer-top-right">
              <span className="school-photos-viewer-pos">
                {viewerIndex + 1} / {roll.length}
              </span>
              <button
                ref={closeBtnRef}
                type="button"
                className="school-photos-vbtn school-photos-vbtn-sq"
                aria-label="Close"
                onClick={closeViewer}
              >
                <X size={20} weight="duotone" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="school-photos-viewer-stage">
            <button
              type="button"
              className="school-photos-vbtn school-photos-vbtn-side"
              aria-label="Previous photo"
              onClick={() => step(-1)}
            >
              <CaretLeft size={20} weight="duotone" aria-hidden="true" />
            </button>
            <div
              className="school-photos-viewer-img"
              role="img"
              aria-label={current.caption}
              style={thumbStyle(current, viewerIndex, true)}
            />
            <button
              type="button"
              className="school-photos-vbtn school-photos-vbtn-side"
              aria-label="Next photo"
              onClick={() => step(1)}
            >
              <CaretRight size={20} weight="duotone" aria-hidden="true" />
            </button>
          </div>

          <div className="school-photos-viewer-cap">
            <div className="school-photos-viewer-cap-main">
              {current.whoName ? (
                <span className="school-photos-who school-photos-who-viewer" title={current.whoName}>
                  {current.whoAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={current.whoAvatar} alt="" />
                  ) : (
                    current.whoInitial
                  )}
                </span>
              ) : null}
              <div>
                <b>{current.caption}</b>
                <small>
                  {current.kind === "family" ? (
                    <>
                      {current.whoName}
                      {current.visitDate
                        ? ` · ${formatVisitDate(current.visitDate)}`
                        : null}
                    </>
                  ) : (
                    schoolMeta(current)
                  )}
                </small>
              </div>
            </div>
            <span className="school-photos-viewer-hint">← → or scroll</span>
          </div>

          <div className="school-photos-viewer-strip" ref={stripRef}>
            {roll.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.caption}
                aria-current={index === viewerIndex ? "true" : undefined}
                style={thumbStyle(item, index)}
                onClick={() => setViewerIndex(index)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {tourOpen && virtualTourEmbedUrl ? (
        <div
          className="school-photos-viewer school-tour-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tourTitleId}
        >
          <div className="school-photos-viewer-top">
            <span className="school-photos-viewer-label" id={tourTitleId}>
              {headingName} virtual tour
            </span>
            <div className="school-photos-viewer-top-right">
              {virtualTourUrl ? (
                <a
                  className="school-tour-modal-external"
                  href={virtualTourUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open on school site ↗
                </a>
              ) : null}
              <button
                ref={tourCloseBtnRef}
                type="button"
                className="school-photos-vbtn school-photos-vbtn-sq"
                aria-label="Close"
                onClick={closeTour}
              >
                <X size={20} weight="duotone" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="school-tour-modal-stage">
            {!tourLoaded ? (
              <p className="school-tour-modal-status">
                Loading tour. If it does not appear, use &quot;Open on school site&quot;.
              </p>
            ) : null}
            <iframe
              className="school-tour-modal-frame"
              src={virtualTourEmbedUrl}
              title={`${school.name} virtual tour`}
              allow="fullscreen; autoplay; gyroscope; accelerometer; xr-spatial-tracking"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setTourLoaded(true)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
