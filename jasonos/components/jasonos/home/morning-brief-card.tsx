import { Newspaper } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPublishedMorningBrief } from "@/lib/data/morning-brief";

// Home-page "Morning Brief" card — Claude publishes markdown into
// `morning_briefs`; we render today's (ET) row, or the latest with an
// "as of" label. Server-only fetch; no polling.

function formatAsOf(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatTodayLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function MorningBriefCard() {
  const brief = await getPublishedMorningBrief();

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Newspaper className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-tight">Morning Brief</h2>
        {brief ? (
          brief.isStale ? (
            <span className="ml-auto text-[11px] text-amber-300/90">
              as of {formatAsOf(brief.briefDate)}
            </span>
          ) : (
            <span className="ml-auto text-[11px] text-muted-foreground">
              {formatTodayLabel(brief.briefDate)}
            </span>
          )
        ) : null}
      </div>

      {!brief ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          No brief yet
        </p>
      ) : (
        <div className="max-h-[480px] overflow-y-auto px-4 py-3 text-sm leading-relaxed text-foreground/90">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h3 className="mb-2 mt-3 text-base font-semibold tracking-tight first:mt-0">
                  {children}
                </h3>
              ),
              h2: ({ children }) => (
                <h3 className="mb-2 mt-3 text-sm font-semibold tracking-tight first:mt-0">
                  {children}
                </h3>
              ),
              h3: ({ children }) => (
                <h4 className="mb-1.5 mt-2.5 text-sm font-semibold first:mt-0">
                  {children}
                </h4>
              ),
              p: ({ children }) => (
                <p className="mb-2 last:mb-0">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">{children}</strong>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {children}
                </a>
              ),
              hr: () => <hr className="my-3 border-border" />,
              blockquote: ({ children }) => (
                <blockquote className="mb-2 border-l-2 border-border pl-3 text-muted-foreground">
                  {children}
                </blockquote>
              ),
              code: ({ children }) => (
                <code className="rounded bg-muted px-1 py-0.5 text-[12px]">
                  {children}
                </code>
              ),
              table: ({ children }) => (
                <div className="mb-2 overflow-x-auto">
                  <table className="w-full border-collapse text-xs">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border-b border-border px-2 py-1.5 text-left font-semibold">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border-b border-border/60 px-2 py-1.5 align-top">
                  {children}
                </td>
              ),
            }}
          >
            {brief.contentMd}
          </ReactMarkdown>
        </div>
      )}
    </section>
  );
}
