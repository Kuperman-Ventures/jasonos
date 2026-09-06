"use client";

import { useEffect, useId, useRef } from "react";
import { SOURCES } from "@/lib/iugr/sources";

export type SourcesDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SourcesDrawer({ open, onOpenChange }: SourcesDrawerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="iugr-sources-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="iugr-sources-backdrop"
        aria-label={SOURCES.closeLabel}
        onClick={() => onOpenChange(false)}
      />
      <div className="iugr-sources-panel">
        <div className="iugr-sources-header">
          <h2 id={titleId} className="iugr-sources-title">
            {SOURCES.title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="iugr-btn iugr-btn-ghost"
            onClick={() => onOpenChange(false)}
          >
            {SOURCES.closeLabel}
          </button>
        </div>

        <p className="iugr-body">{SOURCES.openingNote}</p>

        <ul className="iugr-sources-list">
          {SOURCES.entries.map((entry) => (
            <li key={entry.id} className="iugr-sources-item">
              <h3 className="iugr-sources-name">{entry.name}</h3>
              <p className="iugr-sources-citation">{entry.citation}</p>
              <p className="iugr-sources-note">
                <span className="iugr-claim-why-kicker">Guide note. </span>
                {entry.guideNote}
              </p>
              {entry.href ? (
                <a
                  className="iugr-sources-link"
                  href={entry.href}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {SOURCES.linkLabel}
                </a>
              ) : null}
            </li>
          ))}
        </ul>

        {SOURCES.evidenceNote ? (
          <div className="iugr-sources-evidence-note" role="note">
            {SOURCES.evidenceNoteTitle ? (
              <h3>{SOURCES.evidenceNoteTitle}</h3>
            ) : null}
            <p>{SOURCES.evidenceNote}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
