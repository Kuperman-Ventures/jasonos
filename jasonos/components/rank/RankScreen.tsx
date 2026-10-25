"use client";

import { useEffect, useState } from "react";
import { RESORTS } from "@/config/resorts";
import { formatPlainDate } from "@/lib/scoring/calendar";
import type { RankPayload } from "@/lib/scoring/score";
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
  const firstGated = results.findIndex((result) => result.gate.gated);
  const resortFeed =
    state.status === "ready" &&
    state.data.results.some((result) => result.report.source === "resort-feed");

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Mountain Rank</h1>
        <p className="mt-1 text-sm text-muted-foreground">{formatPlainDate(selected)}</p>
      </header>

      <div className="mt-4">
        <DatePicker selected={selected} onSelect={chooseDate} />
      </div>

      <div className="mt-4 space-y-3">
        {state.status === "loading"
          ? Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-xl bg-neutral-200" />
            ))
          : null}

        {state.status === "error" ? (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm">Weather did not load.</p>
            <button
              type="button"
              className="mt-3 inline-flex min-h-11 items-center rounded-full bg-foreground px-4 text-sm text-background"
              onClick={retry}
            >
              Retry
            </button>
          </div>
        ) : null}

        {state.status === "ready"
          ? results.map((result, index) => (
              <div key={result.resort.id} className="space-y-3">
                {firstGated === index ? (
                  <p className="pt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Not skiable this day
                  </p>
                ) : null}
                <MountainCard result={result} rank={index + 1} />
              </div>
            ))
          : null}

        {state.status === "ready" && state.data.results.length === 0 ? (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm">No mountains could be ranked for this day.</p>
            <button
              type="button"
              className="mt-3 inline-flex min-h-11 items-center rounded-full bg-foreground px-4 text-sm text-background"
              onClick={retry}
            >
              Retry
            </button>
          </div>
        ) : null}

        {state.status === "ready" && state.data.errors.length > 0 ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {state.data.errors.map((error) => (
              <li key={error.resortId}>
                {resortName(error.resortId)}: {error.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Weather: Open-Meteo. Alerts: NWS.{" "}
        {resortFeed ? "Resort conditions: resort report" : "Resort conditions: estimated."}
      </p>
    </div>
  );
}
