"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  COLOR_MODE_STORAGE_KEY,
  applyResolvedColorMode,
  readStoredColorMode,
  resolveColorMode,
  type ColorModePreference,
} from "@/lib/color-mode";

const OPTIONS: { id: ColorModePreference; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

function subscribePrefersDark(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeModeSwitch({ className = "" }: { className?: string }) {
  const [preference, setPreference] = useState<ColorModePreference>("system");
  const [ready, setReady] = useState(false);
  const prefersDark = useSyncExternalStore(subscribePrefersDark, getPrefersDark, () => false);

  useEffect(() => {
    setPreference(readStoredColorMode());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyResolvedColorMode(resolveColorMode(preference, prefersDark));
  }, [preference, prefersDark, ready]);

  function choose(next: ColorModePreference) {
    setPreference(next);
    try {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
    applyResolvedColorMode(resolveColorMode(next, prefersDark));
  }

  return (
    <div className={className.trim() || "theme-mode"} role="group" aria-label="Appearance">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          data-theme={option.id}
          aria-pressed={preference === option.id}
          onClick={() => choose(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
