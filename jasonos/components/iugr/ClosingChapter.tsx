"use client";

import { useId, useState } from "react";
import { CLOSING } from "@/lib/iugr/sources";
import { CLOSING_SCRIPT } from "@/lib/iugr/script";

export type ClosingChapterProps = {
  onExploreCopyMachine: () => void;
  onOpenSources: () => void;
  onBack: () => void;
};

/** Copy only the general entry URL — never reader-specific state. */
async function copyEntryUrl(): Promise<"copied" | "failed"> {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/iugr`
      : "https://jasonos.vercel.app/iugr";
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
      data-wash="coral"
      aria-labelledby={titleId}
    >
      <div className="iugr-label">{CLOSING.chapterLabel}</div>
      <h1 id={titleId} className="iugr-headline iugr-headline-sm">
        Closing
      </h1>

      <p className="iugr-body">{CLOSING_SCRIPT.lead}</p>
      <p className="iugr-body">{CLOSING_SCRIPT.keepIntro}</p>
      {CLOSING_SCRIPT.keepLines.map((paragraph) => (
        <p key={paragraph} className="iugr-body">
          {paragraph}
        </p>
      ))}

      <div className="iugr-closing-actions">
        <button
          type="button"
          className="iugr-btn iugr-btn-primary"
          onClick={onExploreCopyMachine}
        >
          {CLOSING_SCRIPT.actions.runAgain}
        </button>
        <button
          type="button"
          className="iugr-btn iugr-btn-ghost"
          onClick={onOpenSources}
        >
          {CLOSING_SCRIPT.actions.sources}
        </button>
        <button
          type="button"
          className="iugr-btn iugr-btn-ghost"
          onClick={async () => {
            const result = await copyEntryUrl();
            if (result === "copied") setShareNote(CLOSING.shareCopied);
            else setShareNote(CLOSING.shareFailed);
          }}
        >
          {CLOSING_SCRIPT.actions.send}
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
