"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  filterPhrases,
  labelForTag,
  normalizePhrase,
  suggestTagsForPhrase,
  tagOptionsForField,
  type BuilderPhrase,
  type PhraseField,
} from "@/lib/email-builder/phrases";
import {
  confirmBuilderPhrase,
  useBuilderPhrase,
} from "@/lib/server-actions/email-builder-phrases";

/**
 * Free-text Builder field with global tip chips + tag confirm on blur.
 * Tapping a tip fills the field. Typing a new phrase → confirm tags → save.
 */
export function PhraseMemoryField({
  field,
  label,
  hint,
  value,
  onChange,
  placeholder,
  multiline,
  phrases,
  onPhrasesChange,
}: {
  field: PhraseField;
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  multiline?: boolean;
  phrases: BuilderPhrase[];
  onPhrasesChange: (next: BuilderPhrase[]) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Snapshot of the value when confirm opened — ignore if user kept editing.
  const [pendingPhrase, setPendingPhrase] = useState("");

  const tips = useMemo(
    () => filterPhrases(phrases, field, value, 8),
    [phrases, field, value]
  );

  const knownNorms = useMemo(() => {
    const set = new Set<string>();
    for (const p of phrases) {
      if (p.field === field) set.add(normalizePhrase(p.phrase));
    }
    return set;
  }, [phrases, field]);

  const tagOptions = tagOptionsForField(field);

  const openConfirmIfNeeded = (raw: string) => {
    const trimmed = raw.replace(/\s+/g, " ").trim();
    if (trimmed.length < 2) {
      setConfirmOpen(false);
      return;
    }
    const norm = normalizePhrase(trimmed);
    const existing = phrases.find(
      (p) => p.field === field && normalizePhrase(p.phrase) === norm
    );
    // Already saved with tags — bump happens on tip tap; no nag.
    if (existing && existing.tags.length > 0) {
      setConfirmOpen(false);
      return;
    }
    setPendingPhrase(trimmed);
    setPendingTags(
      existing?.tags?.length
        ? existing.tags
        : suggestTagsForPhrase(field, trimmed)
    );
    setConfirmOpen(true);
  };

  // If value cleared, close confirm.
  useEffect(() => {
    if (!value.trim()) setConfirmOpen(false);
  }, [value]);

  const toggleTag = (key: string) => {
    setPendingTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  const saveTip = async () => {
    const phrase =
      pendingPhrase.trim() || value.replace(/\s+/g, " ").trim();
    if (!phrase) return;
    setSaving(true);
    const res = await confirmBuilderPhrase({
      field,
      phrase,
      tags: pendingTags,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onPhrasesChange(upsertLocal(phrases, res.phrase));
    setConfirmOpen(false);
    toast.success("Tip saved — it’ll show up as a chip next time.");
  };

  const tapTip = async (tip: BuilderPhrase) => {
    onChange(tip.phrase);
    setConfirmOpen(false);
    const res = await useBuilderPhrase(tip.id);
    if (res.ok) onPhrasesChange(upsertLocal(phrases, res.phrase));
  };

  return (
    <div className="block space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}{" "}
          {hint ? (
            <span className="font-normal normal-case text-muted-foreground/70">
              {hint}
            </span>
          ) : null}
        </span>
      </div>

      {tips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tips.map((tip) => {
            const active =
              normalizePhrase(value) === normalizePhrase(tip.phrase);
            return (
              <button
                key={tip.id}
                type="button"
                onClick={() => void tapTip(tip)}
                title={
                  tip.tags.length
                    ? tip.tags.map(labelForTag).join(" · ")
                    : tip.phrase
                }
                className={cn(
                  "max-w-full truncate rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  active
                    ? "border-orange-300/50 bg-orange-500/15 text-orange-100"
                    : "border-border bg-background/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
              >
                {tip.phrase}
              </button>
            );
          })}
        </div>
      ) : knownNorms.size === 0 ? (
        <p className="text-[10px] text-muted-foreground/80">
          Tips you save here show up as tap chips for every contact.
        </p>
      ) : null}

      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => openConfirmIfNeeded(value)}
          placeholder={placeholder}
          className="min-h-[72px] text-sm"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => openConfirmIfNeeded(value)}
          placeholder={placeholder}
          className="h-9 text-sm"
        />
      )}

      {confirmOpen ? (
        <div className="space-y-2 rounded-lg border border-orange-300/30 bg-orange-500/5 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Confirm tags for this tip
              </p>
              <p className="truncate text-[11px] text-foreground/90">
                “{pendingPhrase || value.trim()}”
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tagOptions.map((opt) => {
              const on = pendingTags.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleTag(opt.key)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                    on
                      ? "border-orange-300/50 bg-orange-500/15 text-orange-100"
                      : "border-border bg-background/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
            >
              Skip
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void saveTip()}
              disabled={saving}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save tip"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function upsertLocal(
  list: BuilderPhrase[],
  phrase: BuilderPhrase
): BuilderPhrase[] {
  const without = list.filter((p) => p.id !== phrase.id);
  // Also drop any same field+norm under a different id (shouldn't happen)
  const norm = normalizePhrase(phrase.phrase);
  const cleaned = without.filter(
    (p) => !(p.field === phrase.field && normalizePhrase(p.phrase) === norm)
  );
  return [phrase, ...cleaned];
}
