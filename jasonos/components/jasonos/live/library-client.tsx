"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/jasonos/brand/status";
import { AttachTranscriptDialog } from "@/components/jasonos/live/attach-transcript-dialog";
import { MeetingPickerDialog } from "@/components/jasonos/live/meeting-picker-dialog";
import { ReviewHeldDialog } from "@/components/jasonos/live/review-held-dialog";
import {
  activeDeckSubline,
  formatRubricAverage,
  goalMarkLabel,
  goalMarkRung,
  heldMeetingListState,
  heldMeetingSubline,
} from "@/components/jasonos/live/live-format";
import { LiveStateBadge } from "@/components/jasonos/live/live-state-badge";
import type { AttachableMeeting, DeckSummary, HeldMeetingRow } from "@/lib/server-actions/decks";
import {
  copyDeck,
  createBlankDeck,
  createPlaybook,
  deleteDeck,
  renameDeck,
} from "@/lib/server-actions/decks";
import { cn } from "@/lib/utils";

export type LibraryTab = "playbooks" | "decks" | "held";

type DeckRow = {
  deck: DeckSummary;
  meetingTitle: string | null;
  meetingStartsAt: string | null;
};

const actionBtn =
  "text-[13px] font-semibold text-[var(--jos-muted)] hover:text-[var(--jos-ink)] disabled:opacity-50";
const deleteBtn =
  "text-[13px] font-semibold text-[var(--jos-muted)] hover:text-[var(--color-accent-2-700)] disabled:opacity-50";

type RowAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

