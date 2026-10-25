import type { Resort } from "@/config/resorts";
import { GATES } from "@/config/scoring";
import type { DayWeather, ResortReport } from "@/lib/weather/types";

export type GateResult = { gated: false } | { gated: true; reasons: string[] };

export function checkGates(
  resort: Resort,
  date: string,
  weather: DayWeather,
  report: ResortReport
): GateResult {
  const reasons: string[] = [];
  if (resort.blackoutDates.includes(date)) reasons.push("Blacked out on Epic Local");
  if (report.trailsOpenPct < GATES.minTrailsOpenPct || report.liftsOpen < GATES.minLiftsOpen) {
    reasons.push("Not enough terrain open");
  }
  if (weather.rainHours >= GATES.rainMinHours) reasons.push("Rain during ski hours");
  if (weather.windSustainedMph > GATES.maxSustainedWindMph) reasons.push("Wind likely to hold lifts");
  if (weather.windChillF < GATES.minWindChillF) reasons.push("Dangerous wind chill");
  return reasons.length > 0 ? { gated: true, reasons } : { gated: false };
}
