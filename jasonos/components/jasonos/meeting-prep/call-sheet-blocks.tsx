"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Circle, WarningCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FieldSaveRow,
  LIVE_FIELD,
  LIVE_SECTION_LABEL,
  useSavedField,
  type SaveOutcome,
} from "@/components/jasonos/live";
import { easternClock } from "@/components/jasonos/meeting-prep/meeting-prep-bits";
import { PointsEditor } from "@/components/jasonos/meeting-prep/points-editor";
import { checkAsk } from "@/lib/meeting-prep/ask-rules";
import {
  blockIsFilled,
  filledLineCount,
  type CallSheetBlock,
  type CallSheetLine,
} from "@/lib/meeting-prep/call-sheet";
import { easternDateLong, type MeetingContextPerson } from "@/lib/meeting-prep/context-model";
import { REACTION_LABELS } from "@/lib/meeting-prep/reactions";
import type { PlaybookObjection } from "@/lib/meeting-prep/playbook-blocks";
import { confirmCallSheetBlock, updateCallSheetBlock } from "@/lib/server-actions/call-sheet";
import { recheckMeetingWho } from "@/lib/server-actions/meeting-plan";
import {
  createMeetingPoint,
  deleteMeetingPoint,
  draftMeetingPointReactions,
  reorderMeetingPoints,
  updateMeetingPoint,
  type MeetingPoint,
} from "@/lib/server-actions/meeting-points";
import { cn } from "@/lib/utils";

const LINK = "text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline";
const FIELD_TEXT = cn(LIVE_FIELD, "block resize-y py-2.5 text-[17px] leading-relaxed");

function rowsFor(text: string, min = 2): number {
  const lines = text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 72)), 0);
  return Math.min(12, Math.max(min, lines));
}

type OnSaved = (block: CallSheetBlock) => void;

function sameLines(a: CallSheetLine[], b: CallSheetLine[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((line, index) => line.label === b[index].label && line.text.trim() === b[index].text.trim());
}

async function saveBlock(
  blockId: string,
  patch: { body?: string | null; lines?: CallSheetLine[] },
  onSaved: OnSaved
): Promise<SaveOutcome<never> & { block?: CallSheetBlock }> {
  const result = await updateCallSheetBlock(blockId, patch);
  if (!result.ok) return result;
  onSaved(result.block);
  return { ok: true, savedAt: result.block.updatedAt, block: result.block };
}

export function BlockFrame({
  block,
  number,
  minutes,
  needed,
  onActive,
  children,
}: {
  block: CallSheetBlock;
  number: number;
  minutes: number | null;
  needed: boolean;
  onActive: () => void;
  children: ReactNode;
}) {
  return (
    <section
      id={`block-${block.key}`}
      data-block-id={block.id}
      onFocusCapture={onActive}
      className={cn(
        "scroll-mt-[calc(var(--jos-nav-h)+24px)] border-t border-l-4 border-t-[var(--jos-line)] py-8 pl-6",
        needed ? "border-l-[var(--color-accent-2)]" : "border-l-transparent"
      )}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[15px] font-bold tabular-nums text-[var(--jos-muted)]">{number}</span>
        <h2 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em]">{block.title}</h2>
        {minutes ? (
          <span className="text-[13px] font-semibold tabular-nums text-[var(--jos-muted)]">{minutes} min</span>
        ) : null}
        {needed ? (
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--color-accent-2-text)]">
            (Needed)
          </span>
        ) : null}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ConfirmLink({ block, onSaved }: { block: CallSheetBlock; onSaved: OnSaved }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={LINK}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void confirmCallSheetBlock(block.id).then((result) => {
          setBusy(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          onSaved({ ...block, confirmedAt: result.confirmedAt });
        });
      }}
    >
      Confirm
    </button>
  );
}

