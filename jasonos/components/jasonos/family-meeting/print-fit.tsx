"use client";

import { useEffect } from "react";

/**
 * Letter content box height (11in − 2×0.35in margins) at 96dpi.
 * We shrink the whole sheet uniformly — never clip or drop events.
 */
const PAGE_CONTENT_HEIGHT_PX = (11 - 0.7) * 96;

function supportsZoom(): boolean {
  try {
    return typeof CSS !== "undefined" && CSS.supports("zoom", "0.5");
  } catch {
    return false;
  }
}

function clearFit(sheet: HTMLElement, frame: HTMLElement) {
  sheet.style.zoom = "";
  sheet.style.transform = "";
  sheet.style.transformOrigin = "";
  sheet.style.width = "";
  frame.style.height = "";
  frame.style.overflow = "";
}

function fitSheets() {
  const useZoom = supportsZoom();
  const sheets = document.querySelectorAll<HTMLElement>(".fmp-sheet");

  for (const sheet of sheets) {
    const frame = sheet.parentElement;
    if (!frame?.classList.contains("fmp-sheet-frame")) continue;

    clearFit(sheet, frame);

    // Natural (unscaled) size — do not change width before measuring.
    const contentH = sheet.scrollHeight;
    const scale = Math.min(1, PAGE_CONTENT_HEIGHT_PX / Math.max(contentH, 1));

    if (scale >= 0.999) {
      frame.dataset.printScale = "1";
      continue;
    }

    if (useZoom) {
      // zoom shrinks the layout box itself — no overflow clipping.
      sheet.style.zoom = String(scale);
    } else {
      // transform fallback: scale visually; size the frame to the scaled box.
      // Do NOT widen the sheet (that reflows and used to clip trailing events).
      sheet.style.transformOrigin = "top left";
      sheet.style.transform = `scale(${scale})`;
      frame.style.height = `${contentH * scale}px`;
      frame.style.overflow = "hidden";
    }

    frame.dataset.printScale = scale.toFixed(3);
  }
}

/** Uniformly shrinks each sheet to one letter page. Never drops events. */
export function FamilyMeetingPrintFit() {
  useEffect(() => {
    const run = () => fitSheets();
    run();
    window.addEventListener("beforeprint", run);
    window.addEventListener("afterprint", run);
    window.addEventListener("resize", run);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(run).catch(() => undefined);
    return () => {
      window.removeEventListener("beforeprint", run);
      window.removeEventListener("afterprint", run);
      window.removeEventListener("resize", run);
    };
  }, []);

  return null;
}
