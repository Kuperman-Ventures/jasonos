"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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

function blurIfInside(root: HTMLElement | null) {
  const active = document.activeElement;
  if (active instanceof HTMLElement && root?.contains(active)) {
    active.blur();
  }
}

export function InterestPicker({
  value,
  schoolName,
  onChange,
  onArchive,
}: {
  value: InterestPickerValue;
  schoolName: string;
  onChange: (next: InterestPickerValue) => void;
  /** Optional: orange X in the chip row; tooltip reads Archive. */
  onArchive?: () => void;
}) {
  const idx = levelIndex(value);
  const current = idx >= 0 ? INTEREST_PICKER_LEVELS[idx] : null;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  /** Touch / no-hover: collapse chips to the meter after a pick until re-touched. */
  const [settled, setSettled] = useState(false);

  // Leaving the school row must resolve back to the meter with no extra click.
  // Chip clicks leave focus on the button; we blur so nothing keeps the chips open.
  // Also set settled for touch layouts where chips are always visible until settled.
  useEffect(() => {
    const interest = rootRef.current;
    if (!interest) return;
    const found = interest.closest("tr.row, .school-card");
    if (!(found instanceof HTMLElement)) return;
    const row: HTMLElement = found;

    function resolveToIndicator() {
      setSettled(true);
      blurIfInside(row);
    }

    function onRowLeave(event: PointerEvent) {
      const next = event.relatedTarget;
      if (next instanceof Node && row.contains(next)) return;
      resolveToIndicator();
    }

    // Table rows sometimes skip pointerleave; cell-level leave + :hover check is reliable.
    function onCellLeave(event: PointerEvent) {
      const next = event.relatedTarget;
      if (next instanceof Node && row.contains(next)) return;
      // Defer so the browser has updated :hover before we decide.
      requestAnimationFrame(() => {
        if (!row.matches(":hover")) resolveToIndicator();
      });
    }

    row.addEventListener("pointerleave", onRowLeave);
    const cells = [...row.querySelectorAll("td")];
    for (const cell of cells) cell.addEventListener("pointerleave", onCellLeave);
    return () => {
      row.removeEventListener("pointerleave", onRowLeave);
      for (const cell of cells) cell.removeEventListener("pointerleave", onCellLeave);
    };
  }, []);

  function selectKey(key: string) {
    const next: InterestPickerValue = value === key ? "" : (key as InterestPickerValue);
    onChange(next);
    // Drop focus immediately so leaving the row cannot leave chips stuck open.
    requestAnimationFrame(() => blurIfInside(rootRef.current));
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
      setSettled(false);
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
      setSettled(false);
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
    <div
      ref={rootRef}
      className={settled ? "interest is-settled" : "interest"}
      onClick={(event) => event.stopPropagation()}
      onPointerEnter={() => {
        if (settled) setSettled(false);
      }}
    >
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
      <div className="chips">
        {onArchive ? (
          <button
            type="button"
            className="chip chip-archive"
            title="Archive"
            aria-label={`Archive ${schoolName}`}
            onClick={(event) => {
              event.stopPropagation();
              if (
                window.confirm(
                  `Archive ${schoolName}? It stays on file with the phases it was in.`,
                )
              ) {
                onArchive();
              }
              requestAnimationFrame(() => blurIfInside(rootRef.current));
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
        <div
          ref={groupRef}
          className="chips-levels"
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
    </div>
  );
}
