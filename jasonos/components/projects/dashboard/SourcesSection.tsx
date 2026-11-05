import type { Section } from "@/lib/dashboard/schema";
import { SectionHeading } from "./section-heading";

type Sources = Extract<Section, { type: "sources" }>;

function safeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function SourcesSection({ section }: { section: Sources }) {
  return (
    <section id={section.id} className="scroll-mt-6">
      <SectionHeading>{section.heading}</SectionHeading>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {section.items.map((item) => {
          const href = item.url ? safeHttpUrl(item.url) : null;
          return (
            <li key={`${item.title}-${item.url ?? ""}`} className="min-w-0">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="break-words underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground"
                >
                  {item.title}
                </a>
              ) : (
                <span className="break-words">{item.title}</span>
              )}
              {item.note ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.note}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
