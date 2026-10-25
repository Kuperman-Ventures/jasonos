"use client";

import { useEffect } from "react";

/**
 * Letter page content box (11in − 2×0.35in margins), in CSS pixels at 96dpi.
 * Sheets taller than this are scaled down so each prints on exactly one page.
 */
const PAGE_CONTENT_HEIGHT_PX = (11 - 0.7) * 96;
const PAGE_CONTENT_WIDTH_PX = (8.5 - 0.7) * 96;

function fitSheets() {
  const sheets = document.querySelectorAll<HTMLElement>(".fmp-sheet");
  for (const sheet of sheets) {
    const frame = sheet.parentElement;
    if (!frame?.classList.contains("fmp-sheet-frame")) continue;

    sheet.style.transform = "none";
    sheet.style.width = "";
    frame.style.height = "";

    const contentH = sheet.scrollHeight;
    const contentW = sheet.scrollWidth;
    const scale = Math.min(
      1,
      PAGE_CONTENT_HEIGHT_PX / Math.max(contentH, 1),
      PAGE_CONTENT_WIDTH_PX / Math.max(contentW, 1)
    );

    if (scale < 0.999) {
      sheet.style.transformOrigin = "top left";
      sheet.style.transform = `scale(${scale})`;
      sheet.style.width = `${100 / scale}%`;
      frame.style.height = `${contentH * scale}px`;
    } else {
      sheet.style.transform = "";
      sheet.style.width = "";
      frame.style.height = "";
    }
    frame.dataset.printScale = scale.toFixed(3);
  }
}

/** Scales each `.fmp-sheet` down when content would spill past one letter page. */
export function FamilyMeetingPrintFit() {
  useEffect(() => {
    fitSheets();
    const onPrint = () => fitSheets();
    window.addEventListener("beforeprint", onPrint);
    window.addEventListener("resize", onPrint);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(() => fitSheets()).catch(() => undefined);
    return () => {
      window.removeEventListener("beforeprint", onPrint);
      window.removeEventListener("resize", onPrint);
    };
  }, []);

  return null;
}