export function TextBlockBody({
  block,
  placeholder,
  onSaved,
  footer,
}: {
  block: CallSheetBlock;
  placeholder?: string;
  onSaved: OnSaved;
  footer?: ReactNode;
}) {
  const field = useSavedField<string>({
    saved: block.body ?? "",
    savedAt: block.updatedAt,
    label: block.title,
    onSave: async (value) => {
      const result = await saveBlock(block.id, { body: value }, onSaved);
      return result.ok ? { ok: true, value: result.block?.body ?? "", savedAt: result.savedAt } : result;
    },
  });
  return (
    <div onKeyDown={field.onKeyDown}>
      <textarea
        value={field.value}
        aria-label={block.title}
        placeholder={placeholder ?? `Write ${block.title.toLowerCase()}`}
        rows={rowsFor(field.value)}
        className={FIELD_TEXT}
        onChange={(event) => field.setValue(event.target.value)}
      />
      {footer}
      <FieldSaveRow field={field} name={block.title} />
    </div>
  );
}

function researchLine(person: MeetingContextPerson | null, researchRanAt: string | null): string {
  if (!researchRanAt) return "Not researched yet";
  const sources = person?.researchSources.length ?? 0;
  const parts = [`From research ${easternDateLong(researchRanAt)}`];
  if (sources) parts.push(sources === 1 ? "1 source" : `${sources} sources`);
  if (person?.referredByName) parts.push(`introduced by ${person.referredByName}`);
  return parts.join(" · ");
}

export function WhoBlockBody({
  block,
  prepId,
  person,
  researchRanAt,
  onSaved,
}: {
  block: CallSheetBlock;
  prepId: string;
  person: MeetingContextPerson | null;
  researchRanAt: string | null;
  onSaved: OnSaved;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const recheck = () => {
    setChecking(true);
    void recheckMeetingWho(prepId).then((result) => {
      setChecking(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.errors.length && !result.researched.length) toast.error(result.errors[0]);
      else toast.success("Research and email refreshed");
      router.refresh();
    });
  };
  return (
    <TextBlockBody
      block={block}
      placeholder="Who they are, what they do now, one accomplishment to ask about"
      onSaved={onSaved}
      footer={
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-[var(--jos-muted)]">
          <span>{checking ? "Checking who they are" : researchLine(person, researchRanAt)}</span>
          <button type="button" className={LINK} disabled={checking} onClick={recheck}>
            Re-check
          </button>
          {!block.confirmedAt && block.body ? <ConfirmLink block={block} onSaved={onSaved} /> : null}
        </p>
      }
    />
  );
}

export function LinesBlockBody({ block, onSaved }: { block: CallSheetBlock; onSaved: OnSaved }) {
  const field = useSavedField<CallSheetLine[]>({
    saved: block.lines,
    savedAt: block.updatedAt,
    label: block.title,
    equals: sameLines,
    onSave: async (value) => {
      const result = await saveBlock(block.id, { lines: value }, onSaved);
      return result.ok ? { ok: true, value: result.block?.lines ?? value, savedAt: result.savedAt } : result;
    },
  });
  const showConfirm = !block.confirmedAt && block.lines.some((line) => line.sourceHint);
  if (!block.lines.length) {
    return <p className="text-[15px] text-[var(--jos-muted)]">No lines on this block.</p>;
  }
  return (
    <div onKeyDown={field.onKeyDown} className="space-y-5">
      {field.value.map((line, index) => {
        const saved = field.savedValue[index];
        const hint = saved && saved.text.trim() === line.text.trim() ? saved.sourceHint : null;
        const id = `${block.id}-line-${index}`;
        return (
          <div key={id} className="space-y-1.5">
            <label htmlFor={id} className={LIVE_SECTION_LABEL}>
              {line.label || `Line ${index + 1}`}
            </label>
            <textarea
              id={id}
              value={line.text}
              rows={rowsFor(line.text, 2)}
              placeholder={line.label || "Write a line"}
              className={FIELD_TEXT}
              onChange={(event) =>
                field.setValue(
                  field.value.map((item, at) => (at === index ? { ...item, text: event.target.value } : item))
                )
              }
            />
            {hint ? <p className="text-[13px] text-[var(--jos-muted)]">{hint}</p> : null}
          </div>
        );
      })}
      {showConfirm ? (
        <p className="text-[13px] text-[var(--jos-muted)]">
          Build filled some lines. <ConfirmLink block={block} onSaved={onSaved} />
        </p>
      ) : null}
      <FieldSaveRow field={field} name={block.title} className="pt-0" />
    </div>
  );
}

function AskNotes({ text }: { text: string }) {
  if (!text.trim()) return null;
  const check = checkAsk(text);
  if (check.ok) {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-done)]">
        <CheckCircle size={16} weight="duotone" aria-hidden />
        Who question. Says what you want.
      </p>
    );
  }
  return (
    <ul className="mt-2 space-y-1" aria-label="Ask rules">
      {check.notes.map((note) => (
        <li key={note} className="flex items-start gap-2 text-[14px] font-medium text-[var(--jos-ink)]">
          <span className="mt-[7px] size-2 shrink-0 bg-[var(--color-process-yellow)]" aria-hidden />
          {note}
        </li>
      ))}
    </ul>
  );
}

