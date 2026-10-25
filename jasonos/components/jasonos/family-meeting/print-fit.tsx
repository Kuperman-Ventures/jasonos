"use client";

import { useEffect } from "react";
import {
  choosePrintDensity,
  FMP_MAX_DENSITY,
  FMP_PAGE_CONTENT_HEIGHT_PX,
  lastResortPrintScale,
} from "@/lib/family-meeting/print-density";

function supportsZoom(): boolean {
  try {
    return typeof CSS !== "undefined" && CSS.supports("zoom", "0.5");
  } catch {
    return false;
  }
}

function clearScale(sheet: HTMLElement, frame: HTMLElement) {
  sheet.style.zoom = "";
  sheet.style.transform = "";
  sheet.style.transformOrigin = "";
  frame.style.height = "";
  frame.style.overflow = "";
}

function measureHeight(sheet: HTMLElement): number {
  void sheet.offsetHeight;
  return sheet.scrollHeight;
}

function applyLastResortScale(
  sheet: HTMLElement,
  frame: HTMLElement,
  contentH: number
) {
  const scale = lastResortPrintScale(contentH, FMP_PAGE_CONTENT_HEIGHT_PX);
  if (scale >= 0.999) return 1;

  if (supportsZoom()) {
    sheet.style.zoom = String(scale);
  } else {
    sheet.style.transformOrigin = "top left";
    sheet.style.transform = `scale(${scale})`;
    frame.style.height = `${contentH * scale}px`;
    frame.style.overflow = "hidden";
  }
  return scale;
}

/**
 * Per sheet:
 * 1. Start at density 0 (comfortable — maximize readable space).
 * 2. If it overflows one letter page, step density up (tighten spacing/fonts).
 * 3. Only if still overflowing at max density, uniform-scale as last resort.
 */
function fitSheets() {
  const sheets = document.querySelectorAll<HTMLElement>(".fmp-sheet");

  for (const sheet of sheets) {
    const frame = sheet.parentElement;
    if (!frame?.classList.contains("fmp-sheet-frame")) continue;

    clearScale(sheet, frame);

    const chosen = choosePrintDensity((density) => {
      sheet.dataset.density = String(density);
      return measureHeight(sheet);
    }, FMP_PAGE_CONTENT_HEIGHT_PX, FMP_MAX_DENSITY);

    sheet.dataset.density = String(chosen);
    const hAfter = measureHeight(sheet);
    const scale = applyLastResortScale(sheet, frame, hAfter);

    frame.dataset.printDensity = String(chosen);
    frame.dataset.printScale = scale.toFixed(3);
  }
}

/** Progressive print densify: comfortable first, tighten only on overflow. */
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
