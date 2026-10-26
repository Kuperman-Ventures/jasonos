"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, DotsSixVertical, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { LiveBreadcrumb } from "@/components/jasonos/live/live-breadcrumb";
import { LeaveGuardProvider, useLeaveGuard } from "@/components/jasonos/live/leave-guard";
import { MeetingPickerDialog, type MeetingOption } from "@/components/jasonos/live/meeting-picker-dialog";
import { SaveAsMenu } from "@/components/jasonos/live/save-as-menu";
import { SaveRow } from "@/components/jasonos/live/save-row";
import { AiHelpPanel } from "@/components/jasonos/live/ai-help-panel";
import { useSavedField } from "@/components/jasonos/live/use-saved-field";
import {
  bulletsLinesToText,
  bulletsTextToLines,
  type SlideInput,
} from "@/lib/live/decks-helpers";
import type { DeckDetail } from "@/lib/server-actions/decks";
import {
  renameDeck,
  setDeckDescription,
  setDeckGoal,
  setDeckSlides,
  unlinkDeckMeeting,
} from "@/lib/server-actions/decks";
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

function slideHasText(slide: EditorSlide): boolean {
  return Boolean(slide.headline.trim() || slide.bullets.some((line) => line.trim()));
}

function SortableSlideRow({
  slide,
  index,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  slide: EditorSlide;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.key,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-stretch border-b border-[var(--jos-line)] bg-[var(--jos-surface)]",
        selected && "bg-white",
        isDragging && "z-10 opacity-90 shadow-sm"
      )}
    >
      <button
        type="button"
        className="flex shrink-0 cursor-grab items-center px-1 text-[var(--jos-muted)] active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={16} />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "min-w-0 flex-1 border-l-[3px] px-2 py-2 text-left",
          selected ? "border-[var(--jos-focus)]" : "border-transparent"
        )}
      >
        <span className="text-[11px] font-bold text-[var(--jos-muted)]">{index + 1}</span>
        <span
          className={cn(
            "mt-0.5 block truncate text-[13px] font-semibold",
            slide.headline.trim() ? "text-[var(--jos-ink)]" : "text-[var(--jos-muted)]"
          )}
        >
          {slide.headline.trim() || "Untitled"}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 pr-1 opacity-100 md:opacity-0 md:group-hover:opacity-100">
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Duplicate" onClick={onDuplicate}>
          <Copy size={14} />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Delete" onClick={onDelete}>
          <Trash size={14} />
        </Button>
      </div>
    </li>
  );
}

