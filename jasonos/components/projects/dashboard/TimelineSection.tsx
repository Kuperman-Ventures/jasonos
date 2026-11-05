import type { Section } from "@/lib/dashboard/schema";
import { SectionHeading } from "./section-heading";

type Timeline = Extract<Section, { type: "timeline" }>;

export function TimelineSection({ section }: { section: Timeline }) {
  return (
    <section id={section.id} className="scroll-mt-6">
      <SectionHeading>{section.heading}</SectionHeading>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {section.items.map((item) => (
          <div key={`${item.when}-${item.what}`} className="min-w-0 rounded-xl border bg-card p-4">
            <div className="text-[11px] [font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace] tabular-nums text-muted-foreground">
              {item.when}
            </div>
            <div className="mt-2 text-sm font-semibold tracking-tight">{item.what}</div>
            {item.why ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.why}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
