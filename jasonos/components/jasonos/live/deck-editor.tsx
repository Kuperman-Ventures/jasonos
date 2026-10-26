"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { TailorPanel } from "@/components/jasonos/live/tailor-panel";
import { LeaveGuardProvider } from "@/components/jasonos/live/leave-guard";
import { bulletsLinesToText, bulletsTextToLines } from "@/lib/live/decks-helpers";
import type { DeckDetail, SlideInput } from "@/lib/server-actions/decks";
import { deleteDeck, renameDeck, setSlides } from "@/lib/server-actions/decks";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type EditorSlide = SlideInput & { key: string };

function toEditorSlides(slides: DeckDetail["slides"]): EditorSlide[] {
  return slides.map((slide) => ({
    key: slide.id,
    headline: slide.headline,
    bullets: slide.bullets,
  }));
}

export function DeckEditor({ deck: initial }: { deck: DeckDetail }) {
  const router = useRouter();
  const isSlides = initial.kind === "slides";
  const [name, setName] = useState(initial.name);
  const [slides, setLocalSlides] = useState<EditorSlide[]>(() => toEditorSlides(initial.slides));
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  const rehearseHref =
    initial.kind === "playbook"
      ? `/live/playbooks/${initial.id}/rehearse`
      : `/live/slides/${initial.id}/rehearse`;
  const runHref = `/live/slides/${initial.id}/run`;

  const markDirty = useCallback(() => setDirty(true), []);

  const save = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Write a name.");
      return;
    }
    if (trimmedName !== initial.name) {
      const renamed = await renameDeck(initial.id, trimmedName);
      if (!renamed.ok) {
        toast.error(renamed.error);
        return;
      }
    }
    const payload: SlideInput[] = slides.map((slide) => ({
      headline: slide.headline,
      bullets: slide.bullets,
    }));
    const saved = await setSlides(initial.id, payload);
    if (!saved.ok) {
      toast.error(saved.error);
      return;
    }
    setDirty(false);
    toast.success("Saved");
    router.refresh();
  }, [initial.id, initial.name, name, router, slides]);

  const addSlide = () => {
    setLocalSlides((current) => [
      ...current,
      { key: `new-${Date.now()}`, headline: "New slide", bullets: [] },
    ]);
    markDirty();
  };

  const removeSlide = (index: number) => {
    setLocalSlides((current) => current.filter((_, i) => i !== index));
    markDirty();
  };

  const moveSlide = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= slides.length) return;
    setLocalSlides((current) => {
      const copy = [...current];
      const [row] = copy.splice(index, 1);
      copy.splice(next, 0, row);
      return copy;
    });
    markDirty();
  };

  const title = useMemo(
    () => (initial.kind === "playbook" ? "Playbook" : "Slides"),
    [initial.kind]
  );

  return (
    <LeaveGuardProvider>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">{title}</p>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                markDirty();
              }}
              className="mt-1 h-11 border-[var(--jos-line)] bg-[var(--jos-bg)] text-lg font-bold"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={rehearseHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Rehearse
            </Link>
            {isSlides ? (
              <Link href={runHref} className={buttonVariants({ variant: "default", size: "sm" })}>
                Run
              </Link>
            ) : null}
            <Button type="button" size="sm" disabled={pending || !dirty} onClick={() => start(() => void save())}>
              Save
            </Button>
          </div>
        </div>

        {isSlides ? (
          <div className="mt-6">
            <TailorPanel deckId={initial.id} aiNotes={initial.aiNotes} onUpdated={() => router.refresh()} />
          </div>
        ) : null}

        <ul className="mt-8 space-y-6">
          {slides.map((slide, index) => (
            <li
              key={slide.key}
              className="rounded-[2px] border border-[var(--jos-line)] bg-[var(--jos-surface)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--jos-muted)]">
                  Slide {index + 1}
                </span>
                <div className="flex gap-1">
                  <Button type="button" size="icon-sm" variant="ghost" disabled={index === 0} onClick={() => moveSlide(index, -1)}>
                    <ArrowUp size={16} aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={index >= slides.length - 1}
                    onClick={() => moveSlide(index, 1)}
                  >
                    <ArrowDown size={16} aria-hidden />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeSlide(index)}>
                    <Trash size={16} aria-hidden />
                  </Button>
                </div>
              </div>
              <Input
                value={slide.headline}
                onChange={(event) => {
                  const value = event.target.value;
                  setLocalSlides((current) =>
                    current.map((row, i) => (i === index ? { ...row, headline: value } : row))
                  );
                  markDirty();
                }}
                className="mt-3 border-[var(--jos-line)] bg-[var(--jos-bg)] font-semibold"
                placeholder="Headline"
              />
              <Textarea
                value={bulletsLinesToText(slide.bullets)}
                onChange={(event) => {
                  const bullets = bulletsTextToLines(event.target.value);
                  setLocalSlides((current) =>
                    current.map((row, i) => (i === index ? { ...row, bullets } : row))
                  );
                  markDirty();
                }}
                rows={4}
                className="mt-2 border-[var(--jos-line)] bg-[var(--jos-bg)] text-[14px]"
                placeholder="One bullet per line"
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addSlide}>
            <Plus size={14} aria-hidden />
            Add slide
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("text-[var(--jos-danger-text)]")}
            onClick={() =>
              start(async () => {
                if (!window.confirm(`Delete this ${title.toLowerCase()}?`)) return;
                const result = await deleteDeck(initial.id);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Deleted");
                router.push(initial.kind === "playbook" ? "/live/playbooks" : "/live");
              })
            }
          >
            Delete
          </Button>
        </div>
      </div>
    </LeaveGuardProvider>
  );
}
