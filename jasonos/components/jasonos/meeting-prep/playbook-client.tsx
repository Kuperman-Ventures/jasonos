"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { StrategyFields } from "@/components/jasonos/meeting-prep/live-script-client";
import { InlineField, PointsEditor } from "@/components/jasonos/meeting-prep/points-editor";
import { LIVE_FIELD, LIVE_SECTION_LABEL, UnfinishedField } from "@/components/jasonos/live";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  BLOCK_KINDS,
  BLOCK_KIND_LABELS,
  BROWNING_BLOCK_KEYS,
  BROWNING_FAMILIES,
  FAMILY_LABELS,
  QUESTION_TOPICS,
  QUESTION_TOPIC_LABELS,
  blockKeyFromTitle,
  emptyDefault,
  readyGates,
  timeBudgetTotal,
  type BlockKind,
  type PlaybookBlock,
  type PlaybookLine,
  type PlaybookObjection,
  type PlaybookTimeBudget,
  type QuestionTopic,
} from "@/lib/meeting-prep/playbook-blocks";
import { REACTION_LABELS, REACTION_SHAPES, type ReactionShape } from "@/lib/meeting-prep/reactions";
import {
  createLiveScriptItem,
  createPlaybookQuestion,
  deleteLiveScript,
  deleteLiveScriptItem,
  deletePlaybookQuestion,
  draftScriptItemReactions,
  reorderLiveScriptItems,
  updateLiveScript,
  updateLiveScriptItem,
  type LiveScript,
  type LiveScriptItem,
  type PlaybookQuestion,
  type ScriptUsedOnMeeting,
} from "@/lib/server-actions/live-scripts";
import { cn } from "@/lib/utils";

const BROWNING_KEYS = new Set<string>(BROWNING_BLOCK_KEYS);

const LINK_BUTTON = "text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline";

function easternDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function budgetLabel(budget: PlaybookTimeBudget | null): string {
  if (!budget) return "No time budget";
  const parts = [
    budget.expectations != null ? `expectations ${budget.expectations}` : null,
    budget.rapport != null ? `rapport ${budget.rapport}` : null,
    budget.main != null ? `conversation ${budget.main}` : null,
    budget.close != null ? `close ${budget.close}` : null,
  ].filter(Boolean);
  return `${timeBudgetTotal(budget)} min (${parts.join(", ")})`;
}

function textDefault(block: PlaybookBlock): string {
  return typeof block.default === "string" ? block.default : "";
}

function linesDefault(block: PlaybookBlock): PlaybookLine[] {
  return Array.isArray(block.default) ? block.default : [];
}

function emptyTextLabel(kind: BlockKind): string {
  if (kind === "ask") return "Write the ask";
  if (kind === "after") return "Write the thank-you";
  return "Add default text";
}