type AskValue = { body: string; lines: CallSheetLine[] };

function sameAsk(a: AskValue, b: AskValue): boolean {
  return a.body.trim() === b.body.trim() && sameLines(a.lines, b.lines);
}

export function AskBlockBody({
  block,
  objections,
  onSaved,
}: {
  block: CallSheetBlock;
  objections: PlaybookObjection[];
  onSaved: OnSaved;
}) {
  const field = useSavedField<AskValue>({
    saved: { body: block.body ?? "", lines: block.lines },
    savedAt: block.updatedAt,
    label: block.title,
    equals: sameAsk,
    onSave: async (value) => {
      const result = await saveBlock(block.id, { body: value.body, lines: value.lines }, onSaved);
      return result.ok
        ? {
            ok: true,
            value: { body: result.block?.body ?? "", lines: result.block?.lines ?? value.lines },
            savedAt: result.savedAt,
          }
        : result;
    },
  });
  const value = field.value;
  return (
    <div onKeyDown={field.onKeyDown} className="space-y-5">
      <div>
        <label htmlFor={`${block.id}-ask`} className={LIVE_SECTION_LABEL}>
          The ask
        </label>
        <textarea
          id={`${block.id}-ask`}
          value={value.body}
          rows={rowsFor(value.body)}
          placeholder="Who do you know that…"
          className={cn(FIELD_TEXT, "mt-1.5")}
          onChange={(event) => field.setValue({ ...value, body: event.target.value })}
        />
        <AskNotes text={value.body} />
      </div>
      {value.lines.map((line, index) => {
        const id = `${block.id}-ask-line-${index}`;
        return (
          <div key={id}>
            <label htmlFor={id} className={LIVE_SECTION_LABEL}>
              {line.label || "Soft ask"}
            </label>
            <textarea
              id={id}
              value={line.text}
              rows={rowsFor(line.text)}
              placeholder={line.label || "Soft ask"}
              className={cn(FIELD_TEXT, "mt-1.5")}
              onChange={(event) =>
                field.setValue({
                  ...value,
                  lines: value.lines.map((item, at) => (at === index ? { ...item, text: event.target.value } : item)),
                })
              }
            />
            {index === 0 ? <AskNotes text={line.text} /> : null}
          </div>
        );
      })}
      <FieldSaveRow field={field} name="the ask" className="pt-0" />
      {objections.length ? <ReactionsTable objections={objections} /> : null}
    </div>
  );
}

