import { AreaList } from "@/components/projects/oversight-agenda/AreaList";
import { StatusStrip } from "@/components/projects/oversight-agenda/StatusStrip";
import { Timeline } from "@/components/projects/oversight-agenda/Timeline";
import {
  areas,
  impeachmentMath,
  likelihoodLegend,
  project,
  sources,
  statusTiles,
  timeline,
  updatedOn,
} from "@/lib/projects/oversight-agenda/data";

export default function OversightDashboard() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-6 overflow-x-clip px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight break-words">{project.title}</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{project.description}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">Updated {updatedOn}</p>
      </header>

      <StatusStrip tiles={statusTiles} />

      <section className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          What Happens Next
        </h2>
        <Timeline items={timeline} />
      </section>

      <section className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Investigation Areas
        </h2>
        <AreaList areas={areas} />
        <p className="text-xs leading-relaxed text-muted-foreground">{likelihoodLegend}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Impeachment Math
        </h2>
        <StatusStrip tiles={impeachmentMath} />
      </section>

      <section className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Sources
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {sources.map((source) => (
            <li key={source.url} className="min-w-0 break-words">
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
