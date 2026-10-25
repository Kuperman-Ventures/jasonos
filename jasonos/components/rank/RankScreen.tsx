"use client";

import { useEffect, useState } from "react";
import { RESORTS } from "@/config/resorts";
import { formatPlainDate } from "@/lib/scoring/calendar";
import type { RankPayload } from "@/lib/scoring/score";
import { Ridgeline } from "@/components/ski/Ridgeline";
import { SkiBadge } from "@/components/ski/SkiBadge";
import { DatePicker } from "./DatePicker";
import { MountainCard } from "./MountainCard";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: RankPayload };

function resortName(id: string): string {
  return RESORTS.find((resort) => resort.id === id)?.name ?? id;
}

export function RankScreen({ initial }: { initial: RankPayload }) {
  const [selected, setSelected] = useState(initial.date);
  const [retryToken, setRetryToken] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "ready", data: initial });

  function chooseDate(date: string) {
    setSelected(date);
    if (date !== selected) setState({ status: "loading" });
  }

  function retry() {
    setState({ status: "loading" });
    setRetryToken((token) => token + 1);
  }

  useEffect(() => {
    if (selected === initial.date && retryToken === 0) return;
    let cancelled = false;
    fetch(`/api/rank?date=${selected}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Rank ${response.status}`);
        return (await response.json()) as RankPayload;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [selected, retryToken, initial.date]);

  const results = state.status === "ready" ? state.data.results : [];
  const dayNotSkiable = results.length > 0 && results.every((result) => result.gate.gated);
  const resortFeed =
    state.status === "ready" &&
    state.data.results.some((result) => result.report.source === "resort-feed");

  return (
    <div className="relative min-h-screen max-w-[720px] overflow-hidden px-[18px] py-7 md:px-8">
      <Ridgeline tone="light" />
      <header className="relative flex items-center gap-2.5">
        <SkiBadge ground="light" className="size-[34px] shrink-0" />
        <h1 className="ski-wordmark text-[28px]">SKI</h1>
        <p className="ski-mono ml-auto text-[13px] text-[#3a566f] uppercase">{formatPlainDate(selected)}</p>
      </header>

      <div className="relative mt-[18px]">
        <DatePicker selected={selected} onSelect={chooseDate} />
      </div>

      {dayNotSkiable ? (
        <p className="ski-mono relative mt-[18px] text-[13px] tracking-[0.06em] text-[#ff5a1f] uppercase">
          Not skiable this day
        </p>
      ) : null}

      <div className="relative mt-2">
        {state.status === "loading"
          ? Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="my-3 h-12 animate-pulse rounded-md bg-[#d6eaf7] motion-reduce:animate-none" />
            ))
          : null}

        {state.status === "error" ? (
          <div className="py-4">
            <p className="ski-mono text-sm text-[#ff5a1f]">Weather did not load.</p>
            <button type="button" className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-[#1f6fd1]" onClick={retry}>
              Retry
            </button>
          </div>
        ) : null}

        {state.status === "ready"
          ? results.map((result, index) => (
              <MountainCard key={result.resort.id} result={result} rank={index + 1} />
            ))
          : null}

        {state.status === "ready" && state.data.results.length === 0 ? (
          <div className="py-4">
            <p className="text-sm">No mountains could be ranked for this day.</p>
            <button type="button" className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-[#1f6fd1]" onClick={retry}>
              Retry
            </button>
          </div>
        ) : null}

        {state.status === "ready" && state.data.errors.length > 0 ? (
          <ul className="ski-mono mt-3 space-y-1 text-xs text-[#ff5a1f]">
            {state.data.errors.map((error) => (
              <li key={error.resortId}>
                {resortName(error.resortId)}: {error.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="ski-mono relative mt-6 text-[11px] text-[#3a566f]">
        Weather: Open-Meteo. Alerts: NWS.{" "}
        {resortFeed ? "Resort conditions: resort report" : "Resort conditions: estimated."}
      </p>
    </div>
  );
}
