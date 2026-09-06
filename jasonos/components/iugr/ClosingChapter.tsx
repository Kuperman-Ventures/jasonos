"use client";

import { useId, useState } from "react";
import { CLOSING } from "@/lib/iugr/sources";

export type ClosingChapterProps = {
  onExploreCopyMachine: () => void;
  onOpenSources: () => void;
  onBack: () => void;
};

async function shareOrCopy(): Promise<"shared" | "copied" | "failed"> {
  const url = typeof window !== "undefined" ? window.location.href : "";
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({
        title: CLOSING.shareTitle,
        text: CLOSING.shareText,
        url,
      });
      return "shared";
    }
  } catch {
    // Fall through to clipboard; share cancel should not look like success.
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
  } catch {
    return "failed";
  }
  return "failed";
}

export function ClosingChapter({
  onExploreCopyMachine,
  onOpenSources,
  onBack,
}: ClosingChapterProps) {
  const titleId = useId();
  const [shareNote, setShareNote] = useState<string | null>(null);

  return (
    <section
      className="iugr-panel iugr-closing"
      aria-labelledby={titleId}
    >
      <div className="iugr-label">{CLOSING.chapterLabel}</div>
      <h1 id={titleId} className="iugr-headline iugr-headline-sm">
        {CLOSING.title}
      </h1>

      {CLOSING.body.map((paragraph) => (
        <p key={paragraph} className="iugr-body">
          {paragraph}
        </p>
      ))}

      <p className="iugr-closing-guide" role="note">
        {CLOSING.guideLine}
      </p>

      <div className="iugr-closing-actions">
        <button
          type="button"
          className="iugr-btn iugr-btn-primary"
          onClick={onExploreCopyMachine}
        >
          {CLOSING.exploreCopyLabel}
        </button>
        <button
          type="button"
          className="iugr-btn iugr-btn-ghost"
          onClick={onOpenSources}
        >
          {CLOSING.openSourcesLabel}
        </button>
        <button
          type="button"
          className="iugr-btn iugr-btn-ghost"
          onClick={async () => {
            const result = await shareOrCopy();
            if (result === "copied") setShareNote(CLOSING.shareCopied);
            else if (result === "failed") setShareNote(CLOSING.shareFailed);
            else setShareNote(null);
          }}
        >
          {CLOSING.shareLabel}
        </button>
      </div>

      {shareNote ? (
        <p className="iugr-closing-share-note" aria-live="polite">
          {shareNote}
        </p>
      ) : null}

      <div className="iugr-actions">
        <button
          type="button"
          className="iugr-btn iugr-btn-ghost"
          onClick={onBack}
        >
          {CLOSING.previousLabel}
        </button>
      </div>
    </section>
  );
}
