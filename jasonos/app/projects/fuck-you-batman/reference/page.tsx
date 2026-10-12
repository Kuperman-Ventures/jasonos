import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { loadFybEntries } from "@/lib/server-actions/fuck-you-batman";

export const metadata = {
  title: "Reference · Fuck You Batman · JasonOS",
  description: "Approved and draft reference notes for Fuck You Batman.",
};

export const dynamic = "force-dynamic";

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mt-2 text-sm leading-relaxed text-foreground/80">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-foreground/80">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-foreground/80">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-3 text-sm font-semibold">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-3 text-sm font-semibold">{children}</h3>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
};

export default async function FuckYouBatmanReferencePage() {
  const entries = await loadFybEntries("reference");

  return (
    <>
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Fuck You Batman
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Reference</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Style notes and other reference. Story Bible and Drift Map get their own screens later.
        </p>
      </header>

      {entries.length === 0 ? (
        <section className="rounded-xl border bg-card p-4">
          <p className="text-sm text-foreground/80">No reference entries yet.</p>
        </section>
      ) : (
        entries.map((entry) => (
          <details key={entry.id} className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer list-none">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {entry.status}
              </p>
              <h2 className="mt-1 text-sm font-semibold">{entry.title}</h2>
            </summary>
            <div className="mt-2">
              {entry.body_md.trim() ? (
                <ReactMarkdown components={markdownComponents}>{entry.body_md}</ReactMarkdown>
              ) : (
                <p className="text-sm text-muted-foreground">No text yet.</p>
              )}
            </div>
          </details>
        ))
      )}
    </>
  );
}