function RowActions({ items, className }: { items: RowAction[]; className?: string }) {
  return (
    <>
      <div className={cn("hidden flex-wrap items-center gap-3 min-[900px]:flex", className)}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            className={item.destructive ? deleteBtn : actionBtn}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="min-[900px]:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-8 w-8 items-center justify-center rounded-[2px] text-[var(--jos-muted)] hover:bg-[var(--jos-surface)] hover:text-[var(--jos-ink)]"
            aria-label="Actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            {items.map((item) => (
              <DropdownMenuItem
                key={item.label}
                disabled={item.disabled}
                className={item.destructive ? "text-[var(--color-accent-2-700)]" : undefined}
                onSelect={(event) => {
                  event.preventDefault();
                  item.onClick();
                }}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

function TabLink({ tab, label, current }: { tab: LibraryTab; label: string; current: LibraryTab }) {
  const active = tab === current;
  return (
    <Link
      href={`/live/library?tab=${tab}`}
      className={cn(
        "border-b-2 px-1 pb-2 text-sm font-bold",
        active
          ? "border-[var(--jos-ink)] text-[var(--jos-ink)]"
          : "border-transparent text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
      )}
    >
      {label}
    </Link>
  );
}

export function LibraryClient({
  initialTab,
  playbooks,
  activeDecks,
  heldRows,
  meetings,
}: {
  initialTab: LibraryTab;
  playbooks: DeckSummary[];
  activeDecks: DeckRow[];
  heldRows: HeldMeetingRow[];
  meetings: AttachableMeeting[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as LibraryTab | null) ?? initialTab;
  const safeTab: LibraryTab =
    tab === "decks" || tab === "held" || tab === "playbooks" ? tab : "playbooks";

  const [pending, start] = useTransition();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [linkDeckId, setLinkDeckId] = useState<string | null>(null);
  const [attachTarget, setAttachTarget] = useState<HeldMeetingRow | "orphan" | null>(null);
  const [reviewTarget, setReviewTarget] = useState<HeldMeetingRow | null>(null);
  const [reviewDeckOnly, setReviewDeckOnly] = useState<{ deckId: string; title: string } | null>(
    null
  );

  const runCopy = (id: string, pathPrefix: string) =>
    start(async () => {
      const result = await copyDeck(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Copied");
      router.push(`${pathPrefix}${result.id}`);
      router.refresh();
    });

  const runDelete = (id: string, name: string, kind: "deck" | "playbook") =>
    start(async () => {
      const label = kind === "playbook" ? "playbook" : "deck";
      if (!window.confirm(`Delete ${label} “${name}”?`)) return;
      const result = await deleteDeck(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Deleted");
      router.refresh();
    });

  const runRename = (id: string) =>
    start(async () => {
      const result = await renameDeck(id, renameValue);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRenamingId(null);
      router.refresh();
    });

  const newPlaybook = () =>
    start(async () => {
      const result = await createPlaybook();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/live/playbooks/${result.id}`);
      router.refresh();
    });

  const newDeck = () =>
    start(async () => {
      const result = await createBlankDeck();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/live/decks/${result.id}`);
      router.refresh();
    });

  const headerAction =
    safeTab === "playbooks"
      ? { label: "New playbook", onClick: newPlaybook }
      : safeTab === "decks"
        ? { label: "New deck", onClick: newDeck }
        : null;

  const attachRow =
    attachTarget && attachTarget !== "orphan" ? attachTarget : null;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--jos-line)]">
        <nav className="flex flex-wrap gap-6" aria-label="Library sections">
          <TabLink tab="playbooks" label="Playbooks" current={safeTab} />
          <TabLink tab="decks" label="Decks" current={safeTab} />
          <TabLink tab="held" label="Held meetings" current={safeTab} />
        </nav>
        {headerAction ? (
          <Button type="button" size="sm" disabled={pending} onClick={headerAction.onClick}>
            {headerAction.label}
          </Button>
        ) : null}
      </div>

      {safeTab === "playbooks" ? (
        <PlaybooksTab
          playbooks={playbooks}
          pending={pending}
          renamingId={renamingId}
          renameValue={renameValue}
          setRenamingId={setRenamingId}
          setRenameValue={setRenameValue}
          onRename={runRename}
          onCopy={(id) => runCopy(id, `/live/playbooks/`)}
          onDelete={(id, name) => runDelete(id, name, "playbook")}
        />
      ) : null}

      {safeTab === "decks" ? (
        <DecksTab
          rows={activeDecks}
          pending={pending}
          renamingId={renamingId}
          renameValue={renameValue}
          setRenamingId={setRenamingId}
          setRenameValue={setRenameValue}
          onRename={runRename}
          onCopy={(id) => runCopy(id, `/live/decks/`)}
          onDelete={(id, name) => runDelete(id, name, "deck")}
          onLink={setLinkDeckId}
        />
      ) : null}

      {safeTab === "held" ? (
        <HeldTab
          rows={heldRows}
          pending={pending}
          onAttach={(row) => setAttachTarget(row)}
          onReview={(row) => setReviewTarget(row)}
          onOrphanAttach={() => setAttachTarget("orphan")}
        />
      ) : null}

      {attachTarget ? (
        <AttachTranscriptDialog
          open
          onOpenChange={(open) => {
            if (!open) setAttachTarget(null);
          }}
          meetingPrepId={attachRow?.meetingPrepId}
          deckId={attachRow?.deckId}
          meetingTitle={attachRow?.title ?? "Note review"}
          meetingStartsAt={attachRow?.startsAt ?? null}
          reviewedAt={attachRow?.reviewedAt ?? null}
          onAttached={(deckId, noteTitle) => {
            const wasOrphan = attachTarget === "orphan";
            setAttachTarget(null);
            router.refresh();
            if (wasOrphan) {
              setReviewDeckOnly({ deckId, title: noteTitle });
            }
          }}
        />
      ) : null}

      {reviewTarget?.deckId ? (
        <ReviewHeldDialog
          open
          onOpenChange={(open) => {
            if (!open) setReviewTarget(null);
          }}
          deckId={reviewTarget.deckId}
          title={reviewTarget.title}
          initialGoal={reviewTarget.goal}
          playbooks={playbooks}
        />
      ) : null}

      {reviewDeckOnly ? (
        <ReviewHeldDialog
          open
          onOpenChange={(open) => {
            if (!open) setReviewDeckOnly(null);
          }}
          deckId={reviewDeckOnly.deckId}
          title={reviewDeckOnly.title}
          initialGoal={null}
          playbooks={playbooks}
        />
      ) : null}

      {linkDeckId ? (
        <MeetingPickerDialog
          open
          onOpenChange={(open) => {
            if (!open) setLinkDeckId(null);
          }}
          deckId={linkDeckId}
          meetings={meetings}
          linkedMeetingId={
            activeDecks.find((row) => row.deck.id === linkDeckId)?.deck.meetingPrepId ?? null
          }
          onDone={() => {
            setLinkDeckId(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function RenameRow({
  renameValue,
  setRenameValue,
  pending,
  onSave,
  onCancel,
}: {
  renameValue: string;
  setRenameValue: (value: string) => void;
  pending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input
        value={renameValue}
        onChange={(event) => setRenameValue(event.target.value)}
        className="max-w-sm border-[var(--jos-line)] bg-[var(--jos-bg)]"
      />
      <Button type="button" size="sm" disabled={pending} onClick={onSave}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function PlaybooksTab({
  playbooks,
  pending,
  renamingId,
  renameValue,
  setRenamingId,
  setRenameValue,
  onRename,
  onCopy,
  onDelete,
}: {
  playbooks: DeckSummary[];
  pending: boolean;
  renamingId: string | null;
  renameValue: string;
  setRenamingId: (id: string | null) => void;
  setRenameValue: (value: string) => void;
  onRename: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  if (!playbooks.length) {
    return <p className="mt-8 text-sm text-[var(--jos-muted)]">No playbooks yet.</p>;
  }

  return (
    <ul className="mt-8 divide-y divide-[var(--jos-line)]">
      {playbooks.map((playbook) => (
        <li key={playbook.id} className="py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Link href={`/live/playbooks/${playbook.id}`} className="min-w-0 flex-1 hover:underline">
              {renamingId === playbook.id ? null : (
                <>
                  <p className="truncate text-sm font-semibold text-[var(--jos-ink)]">{playbook.name}</p>
                  {playbook.description ? (
                    <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">{playbook.description}</p>
                  ) : null}
                  <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">{playbook.slideCount} slides</p>
                </>
              )}
            </Link>
            <RowActions
              items={[
                { label: "Copy", disabled: pending, onClick: () => onCopy(playbook.id) },
                {
                  label: "Rename",
                  disabled: pending,
                  onClick: () => {
                    setRenamingId(playbook.id);
                    setRenameValue(playbook.name);
                  },
                },
                {
                  label: "Delete",
                  disabled: pending,
                  destructive: true,
                  onClick: () => onDelete(playbook.id, playbook.name),
                },
              ]}
            />
          </div>
          {renamingId === playbook.id ? (
            <RenameRow
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              pending={pending}
              onSave={() => onRename(playbook.id)}
              onCancel={() => setRenamingId(null)}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function DecksTab({
  rows,
  pending,
  renamingId,
  renameValue,
  setRenamingId,
  setRenameValue,
  onRename,
  onCopy,
  onDelete,
  onLink,
}: {
  rows: DeckRow[];
  pending: boolean;
  renamingId: string | null;
  renameValue: string;
  setRenamingId: (id: string | null) => void;
  setRenameValue: (value: string) => void;
  onRename: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onLink: (deckId: string) => void;
}) {
  if (!rows.length) {
    return <p className="mt-8 text-sm text-[var(--jos-muted)]">No decks yet.</p>;
  }

  return (
    <ul className="mt-8 divide-y divide-[var(--jos-line)]">
      {rows.map(({ deck, meetingTitle, meetingStartsAt }) => (
        <li key={deck.id} className="py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Link href={`/live/decks/${deck.id}`} className="min-w-0 flex-1 hover:underline">
              {renamingId === deck.id ? null : (
                <>
                  <p className="truncate text-sm font-semibold text-[var(--jos-ink)]">{deck.name}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">
                    {activeDeckSubline(deck, meetingTitle, meetingStartsAt)}
                  </p>
                </>
              )}
            </Link>
            <RowActions
              items={[
                {
                  label: deck.meetingPrepId ? "Change meeting" : "Attach meeting",
                  disabled: pending,
                  onClick: () => onLink(deck.id),
                },
                { label: "Copy", disabled: pending, onClick: () => onCopy(deck.id) },
                {
                  label: "Rename",
                  disabled: pending,
                  onClick: () => {
                    setRenamingId(deck.id);
                    setRenameValue(deck.name);
                  },
                },
                {
                  label: "Delete",
                  disabled: pending,
                  destructive: true,
                  onClick: () => onDelete(deck.id, deck.name),
                },
              ]}
            />
          </div>
          {renamingId === deck.id ? (
            <RenameRow
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              pending={pending}
              onSave={() => onRename(deck.id)}
              onCancel={() => setRenamingId(null)}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function HeldTab({
  rows,
  pending,
  onAttach,
  onReview,
  onOrphanAttach,
}: {
  rows: HeldMeetingRow[];
  pending: boolean;
  onAttach: (row: HeldMeetingRow) => void;
  onReview: (row: HeldMeetingRow) => void;
  onOrphanAttach: () => void;
}) {
  const router = useRouter();
  if (!rows.length) {
    return (
      <div className="mt-8">
        <p className="text-sm text-[var(--jos-muted)]">No held meetings yet.</p>
        <button
          type="button"
          className="mt-4 text-[13px] font-semibold text-[var(--jos-muted)] underline hover:text-[var(--jos-ink)]"
          onClick={() => onOrphanAttach()}
        >
          Review a note without a meeting
        </button>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-8 divide-y divide-[var(--jos-line)]">
        {rows.map((row) => {
          const state = heldMeetingListState(row);
          const subline = heldMeetingSubline(row);
          const reviewHref = row.deckId ? `/live/decks/${row.deckId}/review` : null;

          const actions: RowAction[] = [];
          if (!row.hasTranscript) {
            actions.push({
              label: "Attach transcript",
              disabled: pending,
              onClick: () => onAttach(row),
            });
          } else if (!row.reviewedAt && row.deckId) {
            actions.push({
              label: "Review",
              disabled: pending,
              onClick: () => onReview(row),
            });
          }
          if (row.reviewedAt && reviewHref) {
            actions.push({
              label: "Open review",
              disabled: pending,
              onClick: () => router.push(reviewHref),
            });
          }

          const titleHref = reviewHref && row.reviewedAt ? reviewHref : undefined;

          return (
            <li key={row.key} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                {titleHref ? (
                  <Link href={titleHref} className="min-w-0 flex-1 hover:underline">
                    <HeldRowBody row={row} state={state} subline={subline} />
                  </Link>
                ) : (
                  <div className="min-w-0 flex-1">
                    <HeldRowBody row={row} state={state} subline={subline} />
                  </div>
                )}
                {actions.length ? <RowActions items={actions} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="mt-6 text-[13px] font-semibold text-[var(--jos-muted)] underline hover:text-[var(--jos-ink)]"
        onClick={() => onOrphanAttach()}
      >
        Review a note without a meeting
      </button>
    </>
  );
}

function HeldRowBody({
  row,
  state,
  subline,
}: {
  row: HeldMeetingRow;
  state: ReturnType<typeof heldMeetingListState>;
  subline: string;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-semibold text-[var(--jos-ink)]">{row.title}</p>
        <LiveStateBadge state={state} />
        {row.reviewedAt && row.reviewGoalMark ? (
          <StatusPill rung={goalMarkRung(row.reviewGoalMark)} className="text-[11px]">
            {goalMarkLabel(row.reviewGoalMark)}
          </StatusPill>
        ) : null}
        {row.reviewedAt && row.reviewRubricAverage != null ? (
          <span className="text-[11px] font-semibold tabular-nums text-[var(--jos-muted)]">
            {formatRubricAverage(row.reviewRubricAverage)}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">
        {subline}
        {row.runInLive ? (
          <>
            {" · "}
            <span className="text-[var(--jos-muted)]/80">Run in Live</span>
          </>
        ) : null}
      </p>
    </>
  );
}
