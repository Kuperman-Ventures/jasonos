import type { Region } from "./types";

/** Tap polygons sized to enclose relocated pins on the redrawn schematic. */
export const REGIONS: Region[] = [
  {
    id: "lindon",
    name: "Lindon",
    viewBox: "50 170 200 200",
    path: "M60,190 L180,180 L200,250 L185,340 L100,350 L55,280 Z",
  },
  {
    id: "eriador",
    name: "Eriador",
    viewBox: "210 210 280 140",
    path: "M220,230 L450,220 L460,310 L230,325 Z",
  },
  {
    id: "eregion-moria",
    name: "Eregion And Moria",
    viewBox: "380 300 140 110",
    path: "M390,315 L500,305 L510,390 L395,400 Z",
  },
  {
    id: "rhovanion",
    name: "Rhovanion",
    viewBox: "450 110 320 300",
    path: "M460,125 L760,115 L770,390 L500,400 L455,280 Z",
  },
  {
    id: "rohan-isengard",
    name: "Rohan And Isengard",
    viewBox: "410 400 250 200",
    path: "M420,420 L640,410 L650,580 L430,590 Z",
  },
  {
    id: "gondor",
    name: "Gondor",
    viewBox: "540 480 220 230",
    path: "M550,505 L740,490 L730,700 L560,710 L545,560 Z",
  },
  {
    id: "mordor-southlands",
    name: "Mordor / The Southlands",
    viewBox: "640 430 260 220",
    path: "M650,445 L890,435 L900,630 L700,645 L640,540 Z",
  },
  {
    id: "rhun",
    name: "Rhun",
    viewBox: "820 260 170 160",
    path: "M835,275 L980,265 L985,400 L840,410 Z",
  },
  {
    id: "the-north",
    name: "The North",
    viewBox: "250 10 280 120",
    path: "M260,20 L520,15 L530,110 L270,120 Z",
  },
  {
    id: "numenor-sea",
    name: "Numenor And The Sea",
    viewBox: "0 240 220 460",
    path: "M5,250 L180,245 L200,700 L10,710 Z",
  },
];

export function getRegion(id: string): Region | undefined {
  return REGIONS.find((region) => region.id === id);
}
