"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseResearchBrief,
  type ResearchBriefModel,
} from "@/lib/ai/research-brief";

function formatSearchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/**
 * Structured HTML layout for web-search research — not a pre-wrapped text dump.
 */
export function ResearchBriefView({
  raw,
  searchedAt,
  className,
  compact = false,
}: {
  raw: string;
  searchedAt?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const model = parseResearchBrief(raw);
  return (
    <ResearchBriefLayout
      model={model}
      searchedAt={searchedAt}
      className={className}
      compact={compact}
    />
  );
}

export function ResearchBriefLayout({
  model,
  searchedAt,
  className,
  compact = false,
}: {
  model: ResearchBriefModel;
  searchedAt?: string | null;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-background/50",
        className
      )}
    >
      {model.empty ? (
        <div className={cn("space-y-2", compact ? "p-3" : "p-3.5")}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            No recent coverage
          </p>
          <p className="text-xs leading-relaxed text-foreground/90">
            {model.lead ??
              "Open web search did not surface usable recent news. Check LinkedIn, the company site, and Crunchbase directly."}
          </p>
          {model.notes.length > 0 ? (
            <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
              {model.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {model.lead ? (
            <div className={cn(compact ? "px-3 py-2.5" : "px-3.5 py-3")}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Snapshot
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/90">
                {model.lead}
              </p>
            </div>
          ) : null}

          {model.bullets.length > 0 ? (
            <div className={cn(compact ? "px-3 py-2.5" : "px-3.5 py-3")}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Findings
              </p>
              <ol className="mt-2 space-y-2">
                {model.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-xs leading-relaxed">
                    <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-muted px-1 text-[10px] font-medium tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0 text-foreground/90">{b}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {model.sources.length > 0 ? (
            <div className={cn(compact ? "px-3 py-2.5" : "px-3.5 py-3")}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sources
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {model.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-start gap-1.5 text-xs text-sky-300 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-200"
                    >
                      <span className="min-w-0 break-words">
                        {s.title?.trim() || s.url}
                      </span>
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {model.notes.length > 0 ? (
            <div className={cn(compact ? "px-3 py-2.5" : "px-3.5 py-3")}>
              <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                {model.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {searchedAt ? (
        <div className="border-t border-border/60 px-3.5 py-2">
          <p className="text-[10px] text-muted-foreground">
            Searched {formatSearchedAt(searchedAt)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