function ReactionsTable({ objections }: { objections: PlaybookObjection[] }) {
  return (
    <div className="pt-2">
      <p className={LIVE_SECTION_LABEL}>If they say</p>
      <table className="mt-2 w-full border-t-2 border-[var(--jos-ink)] text-left text-[15px]">
        <thead>
          <tr className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            <th className="w-[22%] py-2 pr-3 font-semibold">Reaction</th>
            <th className="w-[36%] py-2 pr-3 font-semibold">Sounds like</th>
            <th className="py-2 font-semibold">Pivot</th>
          </tr>
        </thead>
        <tbody>
          {objections.map((row, index) => (
            <tr key={`${row.shape}-${index}`} className="border-t border-[var(--jos-line)] align-top">
              <td className="py-2.5 pr-3 font-semibold">{REACTION_LABELS[row.shape]}</td>
              <td className="py-2.5 pr-3 text-[var(--jos-muted)]">{row.soundsLike}</td>
              <td className="py-2.5">{row.pivot}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const KIND_TOPIC: Record<MeetingPoint["kind"], string> = {
  agenda: "Agenda",
  point: "Point",
  question: "Question",
  ask: "Ask",
};

export function ConversationBlockBody({
  prepId,
  points,
  pointsError,
  playbookId,
}: {
  prepId: string;
  points: MeetingPoint[];
  pointsError?: string | null;
  playbookId: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows: Array<{ point: MeetingPoint; topic: string; number: number }> = [];
  let topic: string | null = null;
  for (const point of points) {
    if (point.kind === "agenda") {
      topic = point.headline;
      continue;
    }
    rows.push({ point, topic: topic ?? KIND_TOPIC[point.kind], number: rows.length + 1 });
  }
  const visible = showAll ? rows : rows.slice(0, 5);
  const hidden = rows.length - visible.length;

  if (editing) {
    return (
      <div className="space-y-3">
        <PointsEditor
          layout="outline"
          points={points}
          error={pointsError}
          selectedId={selectedId}
          onSelectedIdChange={setSelectedId}
          actions={{
            create: async (input) => {
              const result = await createMeetingPoint({ prepId, ...input });
              if (!result.ok) return result;
              return { ok: true, id: result.point.id };
            },
            update: (id, patch) => updateMeetingPoint(id, patch),
            draftReactions: (id) => draftMeetingPointReactions(id),
            remove: (id) => deleteMeetingPoint(id),
            reorder: (ids) => reorderMeetingPoints(prepId, ids),
          }}
        />
        <button type="button" className={LINK} onClick={() => setEditing(false)}>
          Done editing points
        </button>
      </div>
    );
  }

  return (
    <div>
      {pointsError ? (
        <p className="bg-[var(--color-accent-2-100)] px-3 py-2 text-[14px] font-semibold text-[var(--color-accent-2-text)]">
          {pointsError}
        </p>
      ) : null}
      {rows.length ? (
        <ol>
          {visible.map(({ point, topic: label, number }) => {
            const spoken = (point.detail ?? "").split("\n")[0]?.trim();
            return (
              <li
                key={point.id}
                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 border-t border-[var(--jos-line)] py-3 first:border-t-0"
              >
                <span className="text-[15px] font-bold tabular-nums text-[var(--jos-muted)]">{number}</span>
                <div className="min-w-0">
                  <p className="text-[16px] font-semibold leading-snug">
                    {point.headline}
                    <span className="ml-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                      {label}
                    </span>
                  </p>
                  {spoken && spoken !== point.headline ? (
                    <p className="mt-0.5 text-[15px] leading-snug text-[var(--jos-muted)]">{spoken}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-[15px] text-[var(--jos-muted)]">No points yet. Build adds them, or add your own.</p>
      )}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {hidden > 0 ? (
          <button type="button" className={LINK} onClick={() => setShowAll(true)}>
            + {hidden} more
          </button>
        ) : null}
        <button type="button" className={LINK} onClick={() => setEditing(true)}>
          Edit points
        </button>
        <Link href={playbookId ? `/live/scripts/${playbookId}#questions` : "/live/playbooks"} className={LINK}>
          Add from question bank
        </Link>
      </p>
    </div>
  );
}

export function AfterBlockBody() {
  return <p className="text-[15px] text-[var(--jos-muted)]">Filled in on Debrief.</p>;
}

export function SheetRail({
  blocks,
  activeId,
  pointCount,
  dirtyTitles,
  readyAt,
  readyMessage,
  onJump,
}: {
  blocks: CallSheetBlock[];
  activeId: string | null;
  pointCount: number;
  dirtyTitles: Set<string>;
  readyAt: string | null;
  readyMessage: string | null;
  onJump: (block: CallSheetBlock) => void;
}) {
  const active = blocks.find((block) => block.id === activeId) ?? blocks[0] ?? null;
  return (
    <aside className="sticky top-[calc(var(--jos-nav-h)+24px)] space-y-8 self-start">
      {active ? (
        <section>
          <p className={LIVE_SECTION_LABEL}>The rule · {active.title}</p>
          <p className="mt-2 text-[17px] font-semibold leading-snug">
            {active.rule || "No rule on this block."}
          </p>
        </section>
      ) : null}
      <section>
        <p className={cn(LIVE_SECTION_LABEL, "border-b-2 border-[var(--jos-ink)] pb-2")}>This sheet</p>
        <ol>
          {blocks.map((block, index) => {
            const filled = blockIsFilled(block, pointCount);
            const needed = block.required && !filled;
            const dirty = dirtyTitles.has(block.title);
            const partial =
              block.kind === "lines" && !filled && block.lines.length
                ? `${filledLineCount(block)} of ${block.lines.length}`
                : null;
            return (
              <li key={block.id} className="border-b border-[var(--jos-line)]">
                <button
                  type="button"
                  onClick={() => onJump(block)}
                  className={cn(
                    "flex w-full items-center gap-2 py-2 text-left text-[15px] hover:bg-[color-mix(in_srgb,var(--jos-surface)_50%,transparent)]",
                    block.id === active?.id && "font-semibold"
                  )}
                >
                  {needed ? (
                    <WarningCircle size={18} weight="fill" className="shrink-0 text-[var(--color-accent-2)]" aria-label="Needed" />
                  ) : filled && block.kind !== "after" ? (
                    <CheckCircle size={18} weight="duotone" className="shrink-0 text-[var(--color-done)]" aria-label="Filled" />
                  ) : (
                    <Circle size={18} className="shrink-0 text-[var(--jos-muted)]" aria-label="Open" />
                  )}
                  <span className="tabular-nums text-[var(--jos-muted)]">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{block.title}</span>
                  {dirty ? (
                    <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--jos-ink)]">
                      Unsaved
                    </span>
                  ) : needed ? (
                    <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--color-accent-2-text)]">
                      Needed
                    </span>
                  ) : partial ? (
                    <span className="text-[12px] tabular-nums text-[var(--jos-muted)]">{partial}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
      <footer className="text-[14px] leading-snug">
        {readyAt ? (
          <p className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-done)]">
            <CheckCircle size={18} weight="duotone" aria-hidden />
            Ready {easternDateLong(readyAt)}, {easternClock(readyAt)}
          </p>
        ) : readyMessage ? (
          <p className="font-medium text-[var(--color-accent-2-text)]">{readyMessage}</p>
        ) : (
          <p className="text-[var(--jos-muted)]">Every required block is written. Mark it ready.</p>
        )}
      </footer>
    </aside>
  );
}

export function ReadyButton({
  readyAt,
  busy,
  onReady,
}: {
  readyAt: string | null;
  busy: boolean;
  onReady: () => void;
}) {
  if (readyAt) {
    return (
      <span className="inline-flex h-10 items-center gap-1.5 rounded-[2px] bg-[var(--color-done)] px-3 text-[14px] font-bold uppercase tracking-[0.06em] text-[var(--color-on-action)]">
        <CheckCircle size={18} weight="bold" aria-hidden />
        Ready
      </span>
    );
  }
  return (
    <Button type="button" disabled={busy} onClick={onReady}>
      {busy ? "Checking…" : "Ready"}
    </Button>
  );
}
