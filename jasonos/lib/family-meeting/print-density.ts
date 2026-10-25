/** Letter content height for @page margin 0.25in each side, at 96dpi. */
export const FMP_PAGE_CONTENT_HEIGHT_PX = (11 - 0.5) * 96;

export const FMP_MAX_DENSITY = 6;

/**
 * Pick the roomiest density that still fits `heightPx` on one letter page.
 * Returns max density if even the tightest level overflows (caller may scale).
 */
export function choosePrintDensity(
  heightForDensity: (density: number) => number,
  pageHeightPx: number = FMP_PAGE_CONTENT_HEIGHT_PX,
  maxDensity: number = FMP_MAX_DENSITY
): number {
  for (let density = 0; density <= maxDensity; density++) {
    if (heightForDensity(density) <= pageHeightPx + 0.5) return density;
  }
  return maxDensity;
}

export function lastResortPrintScale(
  heightPx: number,
  pageHeightPx: number = FMP_PAGE_CONTENT_HEIGHT_PX
): number {
  if (heightPx <= pageHeightPx + 0.5) return 1;
  return Math.min(1, pageHeightPx / Math.max(heightPx, 1));
}
