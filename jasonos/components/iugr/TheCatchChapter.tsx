"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CATCH_CAVEATS,
  THE_CATCH,
  type CatchCaveat,
  type CatchCaveatId,
} from "@/lib/iugr/theCatch";

export type TheCatchChapterProps = {
  inspectedCaveatIds: readonly CatchCaveatId[];
  onInspectCaveat: (id: CatchCaveatId) => void;
  onContinue: () => void;
  onBack: () => void;
  reducedMotion: boolean;
};

function CaveatMarker({
  caveat,
  inspected,
  active,
  onOpen,
  buttonRef,
}: {
  caveat: CatchCaveat;
  inspected: boolean;
  active: boolean;
  onOpen: () => void;
  buttonRef?: (node: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      ref={buttonRef}
      className={[
        "iugr-caveat-marker",
        inspected ? "is-inspected" : "",
        active ? "is-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={active}
      aria-label={`${caveat.title}. ${inspected ? THE_CATCH.inspectedBadge : THE_CATCH.inspectBadge}.`}
      onClick={onOpen}
    >
      <span className="iugr-caveat-marker-title">{caveat.title}</span>
      <span className="iugr-caveat-marker-status">
        {inspected ? THE_CATCH.inspectedBadge : THE_CATCH.inspectBadge}
      </span>
    </button>
  );
}

function CaveatDetail({
  caveat,
  onClose,
  reducedMotion,
}: {
  caveat: CatchCaveat;
  onClose: () => void;
  reducedMotion: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, [caveat.id]);

  return (
    <article
      className={`iugr-caveat-detail${reducedMotion ? " is-static" : " is-enter"}`}
      aria-labelledby={titleId}
      aria-label={THE_CATCH.detailAria}
    >
      <h2
        id={titleId}
        ref={headingRef}
        className="iugr-caveat-detail-title"
        tabIndex={-1}
      >
        {caveat.title}
      </h2>
      <p className="iugr-body">{caveat.explanation}</p>
      <p className="iugr-caveat-implication" role="note">
        <strong>{THE_CATCH.implicationLabel}. </strong>
        {caveat.implication}
      </p>
      <div className="iugr-actions">
        <button
          type="button"
          className="iugr-btn iugr-btn-primary"
          onClick={onClose}
        >
          {THE_CATCH.mapLabel}
        </button>
      </div>
    </article>
  );
}

export function TheCatchChapter({
  inspectedCaveatIds,
  onInspectCaveat,
  onContinue,
  onBack,
  reducedMotion,
}: TheCatchChapterProps) {
  const [activeId, setActiveId] = useState<CatchCaveatId | null>(null);
  const buttonRefs = useRef<
    Partial<Record<CatchCaveatId, HTMLButtonElement | null>>
  >({});
  const returnFocusId = useRef<CatchCaveatId | null>(null);

  useEffect(() => {
    if (activeId === null && returnFocusId.current) {
      buttonRefs.current[returnFocusId.current]?.focus();
      returnFocusId.current = null;
    }
  }, [activeId]);

  const activeCaveat =
    CATCH_CAVEATS.find((c) => c.id === activeId) ?? null;

  return (
    <section
      className="iugr-panel iugr-the-catch"
      aria-labelledby="iugr-catch-title"
    >
      <div className="iugr-label">{THE_CATCH.chapterLabel}</div>
      <h1 id="iugr-catch-title" className="iugr-headline iugr-headline-sm">
        {THE_CATCH.title}
      </h1>
      <p className="iugr-lead">{THE_CATCH.welcome}</p>
      <p className="iugr-body">{THE_CATCH.bridgeFromScanner}</p>

      {activeCaveat ? (
        <CaveatDetail
          caveat={activeCaveat}
          reducedMotion={reducedMotion}
          onClose={() => {
            returnFocusId.current = activeCaveat.id;
            setActiveId(null);
          }}
        />
      ) : (
        <>
          <p className="iugr-catch-list-title">{THE_CATCH.mapLabel}</p>
          <div
            className="iugr-caveat-map"
            role="group"
            aria-label={THE_CATCH.listAria}
          >
            {CATCH_CAVEATS.map((caveat) => (
              <CaveatMarker
                key={caveat.id}
                caveat={caveat}
                inspected={inspectedCaveatIds.includes(caveat.id)}
                active={false}
                onOpen={() => {
                  onInspectCaveat(caveat.id);
                  setActiveId(caveat.id);
                }}
                buttonRef={(node) => {
                  buttonRefs.current[caveat.id] = node;
                }}
              />
            ))}
          </div>
        </>
      )}

      {!activeCaveat ? (
        <>
          <div
            className="iugr-catch-bottom"
            aria-labelledby="iugr-catch-bottom-title"
          >
            <h2 id="iugr-catch-bottom-title">{THE_CATCH.fieldNoteTitle}</h2>
            <p>{THE_CATCH.fieldNote}</p>
            <p className="iugr-catch-coda">{THE_CATCH.coda}</p>
          </div>

          <div className="iugr-actions iugr-catch-nav">
            <button
              type="button"
              className="iugr-btn iugr-btn-ghost"
              onClick={onBack}
            >
              {THE_CATCH.previousLabel}
            </button>
            <button
              type="button"
              className="iugr-btn iugr-btn-primary"
              onClick={onContinue}
            >
              {THE_CATCH.continueLabel}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
