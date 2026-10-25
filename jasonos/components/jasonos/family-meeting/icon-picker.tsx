"use client";

import { useEffect, useRef } from "react";
import { FamilyMeetingEventIcon } from "@/components/jasonos/family-meeting/event-icon";
import {
  FAMILY_MEETING_ICON_IDS,
  iconLabel,
  type FamilyMeetingIconId,
} from "@/lib/family-meeting/icons";

export function FamilyMeetingIconPicker({
  current,
  autoId,
  open,
  onOpenChange,
  onPick,
  disabled,
  className,
}: {
  current: FamilyMeetingIconId;
  /** Keyword-discerned icon when override is cleared. */
  autoId: FamilyMeetingIconId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (iconId: FamilyMeetingIconId | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(ev: MouseEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) {
        onOpenChange(false);
      }
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className={`fm-icon-picker ${className ?? ""}`} ref={rootRef}>
      <button
        type="button"
        className="fm-icon-picker-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Change icon (current: ${iconLabel(current)}). Click to pick.`}
        onClick={() => onOpenChange(!open)}
      >
        <FamilyMeetingEventIcon id={current} />
      </button>
      {open ? (
        <div className="fm-icon-picker-pop" role="dialog" aria-label="Pick icon">
          <div className="fm-icon-picker-grid">
            {FAMILY_MEETING_ICON_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={
                  id === current
                    ? "fm-icon-picker-opt is-current"
                    : "fm-icon-picker-opt"
                }
                title={iconLabel(id)}
                aria-label={iconLabel(id)}
                disabled={disabled}
                onClick={() => {
                  onPick(id);
                  onOpenChange(false);
                }}
              >
                <FamilyMeetingEventIcon id={id} />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="fm-icon-picker-auto"
            disabled={disabled}
            onClick={() => {
              onPick(null);
              onOpenChange(false);
            }}
          >
            Auto · {iconLabel(autoId)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
