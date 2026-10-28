"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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

const SIZE_STEPS = [
  { headline: 56, bullet: 30 },
  { headline: 52, bullet: 28 },
  { headline: 48, bullet: 26 },
  { headline: 44, bullet: 24 },
  { headline: 40, bullet: 22 },
  { headline: 36, bullet: 20 },
  { headline: 32, bullet: 18 },
] as const;

const FOOTER_PX = 36;

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

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
  const [sizeStep, setSizeStep] = useState(0);
  const [scrollable, setScrollable] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);

  const editHref =
    deck.kind === "playbook"
      ? `/live/playbooks/${deck.id}?slide=${index + 1}`
      : `/live/decks/${deck.id}?slide=${index + 1}`;
  const reviewHref = `/live/decks/${deck.id}/review`;

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
    router.push(reviewHref);
  }, [deck.id, reviewHref, router]);

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

  const current = slides[index] ?? null;
  const sizes = SIZE_STEPS[Math.min(sizeStep, SIZE_STEPS.length - 1)];

  useLayoutEffect(() => {
    setSizeStep(0);
    setScrollable(false);
  }, [index, current?.headline, current?.bullets.join("\n")]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content || !current) return;

    const available = viewport.clientHeight;
    if (available <= 0) return;

    const measure = () => {
      for (let i = 0; i < SIZE_STEPS.length; i++) {
        const { headline, bullet } = SIZE_STEPS[i];
        content.style.setProperty("--stage-headline", `${headline}px`);
        content.style.setProperty("--stage-bullet", `${bullet}px`);
        if (content.scrollHeight <= available + 1) {
          setSizeStep(i);
          setScrollable(false);
          return;
        }
      }
      setSizeStep(SIZE_STEPS.length - 1);
      setScrollable(content.scrollHeight > available + 1);
    };

    measure();

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(viewport);
    ro.observe(content);
    return () => ro.disconnect();
  }, [current, index]);

  const elapsed =
    mode === "run" && startedAt ? formatElapsed((now - Date.parse(startedAt)) / 1000) : null;

  const libraryTab = deck.kind === "playbook" ? "playbooks" : "decks";
  const librarySection = deck.kind === "playbook" ? "Playbooks" : "Decks";

  const crumbs =
    deck.kind === "playbook"
      ? [
          { label: "Live", href: "/live" },
          { label: "Library", href: "/live/library" },
          { label: librarySection, href: `/live/library?tab=${libraryTab}` },
          { label: deck.name, href: `/live/playbooks/${deck.id}?slide=${index + 1}` },
          { label: mode === "run" ? "Run" : "Rehearse" },
        ]
      : [
          { label: "Live", href: "/live" },
          { label: "Library", href: "/live/library" },
          { label: librarySection, href: `/live/library?tab=${libraryTab}` },
          { label: deck.name, href: `/live/decks/${deck.id}?slide=${index + 1}` },
          { label: mode === "run" ? "Run" : "Rehearse" },
        ];

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--jos-bg)] text-[var(--jos-ink)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--jos-line)] px-4 py-2.5">
        <div className="min-w-0">
          <LiveBreadcrumb crumbs={crumbs} />
          <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">
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

      <main
        ref={viewportRef}
        className={cn(
          "relative min-h-0 flex-1 px-6 py-6",
          scrollable
            ? "overflow-y-auto border-b border-[var(--jos-ink)]/25"
            : "flex items-center justify-center overflow-hidden"
        )}
      >
        {current ? (
          <article
            ref={contentRef}
            className="mx-auto w-full max-w-[900px]"
            style={
              {
                "--stage-headline": `${sizes.headline}px`,
                "--stage-bullet": `${sizes.bullet}px`,
              } as CSSProperties
            }
          >
            <h1
              className="font-extrabold leading-[1.08] tracking-tight"
              style={{ fontSize: "var(--stage-headline)" }}
            >
              {current.headline}
            </h1>
            {current.bullets.length ? (
              <ul className="mt-6 space-y-3 leading-[1.25]">
                {current.bullets.map((bullet) => {
                  const long = wordCount(bullet) > 40;
                  const base = sizes.bullet;
                  const fontSize = long ? base - 2 : base;
                  return (
                    <li
                      key={bullet}
                      className="border-l-[3px] border-[var(--jos-focus)] pl-4 font-medium"
                      style={{ fontSize: `${fontSize}px` }}
                    >
                      {bullet}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </article>
        ) : (
          <p className="text-[var(--jos-muted)]">No slides yet.</p>
        )}
      </main>

      <footer
        className="flex h-9 shrink-0 items-center border-t border-[var(--jos-line)] px-4"
        style={{ height: FOOTER_PX }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {slides.map((slide, slideIndex) => (
            <button
              key={slide.id}
              type="button"
              title={slide.headline}
              className={cn(
                "h-4 w-4 shrink-0 rounded-[1px] border border-[var(--jos-ink)]",
                slideIndex === index ? "bg-[var(--jos-ink)]" : "bg-transparent"
              )}
              onClick={() => setIndex(slideIndex)}
              aria-label={`Slide ${slideIndex + 1}: ${slide.headline}`}
            />
          ))}
        </div>
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
