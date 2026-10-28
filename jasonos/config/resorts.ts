export type PassAccess = "epic-local-unlimited" | "not-on-epic";

export type Resort = {
  id: string;
  name: string;
  town: string;
  state: string;
  lat: number;
  lon: number;
  summitElevationFt: number;
  baseElevationFt: number;
  passAccess: PassAccess;
  blackoutDates: string[];
  driveMinutesFromHome: number;
  links: {
    site: string;
    snowReport: string;
    liftTrailStatus: string;
    webcams: string;
  };
};

export const HOME = { label: "Maplewood, NJ", lat: 40.7312, lon: -74.2735 };

export const RESORTS: Resort[] = [
  {
    id: "hunter",
    name: "Hunter",
    town: "Hunter",
    state: "NY",
    lat: 42.2027,
    lon: -74.2262,
    summitElevationFt: 3200,
    baseElevationFt: 1600,
    passAccess: "epic-local-unlimited",
    blackoutDates: [],
    driveMinutesFromHome: 135,
    links: {
      site: "https://www.huntermtn.com",
      snowReport:
        "https://www.huntermtn.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx",
      liftTrailStatus:
        "https://www.huntermtn.com/the-mountain/mountain-conditions/lift-and-terrain-status.aspx",
      webcams: "https://www.huntermtn.com/the-mountain/mountain-conditions/mountain-cams.aspx",
    },
  },
  {
    id: "jack-frost",
    name: "Jack Frost",
    town: "Blakeslee",
    state: "PA",
    lat: 41.109,
    lon: -75.605,
    summitElevationFt: 2000,
    baseElevationFt: 1400,
    passAccess: "epic-local-unlimited",
    blackoutDates: [],
    driveMinutesFromHome: 105,
    links: {
      site: "https://www.jfbb.com",
      snowReport:
        "https://www.jfbb.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx",
      liftTrailStatus:
        "https://www.jfbb.com/the-mountain/mountain-conditions/lift-and-terrain-status.aspx",
      webcams: "https://www.jfbb.com/the-mountain/mountain-conditions/mountain-cams.aspx",
    },
  },
  {
    id: "big-boulder",
    name: "Big Boulder",
    town: "Lake Harmony",
    state: "PA",
    lat: 41.056,
    lon: -75.602,
    summitElevationFt: 2175,
    baseElevationFt: 1700,
    passAccess: "epic-local-unlimited",
    blackoutDates: [],
    driveMinutesFromHome: 100,
    links: {
      site: "https://www.jfbb.com",
      snowReport:
        "https://www.jfbb.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx",
      liftTrailStatus:
        "https://www.jfbb.com/the-mountain/mountain-conditions/lift-and-terrain-status.aspx",
      webcams: "https://www.jfbb.com/the-mountain/mountain-conditions/mountain-cams.aspx",
    },
  },
  {
    id: "mountain-creek",
    name: "Mountain Creek",
    town: "Vernon",
    state: "NJ",
    lat: 41.183,
    lon: -74.509,
    summitElevationFt: 1480,
    baseElevationFt: 440,
    passAccess: "not-on-epic",
    blackoutDates: [],
    driveMinutesFromHome: 65,
    links: {
      site: "https://www.mountaincreek.com",
      snowReport: "https://mountaincreek.com/skiing-riding/mountain-report/snow-overview/",
      liftTrailStatus: "https://mountaincreek.com/skiing-riding/mountain-report/snow-overview/",
      webcams: "https://mountaincreek.com/skiing-riding/mountain-report/live-cam/",
    },
  },
  {
    id: "camelback",
    name: "Camelback",
    town: "Tannersville",
    state: "PA",
    lat: 41.051,
    lon: -75.356,
    summitElevationFt: 2133,
    baseElevationFt: 1250,
    passAccess: "not-on-epic",
    blackoutDates: [],
    driveMinutesFromHome: 90,
    links: {
      site: "https://www.camelbackresort.com",
      snowReport: "https://www.camelbackresort.com/snow-report-conditions",
      liftTrailStatus: "https://conditions.camelbackresort.com/conditions/snow-report/",
      webcams: "https://www.camelbackresort.com/resort-information/live-cameras",
    },
  },
];
