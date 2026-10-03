"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BriefText } from "@/components/jasonos/home/brief-text";
import { normalizeGmailUrl } from "@/lib/integrations/gmail-links";
import {
  newsletterStoryUrl,
  type NewsletterStory,
} from "@/lib/data/parse-morning-brief";
import type { CityAlertGroup } from "@/lib/data/city-alert-digest";

// Monitored topics on Home. The morning brief fills three columns. The Oct 3
// Google Alert fills San Francisco, Boston, and Smart cities beside them.
// The whole block collapses. Each story still opens a full summary.

const COLLAPSE_KEY = "jasonos.monitored-topics.collapsed";

export type DigestColumn = {
  id: string;
  title: string;
  stories: NewsletterStory[];
  emptyNote?: string;
};

function storyArticleHref(story: NewsletterStory): string | null {
  const url = newsletterStoryUrl(story);
  return url ? normalizeGmailUrl(url) : null;
}

export function NewsletterDigest({
  groups,
  places = [],
}: {
  groups: DigestColumn[];
  places?: CityAlertGroup[];
}) {
  const [selected, setSelected] = useState<{
    groupTitle: string;
    story: NewsletterStory;
  } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      // ignore private-mode / quota errors
    }
  }, []);

  const columns: DigestColumn[] = [...groups, ...places];
  if (!columns.some((g) => g.stories.length > 0 || g.emptyNote)) return null;

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const articleHref = selected ? storyArticleHref(selected.story) : null;
  const summaryIsLonger =
    selected != null &&
    selected.story.summary.trim().length >
      selected.story.teaser.trim().length + 24;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
          Monitored topics
        </span>
        <span className="text-[11px] text-muted-foreground">
          {columns.length} topics
        </span>
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            collapsed ? "-rotate-90" : ""
          }`}
        />
      </button>
      {collapsed ? null : (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((g) => (
          <div key={g.id} className="rounded-lg border bg-background/40 p-3">
            <h4 className="mb-2 text-[12px] font-semibold tracking-tight">
              {g.title}
            </h4>
            {g.stories.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                {g.emptyNote ?? "None today."}
              </p>
            ) : (
              <ul className="space-y-1">
                {g.stories.map((story, j) => {
                  const href = storyArticleHref(story);
                  const showTeaser =
                    Boolean(story.teaser) && story.teaser !== story.title;
                  return (
                    <li key={`${story.url ?? story.title}-${j}`}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected({ groupTitle: g.title, story })
                        }
                        className="w-full rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <span className="block text-[12px] font-medium leading-snug text-foreground/90">
                          {story.title}
                        </span>
                        {showTeaser ? (
                          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                            {story.teaser}
                          </span>
                        ) : null}
                        {href ? (
                          <span className="mt-0.5 block text-[10px] font-medium text-rung-3">
                            Read full summary · open article
                          </span>
                        ) : (
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            Read full summary
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          {selected ? (
            <>
              <DialogHeader className="space-y-3 border-b px-4 py-4 pr-12">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {selected.groupTitle}
                </p>
                {articleHref ? (
                  <DialogTitle className="text-base leading-snug">
                    <a
                      href={articleHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1.5 font-semibold text-rung-3 underline decoration-[var(--jos-line)] underline-offset-2 hover:text-rung-3"
                    >
                      <span>{selected.story.title}</span>
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    </a>
                  </DialogTitle>
                ) : (
                  <DialogTitle className="text-base leading-snug">
                    {selected.story.title}
                  </DialogTitle>
                )}
                {articleHref ? (
                  <a
                    href={articleHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "w-fit gap-1.5"
                    )}
                  >
                    Open article in browser
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    No article link in today&apos;s brief for this item.
                  </p>
                )}
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {summaryIsLonger ? "Full summary" : "Summary"}
                </p>
                <div className="text-[13px] leading-relaxed text-foreground/90 [overflow-wrap:anywhere]">
                  <BriefText text={selected.story.summary} allow={["article"]} />
                </div>
              </div>

              <DialogFooter className="mt-0 shrink-0 border-t bg-muted/30 px-4 py-3">
                {articleHref ? (
                  <a
                    href={articleHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants(), "gap-1.5")}
                  >
                    Open article
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
