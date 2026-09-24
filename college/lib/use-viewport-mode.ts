"use client";

import { useEffect, useState } from "react";

/** Matches the college shell’s mobile rail breakpoint. */
export const VIEWPORT_MOBILE_MAX_PX = 900;

export type ViewportMode = "mobile" | "desktop";

export function viewportModeFromMatches(matches: boolean): ViewportMode {
  return matches ? "mobile" : "desktop";
}

/**
 * Live viewport sensor: listens to matchMedia and reports mobile vs desktop.
 * Defaults to desktop on the first paint so SSR and hydration stay aligned.
 */
export function useViewportMode(maxPx = VIEWPORT_MOBILE_MAX_PX): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>("desktop");

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${maxPx}px)`);
    const sync = () => setMode(viewportModeFromMatches(media.matches));
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [maxPx]);

  return mode;
}
