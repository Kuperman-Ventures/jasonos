"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
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

type PopoverPos = { top: number; left: number; openUp: boolean };

/** Place the chip row so its horizontal center sits on the click (or trigger center). */
export function placeInterestPopover({
  trigger,
  popoverWidth,
  popoverHeight,
  anchorX,
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280,
  viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800,
  gap = 6,
  edge = 8,
}: {
  trigger: DOMRect;
  popoverWidth: number;
  popoverHeight: number;
  /** Pointer X from the open click; falls back to trigger center. */
  anchorX?: number | null;
  viewportWidth?: number;
  viewportHeight?: number;
  gap?: number;
  edge?: number;
}): PopoverPos {
  const openUp =
    trigger.bottom + gap + popoverHeight > viewportHeight - edge &&
    trigger.top > popoverHeight + gap;
  const top = openUp ? trigger.top - gap - popoverHeight : trigger.bottom + gap;
  const centerX =
    anchorX != null && Number.isFinite(anchorX)
      ? anchorX
      : trigger.left + trigger.width / 2;
  const left = Math.min(
    Math.max(edge, centerX - popoverWidth / 2),
    Math.max(edge, viewportWidth - popoverWidth - edge),
  );
  return { top, left, openUp };
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [anchorX, setAnchorX] = useState<number | null>(null);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const [mounted, setMounted] = useState(false);
  const listId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }

    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setPos(
        placeInterestPopover({
          trigger: rect,
          popoverWidth: popoverRef.current?.offsetWidth ?? 320,
          popoverHeight: popoverRef.current?.offsetHeight ?? 56,
          anchorX,
        }),
      );
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorX]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const chips = groupRef.current?.querySelectorAll<HTMLButtonElement>(".chip");
    const focusIndex = Math.max(idx, 0);
    chips?.[focusIndex]?.focus();
  }, [open, idx]);

  function selectKey(key: string) {
    const next: InterestPickerValue = value === key ? "" : (key as InterestPickerValue);
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
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
      onChange("");
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && i >= 0) {
      event.preventDefault();
      event.stopPropagation();
      const key = chips[i]?.dataset.key;
      if (key) selectKey(key);
    }
  }

  const label = current ? current.short : "Not set";
  const ariaLabel = current
    ? `Interest for ${schoolName}: ${current.name}. Open to change.`
    : `Interest for ${schoolName}: not set. Open to set.`;

  const popover =
    mounted && open
      ? createPortal(
          <div
            ref={popoverRef}
            className={`interest-popover${pos?.openUp ? " open-up" : ""}`}
            style={
              pos
                ? { top: pos.top, left: pos.left }
                : { top: -9999, left: -9999, visibility: "hidden" }
            }
            role="dialog"
            aria-label={`Set interest for ${schoolName}`}
            onClick={(event) => event.stopPropagation()}
          >
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
                      setOpen(false);
                    }
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              ) : null}
              <div
                ref={groupRef}
                id={listId}
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="interest" onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className={`interest-trigger${current ? "" : " unset"}${open ? " is-open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        title={current ? current.name : "Not set"}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((wasOpen) => {
            if (wasOpen) {
              setAnchorX(null);
              return false;
            }
            setAnchorX(event.clientX);
            return true;
          });
        }}
      >
        <span className="meter" aria-hidden="true">
          {INTEREST_PICKER_LEVELS.map((level, i) => (
            <span key={level.key} className={idx >= 0 && i <= idx ? "on" : undefined} />
          ))}
        </span>
        <span className={current ? "value-name" : "value-name unset"}>{label}</span>
      </button>
      {popover}
    </div>
  );
}
