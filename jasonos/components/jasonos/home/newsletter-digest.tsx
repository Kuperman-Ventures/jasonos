"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BriefText } from "@/components/jasonos/home/brief-text";
import { normalizeGmailUrl } from "@/lib/integrations/gmail-links";
import type {
  NewsletterGroup,
  NewsletterStory,
} from "@/lib/data/parse-morning-brief";

// Three-column newsletter digest. Each story shows a short teaser; click
// opens the full published summary in a modal, with a link out to the article.

export function NewsletterDigest({ groups }: { groups: NewsletterGroup[] }) {
  const [selected, setSelected] = useState<{
    groupTitle: string;
    story: NewsletterStory;
  } | null>(null);

  if (!groups.some((g) => g.stories.length > 0)) return null;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {groups.map((g) => (
          <div key={g.id} className="rounded-lg border bg-background/40 p-3">
            <h4 className="mb-2 text-[12px] font-semibold tracking-tight">
              {g.title}
            </h4>
            {g.stories.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">None today.</p>
            ) : (
              <ul className="space-y-1">
                {g.stories.map((story, j) => {
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
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {selected.groupTitle}
                </p>
                <DialogTitle className="text-base leading-snug">
                  {selected.story.title}
                </DialogTitle>
              </DialogHeader>
              <DialogDescription className="text-[13px] leading-relaxed text-foreground/85">
                <BriefText text={selected.story.summary} />
              </DialogDescription>
              <DialogFooter>
                {selected.story.url ? (
                  <Button
                    render={
                      <a
                        href={normalizeGmailUrl(selected.story.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    Open article
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
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
