"use client";

import { useState } from "react";
import type { SkyType } from "@/lib/weather/types";
import { formatDriveSpaced, type ScoredResort } from "@/lib/scoring/score";
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

function scoreSign(score: number): { className: string; label: string } {
  if (score >= 70) return { className: "size-[26px] rounded-full bg-[#1f7a54]", label: "Send it" };
  if (score >= 40) return { className: "size-6 bg-[#1f6fd1]", label: "Worth a look" };
  return { className: "size-5 rotate-45 bg-[#0b1d33]", label: "Stay home" };
}

export function MountainCard({ result, rank }: { result: ScoredResort; rank: number }) {
  const [open, setOpen] = useState(false);
  const alert = result.alerts[0];
  const { weather, report, resort } = result;
  const score = Math.round(result.finalScore);
  const sign = scoreSign(score);
  const gated = result.gate.gated;
  const conditions = `${Math.round(weather.highF)}°F · ${Math.round(weather.windSustainedMph)} mph · ${titleSky(weather.sky)} · ${inches(weather.snowfallLast72hIn)} in/72h · ${Math.round(report.trailsOpenPct)}% open`;
  const links = [
    { label: "Snow Report", href: resort.links.snowReport },
    { label: "Lifts & Trails", href: resort.links.liftTrailStatus },
    { label: "Webcams", href: resort.links.webcams },
    { label: "Site", href: resort.links.site },
  ];

  return (
    <article className="border-b border-[#d6eaf7]/80">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid min-h-12 w-full grid-cols-[34px_1fr_auto] items-center gap-3 py-3 text-left hover:bg-[#d6eaf7]/70"
      >
        <span className="ski-score text-[30px] text-[#1f6fd1]">{rank}</span>
        <span>
          <span className="block text-xl font-extrabold [font-stretch:110%]">{resort.name}</span>
          <span className="ski-mono block text-xs tracking-[0.04em] text-[#3a566f] uppercase">
            {resort.town}, {resort.state} · {formatDriveSpaced(resort.driveMinutesFromHome)}
          </span>
        </span>
        <span className="flex items-center gap-2.5">
          <span className={`inline-block shrink-0 ${sign.className}`} aria-hidden />
          <span className="sr-only">{sign.label}</span>
          <span className="ski-score min-w-[50px] text-right text-4xl">{score}</span>
        </span>
      </button>
      <div className={`ski-expand grid transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="pb-4 pl-[46px]">
            {gated ? (
              <div className="text-sm font-bold text-[#ff5a1f]">
                {result.gate.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#3a566f]">
                Final {score}. Mountain {Math.round(result.rawScore)}, conditions only.
              </p>
            )}
            <p className="mt-2 text-sm leading-relaxed">{conditions}</p>
            {alert ? (
              <a
                href={alert.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex min-h-11 items-center text-sm font-bold text-[#ff5a1f] hover:underline"
              >
                {alert.event}
              </a>
            ) : null}
            {report.source === "stub" ? (
              <p className="ski-mono mt-2 text-[11px] text-[#3a566f]">conditions estimated</p>
            ) : null}
            <div className="mt-1 flex flex-wrap gap-x-4">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-sm font-bold text-[#1f6fd1] hover:text-[#ff5a1f]"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <p className="mt-1 text-sm font-bold">Why this score</p>
            <div className="overflow-x-auto">
              <ScoreBreakdown result={result} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
