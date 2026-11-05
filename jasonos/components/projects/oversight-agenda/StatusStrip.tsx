import type { StatusTile } from "@/lib/projects/oversight-agenda/data";
import { cn } from "@/lib/utils";

const mono = "[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]";

export function StatusStrip({ tiles }: { tiles: StatusTile[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => {
        const numeric = /^\d+$/.test(tile.value);
        return (
          <article key={tile.label} className="min-w-0 rounded-xl border bg-card p-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {tile.label}
            </h3>
            <p
              className={cn(
                "mt-2 text-sm font-semibold tracking-tight break-words",
                numeric && mono
              )}
            >
              {tile.value}
            </p>
            <p className="mt-1 text-xs leading-relaxed break-words text-muted-foreground">
              {tile.note}
            </p>
          </article>
        );
      })}
    </div>
  );
}