function LinesEditor({
  lines,
  onSave,
}: {
  lines: PlaybookLine[];
  onSave: (next: PlaybookLine[]) => void;
}) {
  const replace = (index: number, patch: Partial<PlaybookLine>) =>
    onSave(lines.map((line, at) => (at === index ? { ...line, ...patch } : line)));

  return (
    <div className="space-y-4">
      {lines.length === 0 ? (
        <p className="text-[15px] text-[var(--jos-muted)]">No lines yet.</p>
      ) : (
        <ul className="space-y-4">
          {lines.map((line, index) => (
            <li key={`${index}-${line.label}`} className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <InlineField
                    value={line.label}
                    placeholder="Label"
                    emptyLabel="Label"
                    maxLength={120}
                    className={LIVE_SECTION_LABEL}
                    onSave={(next) => replace(index, { label: next.trim() })}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${line.label || "line"}`}
                  className="text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
                  onClick={() => onSave(lines.filter((_, at) => at !== index))}
                >
                  <X size={14} weight="bold" aria-hidden />
                </button>
              </div>
              <UnfinishedField
                value={line.text}
                multiline
                emptyLabel="Add a sentence"
                placeholder={line.label || "Line"}
                aria-label={line.label || "Line"}
                inputClassName="whitespace-pre-line text-[17px] leading-relaxed"
                onSave={(next) => replace(index, { text: next })}
              />
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={LINK_BUTTON}
        onClick={() => onSave([...lines, { label: "New line", text: "" }])}
      >
        Add line
      </button>
    </div>
  );
}

function BlockSection({
  index,
  block,
  onPatch,
  points,
}: {
  index: number;
  block: PlaybookBlock;
  onPatch: (patch: Partial<PlaybookBlock>) => void;
  points: ReactNode;
}) {
  let body: ReactNode;
  if (block.kind === "lines") {
    body = <LinesEditor lines={linesDefault(block)} onSave={(next) => onPatch({ default: next })} />;
  } else if (block.kind === "points") {
    body = points;
  } else {
    body = (
      <UnfinishedField
        value={textDefault(block)}
        multiline
        emptyLabel={emptyTextLabel(block.kind)}
        placeholder={block.title}
        aria-label={block.title}
        inputClassName="whitespace-pre-line text-[17px] leading-relaxed"
        onSave={(next) => onPatch({ default: next || null })}
      />
    );
  }

  return (
    <section
      id={`block-${block.key}`}
      className="grid gap-4 border-t border-[var(--jos-line)] py-6 min-[900px]:grid-cols-[minmax(0,1fr)_260px] min-[900px]:gap-8"
    >
      <div className="min-w-0 space-y-3">
        <div className="flex items-baseline gap-3">
          <span className="shrink-0 text-[13px] font-bold tabular-nums text-[var(--jos-muted)]">
            {index}
          </span>
          <div className="min-w-0 flex-1">
            <InlineField
              value={block.title}
              placeholder="Block title"
              emptyLabel="Block title"
              maxLength={120}
              className="text-[22px] font-extrabold tracking-tight text-[var(--jos-ink)]"
              onSave={(next) => {
                if (!next.trim()) {
                  toast.error("Name the block.");
                  return;
                }
                onPatch({ title: next.trim() });
              }}
            />
          </div>
          {block.required ? (
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-accent-2-text)]">
              Required
            </span>
          ) : null}
        </div>
        {body}
      </div>
      <aside className="space-y-1 min-[900px]:border-l min-[900px]:border-[var(--jos-line)] min-[900px]:pl-5">
        <p className={LIVE_SECTION_LABEL}>Rule</p>
        <UnfinishedField
          value={block.rule}
          multiline
          emptyLabel="Add a rule"
          placeholder="The rule for this block"
          aria-label={`Rule for ${block.title}`}
          inputClassName="text-[15px] leading-snug text-[var(--jos-muted)]"
          onSave={(next) => onPatch({ rule: next || null })}
        />
      </aside>
    </section>
  );
}

function BlocksControl({
  blocks,
  browning,
  onSave,
}: {
  blocks: PlaybookBlock[];
  browning: boolean;
  onSave: (next: PlaybookBlock[]) => void;
}) {
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<BlockKind>("text");
  const hasPoints = blocks.some((block) => block.kind === "points");
  const kinds = BLOCK_KINDS.filter((option) => option !== "points" || !hasPoints);

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onSave(next);
  };

  const remove = (key: string) => {
    setPendingRemove(null);
    onSave(blocks.filter((block) => block.key !== key));
  };

  const requestRemove = (block: PlaybookBlock) => {
    if (browning && BROWNING_KEYS.has(block.key)) {
      setPendingRemove(block.key);
      return;
    }
    remove(block.key);
  };

  const add = () => {
    const name = title.trim();
    if (!name) {
      toast.error("Name the block.");
      return;
    }
    const chosen = kinds.includes(kind) ? kind : "text";
    onSave([
      ...blocks,
      {
        key: blockKeyFromTitle(name, blocks.map((block) => block.key)),
        title: name,
        kind: chosen,
        required: false,
        default: emptyDefault(chosen),
        rule: null,
      },
    ]);
    setTitle("");
    setKind("text");
  };

  return (
    <div className="mt-5 border border-[var(--jos-ink)] bg-[var(--jos-surface)] px-4 py-3">
      <p className={LIVE_SECTION_LABEL}>Blocks</p>
      <ul className="mt-2 divide-y divide-[var(--jos-line)]">
        {blocks.map((block, index) => (
          <li key={block.key} className="flex flex-wrap items-center gap-3 py-2">
            <span className="w-6 text-[13px] font-bold tabular-nums text-[var(--jos-muted)]">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold">
              {block.title}
              <span className="ml-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                {BLOCK_KIND_LABELS[block.kind]}
              </span>
            </span>
            <label className="flex items-center gap-1.5 text-[13px]">
              <input
                type="checkbox"
                checked={block.required}
                onChange={(event) =>
                  onSave(
                    blocks.map((row) =>
                      row.key === block.key ? { ...row, required: event.target.checked } : row
                    )
                  )
                }
              />
              Required
            </label>
            <button
              type="button"
              aria-label={`Move ${block.title} up`}
              disabled={index === 0}
              className="text-[var(--jos-muted)] hover:text-[var(--jos-ink)] disabled:opacity-30"
              onClick={() => move(index, -1)}
            >
              <ArrowUp size={16} weight="bold" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Move ${block.title} down`}
              disabled={index === blocks.length - 1}
              className="text-[var(--jos-muted)] hover:text-[var(--jos-ink)] disabled:opacity-30"
              onClick={() => move(index, 1)}
            >
              <ArrowDown size={16} weight="bold" aria-hidden />
            </button>
            {pendingRemove === block.key ? (
              <span className="text-[13px]">
                Remove a Browning block?{" "}
                <button
                  type="button"
                  className="font-semibold text-[var(--color-accent-2-text)] hover:underline"
                  onClick={() => remove(block.key)}
                >
                  Confirm
                </button>
                {" · "}
                <button
                  type="button"
                  className="font-semibold hover:underline"
                  onClick={() => setPendingRemove(null)}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Remove ${block.title}`}
                className="text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
                onClick={() => requestRemove(block)}
              >
                <Trash size={16} weight="duotone" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--jos-line)] pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <input
          value={title}
          maxLength={120}
          placeholder="New block title"
          aria-label="New block title"
          className={cn(LIVE_FIELD, "h-9 min-w-0 flex-1 text-[15px]")}
          onChange={(event) => setTitle(event.target.value)}
        />
        <select
          aria-label="New block kind"
          value={kind}
          className="h-9 bg-transparent text-[12px] font-bold uppercase tracking-[0.1em] outline-none"
          onChange={(event) => setKind(event.target.value as BlockKind)}
        >
          {kinds.map((option) => (
            <option key={option} value={option}>
              {BLOCK_KIND_LABELS[option]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm">
          Add block
        </Button>
      </form>
    </div>
  );
}

function ObjectionsTable({
  objections,
  onSave,
}: {
  objections: PlaybookObjection[];
  onSave: (next: PlaybookObjection[]) => void;
}) {
  const [shape, setShape] = useState<ReactionShape>("agree");
  const [soundsLike, setSoundsLike] = useState("");
  const [pivot, setPivot] = useState("");

  const replace = (index: number, patch: Partial<PlaybookObjection>) =>
    onSave(objections.map((row, at) => (at === index ? { ...row, ...patch } : row)));

  return (
    <section className="space-y-3 border-t border-[var(--jos-ink)] py-6">
      <h2 className="text-[22px] font-extrabold tracking-tight">Objections</h2>
      {objections.length === 0 ? (
        <p className="text-[15px] text-[var(--jos-muted)]">No objections yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <thead>
              <tr className={LIVE_SECTION_LABEL}>
                <th className="w-48 pb-2 font-bold">Reaction</th>
                <th className="pb-2 font-bold">They say</th>
                <th className="pb-2 font-bold">Pivot</th>
                <th className="w-8 pb-2" />
              </tr>
            </thead>
            <tbody>
              {objections.map((row, index) => (
                <tr key={`${index}-${row.shape}`} className="border-t border-[var(--jos-line)] align-top">
                  <td className="py-2 pr-3">
                    <select
                      aria-label="Reaction"
                      value={row.shape}
                      className="bg-transparent text-[14px] font-semibold outline-none"
                      onChange={(event) => replace(index, { shape: event.target.value as ReactionShape })}
                    >
                      {REACTION_SHAPES.map((option) => (
                        <option key={option} value={option}>
                          {REACTION_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <InlineField
                      value={row.soundsLike}
                      placeholder="What they say"
                      emptyLabel="What they say"
                      maxLength={240}
                      className="text-[15px] leading-snug"
                      onSave={(next) => replace(index, { soundsLike: next.trim() })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <InlineField
                      value={row.pivot}
                      placeholder="Your pivot"
                      emptyLabel="Your pivot"
                      maxLength={400}
                      className="text-[15px] font-semibold leading-snug"
                      onSave={(next) => replace(index, { pivot: next.trim() })}
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      aria-label="Remove objection"
                      className="text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
                      onClick={() => onSave(objections.filter((_, at) => at !== index))}
                    >
                      <Trash size={16} weight="duotone" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form
        className="flex flex-wrap items-center gap-2 border-t border-[var(--jos-line)] pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!soundsLike.trim() || !pivot.trim()) {
            toast.error("Write what they say and your pivot.");
            return;
          }
          onSave([...objections, { shape, soundsLike: soundsLike.trim(), pivot: pivot.trim() }]);
          setSoundsLike("");
          setPivot("");
        }}
      >
        <select
          aria-label="Reaction for the new objection"
          value={shape}
          className="h-9 bg-transparent text-[14px] font-semibold outline-none"
          onChange={(event) => setShape(event.target.value as ReactionShape)}
        >
          {REACTION_SHAPES.map((option) => (
            <option key={option} value={option}>
              {REACTION_LABELS[option]}
            </option>
          ))}
        </select>
        <input
          value={soundsLike}
          maxLength={240}
          placeholder="They say"
          aria-label="They say"
          className={cn(LIVE_FIELD, "h-9 min-w-40 flex-1 text-[15px]")}
          onChange={(event) => setSoundsLike(event.target.value)}
        />
        <input
          value={pivot}
          maxLength={400}
          placeholder="Pivot"
          aria-label="Pivot"
          className={cn(LIVE_FIELD, "h-9 min-w-40 flex-1 text-[15px]")}
          onChange={(event) => setPivot(event.target.value)}
        />
        <Button type="submit" variant="secondary" size="sm">
          Add objection
        </Button>
      </form>
    </section>
  );
}

function QuestionsSection({
  playbookId,
  questions,
}: {
  playbookId: string;
  questions: PlaybookQuestion[];
}) {
  const router = useRouter();
  const [topic, setTopic] = useState<QuestionTopic>("industry");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const groups = QUESTION_TOPICS.map((key) => ({
    key,
    rows: questions.filter((question) => question.topic === key),
  })).filter((group) => group.rows.length > 0);

  const add = () => {
    if (!text.trim()) {
      toast.error("Write the question.");
      return;
    }
    setSaving(true);
    void createPlaybookQuestion({ playbookId, topic, text }).then((result) => {
      setSaving(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setText("");
      router.refresh();
    });
  };

  const remove = (id: string) => {
    void deletePlaybookQuestion(id).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="space-y-4 border-t border-[var(--jos-ink)] py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[22px] font-extrabold tracking-tight">Questions</h2>
        <Link href="/live/playbooks#questions" className={LINK_BUTTON}>
          Question bank
        </Link>
      </div>
      {groups.length === 0 ? (
        <p className="text-[15px] text-[var(--jos-muted)]">No questions yet.</p>
      ) : (
        <div className="grid gap-6 min-[900px]:grid-cols-2">
          {groups.map((group) => (
            <div key={group.key}>
              <p className={LIVE_SECTION_LABEL}>{QUESTION_TOPIC_LABELS[group.key]}</p>
              <ul className="mt-1 divide-y divide-[var(--jos-line)]">
                {group.rows.map((question) => {
                  const own = question.playbookId === playbookId;
                  return (
                    <li key={question.id} className="flex items-start gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold leading-snug">{question.text}</p>
                        {question.spoken ? (
                          <p className="mt-0.5 text-[14px] leading-snug text-[var(--jos-muted)]">
                            {question.spoken}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">
                          {own ? "This playbook" : question.source || "Shared"}
                        </p>
                      </div>
                      {own ? (
                        <button
                          type="button"
                          aria-label="Remove question"
                          className="mt-0.5 text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
                          onClick={() => remove(question.id)}
                        >
                          <Trash size={16} weight="duotone" aria-hidden />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      <form
        className="flex flex-wrap items-center gap-2 border-t border-[var(--jos-line)] pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <select
          aria-label="Topic for the new question"
          value={topic}
          className="h-9 bg-transparent text-[12px] font-bold uppercase tracking-[0.1em] outline-none"
          onChange={(event) => setTopic(event.target.value as QuestionTopic)}
        >
          {QUESTION_TOPICS.map((option) => (
            <option key={option} value={option}>
              {QUESTION_TOPIC_LABELS[option]}
            </option>
          ))}
        </select>
        <input
          value={text}
          maxLength={240}
          placeholder="Add a question to this playbook"
          aria-label="Add a question to this playbook"
          disabled={saving}
          className={cn(LIVE_FIELD, "h-9 min-w-0 flex-1 text-[15px]")}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" variant="secondary" size="sm" disabled={saving}>
          Add question
        </Button>
      </form>
    </section>
  );
}

export function PlaybookClient({
  script,
  items,
  questions,
  usedOn = [],
}: {
  script: LiveScript;
  items: LiveScriptItem[];
  questions: PlaybookQuestion[];
  usedOn?: ScriptUsedOnMeeting[];
}) {
  const router = useRouter();
  const blocksKey = JSON.stringify(script.blocks);
  const [blocks, setBlocks] = useState(script.blocks);
  const [seenBlocks, setSeenBlocks] = useState(blocksKey);
  if (blocksKey !== seenBlocks) {
    setSeenBlocks(blocksKey);
    setBlocks(script.blocks);
  }
  const objectionsKey = JSON.stringify(script.objections);
  const [objections, setObjections] = useState(script.objections);
  const [seenObjections, setSeenObjections] = useState(objectionsKey);
  if (objectionsKey !== seenObjections) {
    setSeenObjections(objectionsKey);
    setObjections(script.objections);
  }
  const [editingBlocks, setEditingBlocks] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const browning = BROWNING_FAMILIES.has(script.family);
  const gates = readyGates(blocks);
  const markable = items.some((item) => item.kind !== "agenda");
  const hasPointsBlock = blocks.some((block) => block.kind === "points");

  const saveBlocks = (next: PlaybookBlock[]) => {
    const previous = blocks;
    setBlocks(next);
    void updateLiveScript(script.id, { blocks: next }).then((result) => {
      if (!result.ok) {
        setBlocks(previous);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const patchBlock = (key: string, patch: Partial<PlaybookBlock>) =>
    saveBlocks(blocks.map((block) => (block.key === key ? { ...block, ...patch } : block)));

  const saveObjections = (next: PlaybookObjection[]) => {
    const previous = objections;
    setObjections(next);
    void updateLiveScript(script.id, { objections: next }).then((result) => {
      if (!result.ok) {
        setObjections(previous);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const saveName = (next: string) => {
    const name = next.trim();
    if (!name) {
      toast.error("Name the playbook.");
      return;
    }
    void updateLiveScript(script.id, { name }).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const remove = () => {
    setDeleting(true);
    void deleteLiveScript(script.id).then((result) => {
      setDeleting(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push("/live/playbooks");
      router.refresh();
    });
  };

  const pointsEditor = (
    <PointsEditor
      points={items}
      title={null}
      actions={{
        create: async (input) => {
          const result = await createLiveScriptItem({ scriptId: script.id, ...input });
          if (!result.ok) return result;
          return { ok: true, id: result.item.id };
        },
        update: (id, patch) => updateLiveScriptItem(id, patch),
        draftReactions: (id) => draftScriptItemReactions(id),
        remove: (id) => deleteLiveScriptItem(id),
        reorder: (ids) => reorderLiveScriptItems(script.id, ids),
      }}
    />
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 min-[900px]:px-10">
      <header className="border-b border-[var(--jos-ink)] py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={cn(LIVE_SECTION_LABEL, "text-[var(--color-accent-700)]")}>
              Playbook · {FAMILY_LABELS[script.family]}
            </p>
            <InlineField
              value={script.name}
              placeholder="Playbook name"
              emptyLabel="Playbook name"
              maxLength={120}
              className="mt-1 text-[36px] font-extrabold tracking-tight text-[var(--jos-ink)]"
              onSave={saveName}
            />
            <p className="mt-2 text-[14px] tabular-nums text-[var(--jos-muted)]">
              {blocks.length === 1 ? "1 block" : `${blocks.length} blocks`} · {budgetLabel(script.timeBudget)}
              {" · "}
              {gates.length ? `Ready needs ${gates.join(", ")}` : "No Ready gate"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant={editingBlocks ? "default" : "secondary"}
              size="sm"
              onClick={() => setEditingBlocks((open) => !open)}
            >
              {editingBlocks ? "Done" : "Blocks"}
            </Button>
            {markable ? (
              <Link
                href={`/live/scripts/${script.id}/rehearse`}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Rehearse
              </Link>
            ) : null}
            {confirmDelete ? (
              <p className="text-[13px]">
                Delete?{" "}
                <button
                  type="button"
                  className="font-semibold text-[var(--color-accent-2-text)] hover:underline"
                  disabled={deleting}
                  onClick={remove}
                >
                  Confirm
                </button>
                {" · "}
                <button type="button" className="font-semibold hover:underline" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </p>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>
        {editingBlocks ? <BlocksControl blocks={blocks} browning={browning} onSave={saveBlocks} /> : null}
      </header>

      {blocks.length === 0 ? (
        <p className="py-6 text-[15px] text-[var(--jos-muted)]">No blocks yet. Use Blocks to add some.</p>
      ) : (
        blocks.map((block, index) => (
          <BlockSection
            key={block.key}
            index={index + 1}
            block={block}
            onPatch={(patch) => patchBlock(block.key, patch)}
            points={pointsEditor}
          />
        ))
      )}

      {!hasPointsBlock ? (
        <section className="space-y-3 border-t border-[var(--jos-line)] py-6">
          <h2 className="text-[22px] font-extrabold tracking-tight">Points</h2>
          {pointsEditor}
        </section>
      ) : null}

      <ObjectionsTable objections={objections} onSave={saveObjections} />

      <QuestionsSection playbookId={script.id} questions={questions} />

      <section className="border-t border-[var(--jos-ink)] py-6">
        <h2 className="text-[22px] font-extrabold tracking-tight">Details</h2>
        <StrategyFields script={script} />
        <div className="mt-5">
          <p className={LIVE_SECTION_LABEL}>Used on</p>
          {usedOn.length === 0 ? (
            <p className="mt-1 text-[14px] text-[var(--jos-muted)]">Not used on a meeting yet.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {usedOn.map((meeting) => (
                <li key={meeting.id}>
                  <Link
                    href={`/meetings/${meeting.id}`}
                    className="text-[15px] font-semibold text-[var(--jos-ink)] hover:underline"
                  >
                    {meeting.title}
                    <span className="font-normal text-[var(--jos-muted)]">
                      {", "}
                      {easternDate(meeting.startsAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
