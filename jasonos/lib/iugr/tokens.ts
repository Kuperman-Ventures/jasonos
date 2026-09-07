/**
 * IUGR visual system — single source of truth for colour and type tokens.
 * Chapters must consume these (or the matching CSS variables), never hard-coded hex.
 */

export const IUGR_COLOR = {
  ink: "#0B1020",
  inkDeep: "#080C18",
  cream: "#F2EDE3",
  chartreuse: "#C8F04A",
  coral: "#E8836F",
  violet: "#8B86D9",
  textBody: "rgba(242,237,227,0.74)",
  textStrong: "rgba(242,237,227,0.82)",
  label: "rgba(242,237,227,0.45)",
  labelPlate: "rgba(242,237,227,0.42)",
  borderControl: "rgba(242,237,227,0.22)",
  borderPlate: "rgba(242,237,227,0.20)",
  hairline: "rgba(242,237,227,0.12)",
  borderChrome: "rgba(242,237,227,0.08)",
} as const;

/** Reserved meanings — enforce in review. */
export const IUGR_COLOR_ROLES = {
  chartreuse: "reader mark and primary buttons only",
  coral: "copies and the machine lever only",
  violet: "annotations, captions, and Guide marks only",
} as const;

export const IUGR_WASH = {
  violet: "rgba(139,134,217,0.10)",
  coral: "rgba(232,131,111,0.12)",
} as const;

export const IUGR_TYPE = {
  chapterLabel: {
    size: "11px",
    tracking: "0.18em",
    weight: 500,
  },
  h1: {
    size: "34px",
    lineHeight: 1.06,
    weight: 700,
    tracking: "-0.015em",
  },
  body: {
    size: "17px",
    lineHeight: 1.6,
    weight: 400,
    maxWidth: "34em",
  },
  plateLabel: {
    size: "11px",
    tracking: "0.16em",
  },
  dataLabel: {
    size: "11px",
    tracking: "0.14em",
  },
  dataValue: {
    size: "30px",
    weight: 500,
    lineHeight: 1,
  },
  caption: {
    size: "11px",
    tracking: "0.10em",
  },
  captionBody: {
    size: "15px",
    tracking: "0",
  },
  controlChip: {
    size: "14px",
  },
  labelOpacity: 0.62,
} as const;

export const IUGR_PLATE = {
  borderWidth: "1px",
  radius: "3px",
  background: "rgba(242,237,227,0.015)",
  padding: "14px",
  tickSize: "11px",
  tickColor: "rgba(242,237,227,0.5)",
  tickOffset: "-1px",
  captionOpacity: 0.62,
  strokeWidth: 1.4,
} as const;
