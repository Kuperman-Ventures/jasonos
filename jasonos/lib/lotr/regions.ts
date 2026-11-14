import type { Region } from "./types";

/** Rough tap polygons on the 1000×760 schematic. Original outlines, not traced from any published map. */
export const REGIONS: Region[] = [
  {
    id: "lindon",
    name: "Lindon",
    viewBox: "60 180 260 220",
    path: "M70,220 L210,200 L250,250 L240,340 L160,360 L90,320 Z",
  },
  {
    id: "eriador",
    name: "Eriador",
    viewBox: "210 200 320 140",
    path: "M220,230 L500,220 L510,300 L240,320 Z",
  },
  {
    id: "eregion-moria",
    name: "Eregion And Moria",
    viewBox: "400 290 160 120",
    path: "M410,310 L540,300 L550,380 L420,390 Z",
  },
  {
    id: "rhovanion",
    name: "Rhovanion",
    viewBox: "470 130 300 300",
    path: "M490,150 L760,140 L770,400 L520,420 L480,300 Z",
  },
  {
    id: "rohan-isengard",
    name: "Rohan And Isengard",
    viewBox: "440 380 240 200",
    path: "M450,400 L640,390 L650,540 L470,550 Z",
  },
  {
    id: "gondor",
    name: "Gondor",
    viewBox: "560 480 200 200",
    path: "M580,500 L740,490 L730,680 L600,690 L570,560 Z",
  },
  {
    id: "mordor-southlands",
    name: "Mordor / The Southlands",
    viewBox: "630 430 240 200",
    path: "M650,450 L850,440 L860,600 L700,620 L640,540 Z",
  },
  {
    id: "rhun",
    name: "Rhun",
    viewBox: "790 240 200 180",
    path: "M820,260 L970,250 L980,400 L830,410 Z",
  },
  {
    id: "the-north",
    name: "The North",
    viewBox: "320 10 280 140",
    path: "M340,30 L580,20 L590,120 L350,130 Z",
  },
  {
    id: "numenor-sea",
    name: "Numenor And The Sea",
    viewBox: "0 350 240 320",
    path: "M20,380 L200,370 L210,700 L30,710 Z",
  },
];

export function getRegion(id: string): Region | undefined {
  return REGIONS.find((region) => region.id === id);
}