function DeckEditorInner({
  deck: initial,
  meetingOptions,
  meetingLabel,
  sourcePlaybook,
}: {
  deck: DeckDetail;
  meetingOptions: MeetingOption[];
  meetingLabel: string | null;
  sourcePlaybook: { id: string; name: string; slideCount: number } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { requestLeave } = useLeaveGuard();
  const isDeck = initial.kind === "deck";
  const [slides, setSlides] = useState<EditorSlide[]>(() => toEditorSlides(initial.slides));
  const [selected, setSelected] = useState(() => {
    const n = Number(searchParams.get("slide") || "1");
    if (!Number.isFinite(n) || n < 1) return 0;
    return Math.min(Math.max(slides.length - 1, 0), Math.max(0, Math.floor(n) - 1));
  });
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [showDescription, setShowDescription] = useState(Boolean(initial.description?.trim()));
  const [pending, start] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    setSlides(toEditorSlides(initial.slides));
  }, [initial.slides]);

  const selectedSlide = slides[selected] ?? null;

  const persistSlides = useCallback(
    async (next: EditorSlide[]) => {
      const payload: SlideInput[] = next.map((slide) => ({
        headline: slide.headline,
        bullets: slide.bullets,
      }));
      const result = await setDeckSlides(initial.id, payload);
      if (!result.ok) return { ok: false as const, error: result.error };
      return { ok: true as const, savedAt: new Date().toISOString() };
    },
    [initial.id]
  );

  const nameField = useSavedField({
    saved: initial.name,
    label: "Name",
    onSave: async (value) => {
      const result = await renameDeck(initial.id, value);
      if (!result.ok) return { ok: false, error: result.error };
      setEditingName(false);
      return { ok: true, value: result.name };
    },
  });

  const goalField = useSavedField({
    saved: initial.goal ?? "",
    label: "Goal",
    onSave: async (value) => {
      const result = await setDeckGoal(initial.id, value);
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, value: result.goal ?? "" };
    },
  });

  const descriptionField = useSavedField({
    saved: initial.description ?? "",
    label: "Description",
    onSave: async (value) => {
      const result = await setDeckDescription(initial.id, value);
      if (!result.ok) return { ok: false, error: result.error };
      const next = result.description ?? "";
      if (!next.trim()) setShowDescription(false);
      return { ok: true, value: next };
    },
  });

  const slideDraft = useMemo(
    () => ({
      headline: selectedSlide?.headline ?? "",
      bulletsText: bulletsLinesToText(selectedSlide?.bullets ?? []),
    }),
    [selectedSlide]
  );

  const slideField = useSavedField({
    saved: slideDraft,
    label: "Slide",
    equals: (a, b) => a.headline.trim() === b.headline.trim() && a.bulletsText.trim() === b.bulletsText.trim(),
    onSave: async (value) => {
      if (!selectedSlide) return { ok: false, error: "No slide selected." };
      const next = slides.map((slide, index) =>
        index === selected
          ? {
              ...slide,
              headline: value.headline,
              bullets: bulletsTextToLines(value.bulletsText),
            }
          : slide
      );
      const result = await persistSlides(next);
      if (!result.ok) return { ok: false, error: result.error };
      setSlides(next);
      return { ok: true, value, savedAt: result.savedAt };
    },
  });

  const anyDirty =
    slideField.dirty || nameField.dirty || descriptionField.dirty || goalField.dirty;

  const setSlideIndex = useCallback(
    (index: number, options?: { force?: boolean }) => {
      const go = () => {
        const next = Math.max(0, Math.min(slides.length - 1, index));
        setSelected(next);
        const params = new URLSearchParams(searchParams.toString());
        params.set("slide", String(next + 1));
        const base =
          initial.kind === "playbook"
            ? `/live/playbooks/${initial.id}`
            : `/live/decks/${initial.id}`;
        router.replace(`${base}?${params.toString()}`, { scroll: false });
      };
      if (options?.force || !slideField.dirty) {
        go();
        return;
      }
      requestLeave(go);
    },
    [initial.id, initial.kind, requestLeave, router, searchParams, slideField.dirty, slides.length]
  );

  const guardedHref = (href: string) => (event: MouseEvent) => {
    if (!anyDirty) return;
    event.preventDefault();
    requestLeave(() => router.push(href));
  };

  const addAfterSelected = () => {
    const insertAt = slides.length ? selected : -1;
    const nextSlide: EditorSlide = {
      key: `new-${Date.now()}`,
      headline: "New slide",
      bullets: [],
    };
    const next = [...slides];
    next.splice(insertAt + 1, 0, nextSlide);
    start(async () => {
      const result = await persistSlides(next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSlides(next);
      setSelected(insertAt + 1);
      const params = new URLSearchParams(searchParams.toString());
      params.set("slide", String(insertAt + 2));
      const base =
        initial.kind === "playbook"
          ? `/live/playbooks/${initial.id}`
          : `/live/decks/${initial.id}`;
      router.replace(`${base}?${params.toString()}`, { scroll: false });
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((slide) => slide.key === active.id);
    const newIndex = slides.findIndex((slide) => slide.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(slides, oldIndex, newIndex);
    const nextSelected = next.findIndex((slide) => slide.key === slides[selected]?.key);
    start(async () => {
      const result = await persistSlides(next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSlides(next);
      setSelected(Math.max(0, nextSelected));
    });
  };

  const rehearseHref =
    initial.kind === "playbook"
      ? `/live/playbooks/${initial.id}/rehearse?slide=${selected + 1}`
      : `/live/decks/${initial.id}/rehearse?slide=${selected + 1}`;
  const runHref = `/live/decks/${initial.id}/run?slide=${selected + 1}`;
  const reviewHref = `/live/decks/${initial.id}/review`;

  const crumbs =
    initial.kind === "playbook"
      ? [
          { label: "Live", href: "/live" },
          { label: "Library", href: "/live/library" },
          { label: "Playbooks", href: "/live/library?tab=playbooks" },
          { label: nameField.value || initial.name },
        ]
      : [
          { label: "Live", href: "/live" },
          { label: "Library", href: "/live/library" },
          { label: "Decks", href: "/live/library?tab=decks" },
          { label: nameField.value || initial.name },
        ];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (anyDirty) return;
      event.preventDefault();
      if (event.key === "ArrowDown") setSlideIndex(selected + 1, { force: true });
      else setSlideIndex(selected - 1, { force: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyDirty, selected, setSlideIndex]);

  const descriptionShown = showDescription || Boolean(descriptionField.value.trim());

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-4">
      <LiveBreadcrumb crumbs={crumbs} />

      {/* Row 1: kicker + name + actions */}
      <header className="mt-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
              {isDeck ? "Deck" : "Playbook"}
            </p>
            {editingName || nameField.dirty ? (
              <div className="mt-1">
                <Input
                  value={nameField.value}
                  onChange={(event) => nameField.setValue(event.target.value)}
                  onKeyDown={nameField.onKeyDown}
                  autoFocus
                  className="h-10 border-[var(--jos-line)] bg-[var(--jos-bg)] text-[28px] font-extrabold leading-none"
                />
                <SaveRow
                  state={nameField.state}
                  savedAt={nameField.savedAt}
                  error={nameField.error}
                  name="name"
                  onSave={() => void nameField.save()}
                  onCancel={() => {
                    nameField.cancel();
                    setEditingName(false);
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                className="mt-1 block max-w-full truncate text-left text-[28px] font-extrabold leading-none text-[var(--jos-ink)] hover:underline"
                onClick={() => setEditingName(true)}
              >
                {nameField.value || initial.name}
              </button>
            )}
            {descriptionShown && descriptionField.value.trim() && !descriptionField.dirty ? (
              <button
                type="button"
                className="mt-1 block text-left text-[14px] text-[var(--jos-muted)] hover:underline"
                onClick={() => setShowDescription(true)}
              >
                {descriptionField.value}
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDeck ? (
              <SaveAsMenu
                deckId={initial.id}
                deckName={nameField.value || initial.name}
                deckSlideCount={slides.length}
                sourcePlaybook={sourcePlaybook}
                onUpdated={() => router.refresh()}
              />
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAiHelp(true)}>
              AI help
            </Button>
            <Link
              href={rehearseHref}
              onClick={guardedHref(rehearseHref)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Rehearse
            </Link>
            {isDeck ? (
              <Link href={runHref} onClick={guardedHref(runHref)} className={buttonVariants({ size: "sm" })}>
                Run
              </Link>
            ) : null}
            {isDeck && initial.runEndedAt ? (
              <Link
                href={reviewHref}
                onClick={guardedHref(reviewHref)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Review
              </Link>
            ) : null}
          </div>
        </div>

        {/* Row 2: GOAL */}
        <div className="mt-3">
          <label className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
            Goal
          </label>
          <Input
            value={goalField.value}
            onChange={(event) => goalField.setValue(event.target.value)}
            onKeyDown={goalField.onKeyDown}
            placeholder="What I want out of this meeting, in one line"
            className="mt-1 h-9 border-[var(--jos-line)] bg-[var(--jos-bg)] text-[14px]"
          />
          <SaveRow
            state={goalField.state}
            savedAt={goalField.savedAt}
            error={goalField.error}
            name="goal"
            onSave={() => void goalField.save()}
            onCancel={goalField.cancel}
          />
        </div>

        {/* Row 3: meeting / description */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
          {isDeck ? (
            meetingLabel ? (
              <>
                <span>
                  Meeting: <span className="font-semibold">{meetingLabel}</span>
                </span>
                <button
                  type="button"
                  className="text-[var(--jos-focus)] underline"
                  onClick={() => setMeetingOpen(true)}
                >
                  Change
                </button>
                <button
                  type="button"
                  className="text-[var(--jos-muted)] underline hover:text-[var(--jos-ink)]"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await unlinkDeckMeeting(initial.id);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("Meeting detached");
                      router.refresh();
                    })
                  }
                >
                  Detach
                </button>
              </>
            ) : (
              <>
                <span className="text-[var(--jos-muted)]">No meeting</span>
                <button
                  type="button"
                  className="text-[var(--jos-focus)] underline"
                  onClick={() => setMeetingOpen(true)}
                >
                  Attach meeting
                </button>
              </>
            )
          ) : null}
          {!descriptionShown ? (
            <button
              type="button"
              className="text-[var(--jos-muted)] underline hover:text-[var(--jos-ink)]"
              onClick={() => setShowDescription(true)}
            >
              Add description
            </button>
          ) : null}
        </div>

        {descriptionShown && (descriptionField.dirty || !descriptionField.value.trim()) ? (
          <div className="mt-2">
            <Input
              value={descriptionField.value}
              onChange={(event) => descriptionField.setValue(event.target.value)}
              onKeyDown={descriptionField.onKeyDown}
              placeholder="What this is for"
              className="h-9 border-[var(--jos-line)] bg-[var(--jos-bg)] text-[14px]"
            />
            <SaveRow
              state={descriptionField.state}
              savedAt={descriptionField.savedAt}
              error={descriptionField.error}
              name="description"
              onSave={() => void descriptionField.save()}
              onCancel={() => {
                descriptionField.cancel();
                if (!initial.description?.trim()) setShowDescription(false);
              }}
            />
          </div>
        ) : null}
      </header>

      <div className="mt-4 grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="md:sticky md:top-4 md:self-start">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={slides.map((slide) => slide.key)} strategy={verticalListSortingStrategy}>
              <ul className="overflow-hidden rounded-[2px] border border-[var(--jos-line)]">
                {slides.map((slide, index) => (
                  <SortableSlideRow
                    key={slide.key}
                    slide={slide}
                    index={index}
                    selected={index === selected}
                    onSelect={() => setSlideIndex(index)}
                    onDuplicate={() => {
                      const copy: EditorSlide = {
                        key: `new-${Date.now()}`,
                        headline: slide.headline,
                        bullets: [...slide.bullets],
                      };
                      const next = [...slides];
                      next.splice(index + 1, 0, copy);
                      start(async () => {
                        const result = await persistSlides(next);
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        setSlides(next);
                        setSlideIndex(index + 1, { force: true });
                      });
                    }}
                    onDelete={() => {
                      if (slideHasText(slide) && !window.confirm("Delete this slide?")) return;
                      const next = slides.filter((_, i) => i !== index);
                      start(async () => {
                        const result = await persistSlides(next);
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        setSlides(next);
                        setSelected((current) => Math.max(0, Math.min(next.length - 1, current)));
                      });
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addAfterSelected}>
            <Plus size={14} aria-hidden />
            Add slide
          </Button>
        </aside>

        <section>
          {selectedSlide ? (
            <>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
                Slide {selected + 1} of {slides.length || 1}
              </p>
              <Input
                value={slideField.value.headline}
                onChange={(event) =>
                  slideField.setValue({ ...slideField.value, headline: event.target.value })
                }
                onKeyDown={slideField.onKeyDown}
                className="mt-2 border-[var(--jos-line)] bg-[var(--jos-bg)] text-[24px] font-bold leading-tight"
                placeholder="Headline"
              />
              <Textarea
                value={slideField.value.bulletsText}
                onChange={(event) =>
                  slideField.setValue({ ...slideField.value, bulletsText: event.target.value })
                }
                onKeyDown={slideField.onKeyDown}
                rows={8}
                className="mt-3 min-h-[12rem] border-[var(--jos-line)] bg-[var(--jos-bg)] text-[14px]"
                placeholder="One bullet per line"
              />
              <SaveRow
                state={slideField.state}
                savedAt={slideField.savedAt}
                error={slideField.error}
                name="slide"
                onSave={() => void slideField.save()}
                onCancel={slideField.cancel}
              />
            </>
          ) : (
            <p className="text-[var(--jos-muted)]">No slides yet. Add one.</p>
          )}
        </section>
      </div>

      {showAiHelp ? (
        <AiHelpPanel
          deck={initial}
          open={showAiHelp}
          onClose={() => setShowAiHelp(false)}
          onUpdated={() => router.refresh()}
        />
      ) : null}

      {isDeck ? (
        <MeetingPickerDialog
          open={meetingOpen}
          onOpenChange={setMeetingOpen}
          deckId={initial.id}
          meetings={meetingOptions}
          linkedMeetingId={initial.meetingPrepId}
          onDone={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

export function DeckEditor({
  deck,
  meetingOptions = [],
  meetingLabel = null,
  sourcePlaybook = null,
}: {
  deck: DeckDetail;
  meetingOptions?: MeetingOption[];
  meetingLabel?: string | null;
  sourcePlaybook?: { id: string; name: string; slideCount: number } | null;
}) {
  return (
    <LeaveGuardProvider>
      <DeckEditorInner
        deck={deck}
        meetingOptions={meetingOptions}
        meetingLabel={meetingLabel}
        sourcePlaybook={sourcePlaybook}
      />
    </LeaveGuardProvider>
  );
}
