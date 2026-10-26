"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { LiveBreadcrumb } from "@/components/jasonos/live/live-breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeckDetail } from "@/lib/server-actions/decks";
import { formatElapsed } from "@/lib/live/decks-helpers";
import { endRun, startRun } from "@/lib/server-actions/decks";
import { cn } from "@/lib/utils";

type Mode = "rehearse" | "run";

export function DeckStage({ deck, mode }: { deck: DeckDetail; mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slides = deck.slides;
  const initialIndex = (() => {
    const n = Number(searchParams.get("slide") || "1");
    if (!Number.isFinite(n) || n < 1) return 0;
    return Math.min(slides.length - 1, Math.max(0, Math.floor(n) - 1));
  })();
  const [index, setIndex] = useState(initialIndex);
  const [startedAt, setStartedAt] = useState<string | null>(deck.runStartedAt);
  const [now, setNow] = useState(Date.now());
  const [endPrompt, setEndPrompt] = useState(false);

  const editHref =
    deck.kind === "playbook"
      ? `/live/playbooks/${deck.id}?slide=${index + 1}`
      : `/live/decks/${deck.id}?slide=${index + 1}`;
  const editTranscriptHref =
    deck.kind === "playbook"
      ? editHref
      : `/live/decks/${deck.id}?slide=${index + 1}#transcript`;

  useEffect(() => {
    if (mode !== "run") return;
    void startRun(deck.id).then((result) => {
      if (result.ok) setStartedAt(result.startedAt);
    });
  }, [deck.id, mode]);

  useEffect(() => {
    if (mode !== "run" || !startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [mode, startedAt]);

  const finishRun = useCallback(async () => {
    await endRun(deck.id);
    router.push(editTranscriptHref);
  }, [deck.id, editTranscriptHref, router]);

  const leave = useCallback(async () => {
    if (mode === "run") {
      setEndPrompt(true);
      return;
    }
    router.push(editHref);
  }, [editHref, mode, router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
      const key = event.key;
      if (key === "Escape") {
        event.preventDefault();
        void leave();
        return;
      }
      if (key === "ArrowRight" || key === " " || key === "ArrowDown" || key === "j") {
        event.preventDefault();
        setIndex((value) => Math.min(slides.length - 1, value + 1));
        return;
      }
      if (key === "ArrowLeft" || key === "ArrowUp" || key === "k") {
        event.preventDefault();
        setIndex((value) => Math.max(0, value - 1));
        return;
      }
      if (/^[1-9]$/.test(key)) {
        const jump = Number(key) - 1;
        if (jump < slides.length) {
          event.preventDefault();
          setIndex(jump);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leave, slides.length]);

  const elapsed =
    mode === "run" && startedAt ? formatElapsed((now - Date.parse(startedAt)) / 1000) : null;
  const current = slides[index] ?? null;

  const crumbs =
    deck.kind === "playbook"
      ? [
          { label: "Live", href: "/live" },
          { label: "Playbooks", href: "/live/playbooks" },
          { label: deck.name, href: `/live/playbooks/${deck.id}?slide=${index + 1}` },
          { label: mode === "run" ? "Run" : "Rehearse" },
        ]
      : [
          { label: "Live", href: "/live" },
          { label: "Decks", href: "/live/decks" },
          { label: deck.name, href: `/live/decks/${deck.id}?slide=${index + 1}` },
          { label: mode === "run" ? "Run" : "Rehearse" },
        ];

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-[var(--jos-bg)] text-[var(--jos-ink)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--jos-line)] px-4 py-3">
        <div className="min-w-0">
          <LiveBreadcrumb crumbs={crumbs} />
          <p className="mt-1 text-[13px] text-[var(--jos-muted)]">
            Slide {slides.length ? index + 1 : 0} of {slides.length}
            {elapsed ? ` · ${elapsed}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mode === "run" ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void finishRun()}>
              End run
            </Button>
          ) : (
            <Link href={editHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Edit
            </Link>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        {current ? (
          <article className="w-full max-w-3xl">
            <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-tight tracking-tight">
              {current.headline}
            </h1>
            {current.bullets.length ? (
              <ul className="mt-8 space-y-4 text-[clamp(1.05rem,2.2vw,1.35rem)] leading-snug">
                {current.bullets.map((bullet) => (
                  <li key={bullet} className="border-l-[3px] border-[var(--jos-focus)] pl-4">
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ) : (
          <p className="text-[var(--jos-muted)]">No slides yet.</p>
        )}
      </main>

      <footer className="border-t border-[var(--jos-line)] px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
          {slides.map((slide, slideIndex) => (
            <button
              key={slide.id}
              type="button"
              className={cn(
                "h-8 min-w-8 rounded-[2px] border px-2 text-[12px] font-semibold tabular-nums",
                slideIndex === index
                  ? "border-[var(--jos-focus)] bg-[color-mix(in_srgb,var(--jos-focus)_12%,transparent)]"
                  : "border-[var(--jos-line)] bg-[var(--jos-surface)]"
              )}
              onClick={() => setIndex(slideIndex)}
            >
              {slideIndex + 1}
            </button>
          ))}
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-[11px] text-[var(--jos-muted)]">
          Next: → Space ↓ j · Prev: ← ↑ k · Jump: 1–9 · Esc to{" "}
          {mode === "run" ? "end" : "leave"}
        </p>
      </footer>

      <Dialog open={endPrompt} onOpenChange={setEndPrompt}>
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>End the run?</DialogTitle>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setEndPrompt(false)}>
              Keep going
            </Button>
            <Button type="button" onClick={() => void finishRun()}>
              End run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
