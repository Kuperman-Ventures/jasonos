import type { Section } from "@/lib/dashboard/schema";
import { SectionHeading } from "./section-heading";

type Tiles = Extract<Section, { type: "tiles" }>;

const mono =
  "[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace] tabular-nums";

export function TilesSection({ section }: { section: Tiles }) {
  return (
    <section id={section.id} className="scroll-mt-6">
      {section.heading ? <SectionHeading>{section.heading}</SectionHeading> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {section.tiles.map((tile) => (
          <div key={tile.label} className="min-w-0 rounded-xl border bg-card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {tile.label}
            </div>
            <div className={`mt-2 text-sm font-semibold tracking-tight ${tile.mono ? mono : ""}`}>
              {tile.value}
            </div>
            {tile.note ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{tile.note}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
