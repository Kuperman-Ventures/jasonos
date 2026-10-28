import { RESORTS } from "@/config/resorts";

/**
 * Christmas break planning for an Epic Local pass.
 * Blackout dates were read from Epic's restricted-dates page on Oct 25, 2026:
 * https://www.epicpass.com/info/peak-restricted-dates.aspx
 *
 * Epic Local does not black out Hunter, Jack Frost, or Big Boulder.
 * Those dates apply only at the restricted resorts listed by Epic.
 * The Northeast Value Pass is a different product and does black out Hunter.
 */

export const EPIC_LOCAL_BLACKOUT_SOURCE =
  "https://www.epicpass.com/info/peak-restricted-dates.aspx";

export const CHRISTMAS_BREAK = { start: "2026-12-24", end: "2027-01-02" };

/** December year of each past break. 2016 means Dec 24, 2016 through Jan 2, 2017. */
export const HISTORY_DECEMBER_YEARS = [
  2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
] as const;

export const EPIC_LOCAL_BLACKOUT_RANGES = [
  { start: "2026-11-27", end: "2026-11-28", label: "Thanksgiving" },
  { start: "2026-12-26", end: "2026-12-31", label: "Christmas week" },
  { start: "2027-01-16", end: "2027-01-16", label: "MLK Saturday" },
  { start: "2027-02-13", end: "2027-02-14", label: "Presidents Day" },
] as const;

export type PassStanding = "open" | "blackout" | "off-pass";

export type ChristmasMountain = {
  id: string;
  name: string;
  town: string;
  state: string;
  lat: number;
  lon: number;
  standing: PassStanding;
  limitNote: string | null;
  driveMinutes: number | null;
};

function fromDayTrip(id: string, standing: PassStanding): ChristmasMountain {
  const resort = RESORTS.find((item) => item.id === id);
  if (!resort) throw new Error(`Missing day-trip resort ${id}`);
  return {
    id: resort.id,
    name: resort.name,
    town: resort.town,
    state: resort.state,
    lat: resort.lat,
    lon: resort.lon,
    standing,
    limitNote: null,
    driveMinutes: resort.driveMinutesFromHome,
  };
}

export const CHRISTMAS_MOUNTAINS: ChristmasMountain[] = [
  fromDayTrip("hunter", "open"),
  fromDayTrip("jack-frost", "open"),
  fromDayTrip("big-boulder", "open"),
  {
    id: "mount-snow",
    name: "Mount Snow",
    town: "West Dover",
    state: "VT",
    lat: 42.9597,
    lon: -72.9204,
    standing: "open",
    limitNote: null,
    driveMinutes: null,
  },
  {
    id: "okemo",
    name: "Okemo",
    town: "Ludlow",
    state: "VT",
    lat: 43.4014,
    lon: -72.7173,
    standing: "open",
    limitNote: null,
    driveMinutes: null,
  },
  {
    id: "mount-sunapee",
    name: "Mount Sunapee",
    town: "Newbury",
    state: "NH",
    lat: 43.326,
    lon: -72.079,
    standing: "open",
    limitNote: null,
    driveMinutes: null,
  },
  fromDayTrip("mountain-creek", "off-pass"),
  fromDayTrip("camelback", "off-pass"),
  {
    id: "stowe",
    name: "Stowe",
    town: "Stowe",
    state: "VT",
    lat: 44.5303,
    lon: -72.7814,
    standing: "blackout",
    limitNote: null,
    driveMinutes: null,
  },
  {
    id: "park-city",
    name: "Park City",
    town: "Park City",
    state: "UT",
    lat: 40.6514,
    lon: -111.5079,
    standing: "blackout",
    limitNote: null,
    driveMinutes: null,
  },
  {
    id: "vail",
    name: "Vail",
    town: "Vail",
    state: "CO",
    lat: 39.6403,
    lon: -106.3742,
    standing: "blackout",
    limitNote: "Also capped at 10 days for the whole season.",
    driveMinutes: null,
  },
];

/** Restricted resorts named on the Epic page that this screen does not score for snow. */
export const OTHER_EPIC_LOCAL_LIMITS: { name: string; limit: string }[] = [
  { name: "Beaver Creek", limit: "Blocked Dec 26-31, and capped at 10 days all season." },
  { name: "Whistler Blackcomb", limit: "Blocked Dec 26-31, and capped at 10 days all season." },
  { name: "Heavenly", limit: "Blocked Dec 26-31." },
  { name: "Northstar", limit: "Blocked Dec 26-31." },
  { name: "Kirkwood", limit: "Blocked Dec 26-31." },
  { name: "Verbier", limit: "Blocked Dec 26-31, and also Feb 6-20." },
];
