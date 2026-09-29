import { Sparkline } from "./sparkline";
import { Delta } from "./track-pill";
import { EmptyState } from "./empty-state";
import { TRACK_META, type Track } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { HeroDatum } from "@/lib/data/dashboard";

export function HeroStrip({
  data,
  activeTrack,
  onSelectTrack,
}: {
  data: HeroDatum[];
  activeTrack?: Track | null;
  onSelectTrack?: (t: Track | null) => void;
}) {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {data.map((h) => {
        const meta = TRACK_META[h.track];
        const active = activeTrack === h.track;
        return (
          <button
            key={h.track}
            onClick={() => onSelectTrack?.(active ? null : h.track)}
            className={cn(
              "jos-card-enter group relative overflow-hidden rounded-xl border bg-card p-4 text-left transition-all hover:border-foreground/20",
              active && cn("ring-1", meta.ring, "border-transparent")
            )}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-[var(--jos-line)]" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-widest",
                    meta.accent
                  )}
                >
                  {meta.label}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {h.metric}
                  {h.source === "live" ? (
                    <span className="ml-1.5 inline-block h-1 w-1 rounded-full bg-rung-4 align-middle" />
                  ) : null}
                </div>
              </div>
              <Delta value={h.delta} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              {h.empty ? (
                <EmptyState
                  title={h.secondary ?? "No data yet"}
                  hint={h.hint}
                  action={h.cta}
                  size="sm"
                  className="w-full"
                />
              ) : (
                <div>
                <div className="num-mono text-[28px] font-semibold leading-none tracking-tight">
                  {h.value}
                </div>
                {h.secondary ? (
                  <div className="mt-1.5 text-[11px] text-muted-foreground">
                    {h.secondary}
                  </div>
                ) : null}
                {h.series.length < 7 ? (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    first snapshot - sparkline starts after 7d
                  </div>
                ) : null}
              </div>
              )}
              {!h.empty && h.series.length >= 7 ? (
                <Sparkline
                  data={h.series}
                  width={120}
                  height={36}
                  className={meta.accent}
                />
              ) : null}
            </div>
          </button>
        );
      })}
    </section>
  );
}
