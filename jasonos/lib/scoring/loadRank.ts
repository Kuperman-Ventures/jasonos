import { HOME, RESORTS } from "@/config/resorts";
import { getResortReport } from "@/lib/conditions/resortReport";
import { getAlerts } from "@/lib/weather/nws";
import { getDayWeather } from "@/lib/weather/openMeteo";
import { rankResorts, scoreResort, type RankPayload } from "./score";

export async function loadRank(date: string): Promise<RankPayload> {
  const settled = await Promise.all(
    RESORTS.map(async (resort) => {
      try {
        const [weather, alerts, report] = await Promise.all([
          getDayWeather(resort.lat, resort.lon, date),
          getAlerts(resort.lat, resort.lon),
          getResortReport(resort.id, date),
        ]);
        return { result: scoreResort(resort, date, weather, report, alerts) };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Weather fetch failed";
        return { error: { resortId: resort.id, message } };
      }
    })
  );

  return {
    date,
    generatedAt: new Date().toISOString(),
    home: HOME,
    results: rankResorts(settled.flatMap((item) => (item.result ? [item.result] : []))),
    errors: settled.flatMap((item) => (item.error ? [item.error] : [])),
  };
}
