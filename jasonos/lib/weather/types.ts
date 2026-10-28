export type SurfaceType =
  | "powder"
  | "packed-powder"
  | "machine-groomed"
  | "frozen-granular"
  | "loose-granular"
  | "wet-snow"
  | "icy"
  | "unknown";

export type SkyType =
  | "sunny"
  | "partly-cloudy"
  | "overcast"
  | "light-snow"
  | "heavy-snow"
  | "fog"
  | "rain";

export type DayWeather = {
  date: string;
  highF: number;
  lowF: number;
  windSustainedMph: number;
  windChillF: number;
  snowfallLast72hIn: number;
  rainHours: number;
  sky: SkyType;
  source: "open-meteo";
  fetchedAt: string;
};

export type NwsAlert = {
  event: string;
  severity: string;
  headline: string;
  ends: string | null;
  url: string;
};

export type ResortReport = {
  trailsOpenPct: number;
  liftsOpen: number;
  liftsTotal: number;
  baseDepthIn: number | null;
  surface: SurfaceType;
  snowmakingActive: boolean;
  reportedAt: string | null;
  source: "stub" | "resort-feed";
};
