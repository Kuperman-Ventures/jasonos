"use client";

import { useId, useState } from "react";
import type { ConsciousnessPremise } from "@/lib/iugr/types";
import { ORIGINAL_TOWN } from "@/lib/iugr/copy";

type ConsciousnessPromptProps = {
  value: ConsciousnessPremise | null;
  onSelect: (value: ConsciousnessPremise) => void;
  onOpenGuideSettings: () => void;
  onContinue: () => void;
};

export function ConsciousnessPrompt({
  value,
  onSelect,
  onOpenGuideSettings,
  onContinue,
}: ConsciousnessPromptProps) {
  const headingId = useId();
  const feedbackId = useId();
  const [showNoDetail, setShowNoDetail] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const feedback =
    value === "yes"
      ? ORIGINAL_TOWN.ackYes
      : value === "unsure"
        ? ORIGINAL_TOWN.ackUnsure
        : value === "no"
          ? ORIGINAL_TOWN.ackNo
          : null;

  return (
    <section className="iugr-consciousness" aria-labelledby={headingId}>
      <div className="iugr-machine-callout">
        <span className="iugr-machine-pilot" aria-hidden />
        <div>
          <div className="iugr-label">{ORIGINAL_TOWN.machineLabel}</div>
          <p>{ORIGINAL_TOWN.machineHint}</p>
        </div>
      </div>

      <h2 id={headingId} className="iugr-consciousness-q">
        {ORIGINAL_TOWN.consciousnessQuestion}
      </h2>

      <div className="iugr-choice-stack" role="group" aria-labelledby={headingId}>
        <button
          type="button"
          className="iugr-choice"
          data-selected={value === "yes"}
          aria-pressed={value === "yes"}
          onClick={() => {
            setShowNoDetail(false);
            onSelect("yes");
          }}
        >
          {ORIGINAL_TOWN.choiceYes}
        </button>
        <button
          type="button"
          className="iugr-choice"
          data-selected={value === "unsure"}
          aria-pressed={value === "unsure"}
          onClick={() => {
            setShowNoDetail(false);
            onSelect("unsure");
          }}
        >
          {ORIGINAL_TOWN.choiceUnsure}
        </button>
        <button
          type="button"
          className="iugr-choice"
          data-selected={value === "no"}
          aria-pressed={value === "no"}
          onClick={() => {
            setShowNoDetail(true);
            onSelect("no");
          }}
        >
          {ORIGINAL_TOWN.choiceNo}
        </button>
      </div>

      {feedback ? (
        <div id={feedbackId} className="iugr-inline-note" role="status" aria-live="polite">
          <p>{feedback}</p>
          {value === "no" && showNoDetail ? (
            <button
              type="button"
              className="iugr-btn iugr-btn-ghost"
              onClick={onContinue}
            >
              {ORIGINAL_TOWN.continueWithQuestion}
            </button>
          ) : (
            <button
              type="button"
              className="iugr-btn iugr-btn-primary"
              onClick={onContinue}
            >
              {ORIGINAL_TOWN.continueLabel}
            </button>
          )}
        </div>
      ) : null}

      <div className="iugr-field-note">
        <button
          type="button"
          className="iugr-field-note-toggle"
          aria-expanded={noteOpen}
          onClick={() => setNoteOpen((v) => !v)}
        >
          {ORIGINAL_TOWN.fieldNoteTitle}
        </button>
        {noteOpen ? (
          <div className="iugr-field-note-body">
            <p>{ORIGINAL_TOWN.fieldNoteTerm}</p>
            <p>{ORIGINAL_TOWN.fieldNotePlain}</p>
            <p className="iugr-field-note-caveat">{ORIGINAL_TOWN.fieldNoteCaveat}</p>
          </div>
        ) : null}
      </div>

      {value ? (
        <p className="iugr-guide-nudge">
          {ORIGINAL_TOWN.guideSettingsNudge}{" "}
          <button
            type="button"
            className="iugr-text-btn"
            onClick={onOpenGuideSettings}
          >
            Open Guide settings
          </button>
        </p>
      ) : null}
    </section>
  );
}
