import type { SkyType } from "@/lib/weather/types";
import { formatDriveSpaced, type ScoredResort } from "@/lib/scoring/score";
import { GatedBanner } from "./GatedBanner";
import { ScoreBreakdown } from "./ScoreBreakdown";

function titleSky(sky: SkyType): string {
  return sky
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inches(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function MountainCard({ result, rank }: { result: ScoredResort; rank: number }) {
  const gated = result.gate.gated;
  const alert = result.alerts[0];
  const { weather, report, resort } = result;
  const conditions = `${Math.round(weather.highF)}°F · ${Math.round(weather.windSustainedMph)} mph · ${titleSky(weather.sky)} · ${inches(weather.snowfallLast72hIn)} in/72h · ${Math.round(report.trailsOpenPct)}% open`;
  const links = [
    { label: "Snow Report", href: resort.links.snowReport },
    { label: "Lifts & Trails", href: resort.links.liftTrailStatus },
    { label: "Webcams", href: resort.links.webcams },
    { label: "Site", href: resort.links.site },
  ];

  return (
    <article className={`rounded-xl border bg-card p-4 ${gated ? "opacity-60" : ""}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-muted-foreground tabular-nums">{rank}</span>
        <h2 className="text-lg font-semibold tracking-tight">{resort.name}</h2>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {resort.town}, {resort.state} · {formatDriveSpaced(resort.driveMinutesFromHome)}
      </p>

      {result.gate.gated ? (
        <div className="mt-3">
          <GatedBanner reasons={result.gate.reasons} />
        </div>
      ) : (
        <div className="mt-3 flex items-end gap-6">
          <div>
            <div className="text-4xl font-semibold leading-none tabular-nums">
              {Math.round(result.finalScore)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Final</div>
          </div>
          <div>
            <div className="text-2xl font-semibold leading-none tabular-nums">
              {Math.round(result.rawScore)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Mountain</div>
            <div className="text-[11px] text-muted-foreground">conditions only</div>
          </div>
        </div>
      )}

      <p className="mt-3 text-sm leading-relaxed">{conditions}</p>

      {alert ? (
        <a
          href={alert.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex min-h-11 items-center rounded-lg bg-amber-100 px-3 text-sm text-amber-950"
        >
          {alert.event}
        </a>
      ) : null}

      {report.source === "stub" ? (
        <p className="mt-2 text-[11px] text-muted-foreground">conditions estimated</p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-4">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-sm underline"
          >
            {link.label}
          </a>
        ))}
      </div>

      <details className="mt-1">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm">Why this score</summary>
        <ScoreBreakdown result={result} />
      </details>
    </article>
  );
}
