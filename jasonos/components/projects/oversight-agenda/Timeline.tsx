import type { TimelineItem } from "@/lib/projects/oversight-agenda/data";

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="grid grid-cols-1 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.when} className="min-w-0 rounded-xl border bg-card p-4">
          <p className="text-xs [font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]">
            {item.when}
          </p>
          <p className="mt-2 text-sm font-semibold tracking-tight break-words">{item.what}</p>
          <p className="mt-1 text-xs leading-relaxed break-words text-muted-foreground">
            {item.why}
          </p>
        </li>
      ))}
    </ol>
  );
}
