// TODO: replace with resort feed
import { RESORTS } from "@/config/resorts";
import { deriveDayWeather, getHourly, previous48Hours } from "@/lib/weather/openMeteo";
import type { HourSample } from "@/lib/weather/openMeteo";
import type { ResortReport, SurfaceType } from "@/lib/weather/types";

const LIFTS: Record<string, { open: number; total: number }> = {
  hunter: { open: 8, total: 13 },
  "jack-frost": { open: 4, total: 8 },
  "big-boulder": { open: 3, total: 7 },
  "mountain-creek": { open: 5, total: 9 },
  camelback: { open: 10, total: 16 },
};

function trailsOpenPct(date: string): number {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const inSeason = month === 12 || month === 1 || month === 2 || month === 3;
  if (!inSeason) return 0;
  if (month === 12 && day < 15) return 60;
  return 75;
}

function surfaceFromHours(hours: HourSample[], snowfallLast72hIn: number, overnightLowF: number): SurfaceType {
  let sawWarmRain = false;
  for (const hour of hours) {
    const temp = hour.temperatureF;
    if (sawWarmRain && temp != null && temp < 28) return "icy";
    if ((hour.rainIn ?? 0) > 0.01 && temp != null && temp > 36) sawWarmRain = true;
  }
  if (snowfallLast72hIn >= 4) return "packed-powder";
  if (overnightLowF < 26) return "machine-groomed";
  return "frozen-granular";
}

export async function getResortReport(resortId: string, date: string): Promise<ResortReport> {
  const resort = RESORTS.find((item) => item.id === resortId);
  if (!resort) throw new Error(`Unknown resort ${resortId}`);
  const lifts = LIFTS[resortId];
  if (!lifts) throw new Error(`Unknown resort ${resortId}`);

  const hourly = await getHourly(resort.lat, resort.lon);
  const weather = deriveDayWeather(hourly.samples, date, hourly.fetchedAt);
  const openPct = trailsOpenPct(date);
  return {
    trailsOpenPct: openPct,
    liftsOpen: Math.round((lifts.open * openPct) / 100),
    liftsTotal: lifts.total,
    baseDepthIn: null,
    surface: surfaceFromHours(previous48Hours(hourly.samples, date), weather.snowfallLast72hIn, weather.lowF),
    snowmakingActive: weather.lowF < 26,
    reportedAt: null,
    source: "stub",
  };
}
