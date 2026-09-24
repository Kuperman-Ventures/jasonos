"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { InterestLevel } from "@/lib/types";

/** Low → high, matching the Interest cell reference. Empty string = Not set. */
export const INTEREST_PICKER_LEVELS = [
  { key: "safety" as const, name: "Safety / backup", short: "Safety" },
  { key: "moderate" as const, name: "Moderate interest", short: "Moderate" },
  { key: "high" as const, name: "High interest", short: "High" },
  { key: "top" as const, name: "Top choice", short: "Top choice" },
];

export type InterestPickerValue = Exclude<InterestLevel, ""> | "";

function levelIndex(value: InterestPickerValue): number {
  return INTEREST_PICKER_LEVELS.findIndex((level) => level.key === value);
}

export function InterestPicker({
  value,
  schoolName,
  onChange,
}: {
  value: InterestPickerValue;
  schoolName: string;
  onChange: (next: InterestPickerValue) => void;
}) {
  const idx = levelIndex(value);
  const current = idx >= 0 ? INTEREST_PICKER_LEVELS[idx] : null;
  const groupRef = useRef<HTMLDivElement | null>(null);
  const focusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = focusKeyRef.current;
    if (!key || !groupRef.current) return;
    const chip = groupRef.current.querySelector<HTMLButtonElement>(`.chip[data-key="${key}"]`);
    chip?.focus();
    focusKeyRef.current = null;
  }, [value]);

  function selectKey(key: string) {
    const next: InterestPickerValue = value === key ? "" : (key as InterestPickerValue);
    focusKeyRef.current = key;
    onChange(next);
  }

  function onGroupKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const group = groupRef.current;
    if (!group) return;
    const chips = [...group.querySelectorAll<HTMLButtonElement>(".chip")];
    const active = document.activeElement as HTMLButtonElement | null;
    const i = active ? chips.indexOf(active) : -1;

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      if (!chips.length) return;
      const from = i >= 0 ? i : 0;
      const next =
        chips[(from + (event.key === "ArrowRight" ? 1 : chips.length - 1)) % chips.length];
      chips.forEach((chip) => {
        chip.tabIndex = -1;
      });
      next.tabIndex = 0;
      next.focus();
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      focusKeyRef.current = chips[Math.max(i, 0)]?.dataset.key ?? INTEREST_PICKER_LEVELS[0].key;
      onChange("");
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && i >= 0) {
      event.preventDefault();
      event.stopPropagation();
      const key = chips[i]?.dataset.key;
      if (key) selectKey(key);
    }
  }

  return (
    <div className="interest" onClick={(event) => event.stopPropagation()}>
      <span className="interest-value" aria-hidden="true">
        <span className="meter">
          {INTEREST_PICKER_LEVELS.map((level, i) => (
            <span key={level.key} className={idx >= 0 && i <= idx ? "on" : undefined} />
          ))}
        </span>
        <span className={current ? "value-name" : "value-name unset"}>
          {current ? current.name : "Not set"}
        </span>
      </span>
      <div
        ref={groupRef}
        className="chips"
        role="radiogroup"
        aria-label={`Interest for ${schoolName}`}
        onKeyDown={onGroupKeyDown}
      >
        {INTEREST_PICKER_LEVELS.map((level, i) => {
          const checked = i === idx;
          const tabIndex = i === Math.max(idx, 0) ? 0 : -1;
          return (
            <button
              key={level.key}
              type="button"
              className="chip"
              role="radio"
              aria-checked={checked}
              tabIndex={tabIndex}
              data-key={level.key}
              title={level.name}
              onClick={(event) => {
                event.stopPropagation();
                selectKey(level.key);
              }}
            >
              {level.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
