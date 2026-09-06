"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DetailLevel, GuideId } from "@/lib/iugr/types";
import { GUIDE_ORDER, getGuide } from "@/lib/iugr/guides";
import { GUIDE_SETTINGS } from "@/lib/iugr/copy";
import { GuideSigil } from "@/components/iugr/GuideSigil";

type GuideSettingsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guideId: GuideId;
  detailLevel: DetailLevel;
  onSelectGuide: (id: GuideId) => void;
  onDetailLevelChange: (level: DetailLevel) => void;
};

export function GuideSettings({
  open,
  onOpenChange,
  guideId,
  detailLevel,
  onSelectGuide,
  onDetailLevelChange,
}: GuideSettingsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [lockedNote, setLockedNote] = useState<string | null>(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) {
      setLockedNote(null);
      node.showModal();
    }
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="iugr-dialog iugr-settings"
      aria-labelledby={titleId}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === dialogRef.current) onOpenChange(false);
      }}
    >
      <h2 id={titleId}>{GUIDE_SETTINGS.heading}</h2>
      <p className="iugr-settings-sub">{GUIDE_SETTINGS.subheading}</p>

      <div className="iugr-guide-grid">
        {GUIDE_ORDER.map((id) => {
          const guide = getGuide(id);
          const locked = guide.status === "coming-soon";
          const active = guideId === id;

          return (
            <button
              key={id}
              type="button"
              className="iugr-guide-card"
              data-active={active}
              data-locked={locked}
              aria-disabled={locked || undefined}
              aria-pressed={locked ? undefined : active}
              aria-label={
                locked
                  ? `${guide.name}, coming soon. ${guide.unavailableMessage}`
                  : `${guide.name}. ${guide.tagline}`
              }
              onClick={() => {
                if (locked) {
                  setLockedNote(guide.unavailableMessage);
                  return;
                }
                setLockedNote(null);
                onSelectGuide(id);
              }}
            >
              <GuideSigil
                guideId={id}
                title={guide.avatarDescription}
                className="iugr-sigil"
              />
              <div>
                <h3>
                  {guide.name}
                  {locked ? " · Coming soon" : active ? " · Active" : ""}
                </h3>
                <p>{guide.tagline}</p>
              </div>
            </button>
          );
        })}
      </div>

      {lockedNote ? (
        <p className="iugr-inline-note" role="status">
          {lockedNote}
        </p>
      ) : null}

      <div style={{ marginTop: "1.15rem" }}>
        <div className="iugr-label" style={{ display: "inline-flex" }}>
          {GUIDE_SETTINGS.detailLabel}
        </div>
        <div
          className="iugr-segmented"
          role="radiogroup"
          aria-label={GUIDE_SETTINGS.detailLabel}
        >
          {GUIDE_SETTINGS.detailOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={detailLevel === option.id}
              data-selected={detailLevel === option.id}
              onClick={() => onDetailLevelChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p className="iugr-note">{GUIDE_SETTINGS.voicesNote}</p>

      <div className="iugr-actions">
        <button
          type="button"
          className="iugr-btn iugr-btn-primary"
          onClick={() => onOpenChange(false)}
        >
          Done
        </button>
      </div>
    </dialog>
  );
}
