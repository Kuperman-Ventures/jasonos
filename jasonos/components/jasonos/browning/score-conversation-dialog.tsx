"use client";

// ScoreConversationDialog — the single most important component in the
// Browning module. Captures the 5-dimension self-score (Warmth, Patience,
// Advice-mode, Two-Referral Ask, Reciprocity) within minutes of a
// conversation ending, plus the structural metadata (date, channel,
// duration, referrals, thank-you, what-was-hard).
//
// Trigger surfaces:
//   1. /outreach/schedule auto-prompt right after a touch is logged on a
//      Browning-tagged contact (see outreach-modal.tsx hook).
//   2. The Unscored Conversations modal on home/`/browning`.
//   3. Pipeline tab row action.

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { scoreConversation } from "@/lib/server-actions/browning";
import {
  BROWNING_SCORE_KEYS,
  BROWNING_SCORE_LABELS,
  BROWNING_CHANNEL_LABELS,
  type BrowningChannel,
  type BrowningScoreKey,
  type ThankYouStatus,
} from "@/lib/browning/types";
import { scoreButtonClass } from "@/lib/browning/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  linkedTouchId?: string | null;
  /** ISO YYYY-MM-DD; defaults to today. */
  defaultDate?: string;
  defaultChannel?: BrowningChannel;
}

const CHANNELS: BrowningChannel[] = [
  "phone",
  "video",
  "in_person",
  "email",
  "linkedin",
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type ScoreState = Record<BrowningScoreKey, number | null>;

const EMPTY_SCORES: ScoreState = {
  warmth: null,
  patience: null,
  advice_mode: null,
  two_referral_ask: null,
  reciprocity: null,
};

export function ScoreConversationDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  linkedTouchId,
  defaultDate,
  defaultChannel = "phone",
}: Props) {
  const [date, setDate] = useState<string>(defaultDate ?? todayIso());
  const [channel, setChannel] = useState<BrowningChannel>(defaultChannel);
  const [duration, setDuration] = useState<string>("");
  const [scores, setScores] = useState<ScoreState>({ ...EMPTY_SCORES });
  const [referrals, setReferrals] = useState<number>(0);
  const [thankYou, setThankYou] = useState<ThankYouStatus>("pending");
  const [whatWasHard, setWhatWasHard] = useState("");
  const [whatToDo, setWhatToDo] = useState("");
  const [producedLead, setProducedLead] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Reset on (re)open so a fresh trigger never shows stale state from a
  // previous conversation. Yield to a microtask first to keep the
  // react-hooks/set-state-in-effect lint rule happy (matches the pattern in
  // OutreachModal).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setDate(defaultDate ?? todayIso());
      setChannel(defaultChannel);
      setDuration("");
      setScores({ ...EMPTY_SCORES });
      setReferrals(0);
      setThankYou("pending");
      setWhatWasHard("");
      setWhatToDo("");
      setProducedLead(false);
      setDiscardOpen(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, defaultDate, defaultChannel]);

  const dirty = useMemo(() => {
    if (BROWNING_SCORE_KEYS.some((k) => scores[k] !== null)) return true;
    if (duration) return true;
    if (referrals > 0) return true;
    if (thankYou !== "pending") return true;
    if (whatWasHard.trim() || whatToDo.trim()) return true;
    if (producedLead) return true;
    return false;
  }, [scores, duration, referrals, thankYou, whatWasHard, whatToDo, producedLead]);

  const allScored = BROWNING_SCORE_KEYS.every((k) => scores[k] !== null);

  const handleClose = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  };

  const setScore = (key: BrowningScoreKey, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!allScored) return;
    startTransition(async () => {
      const result = await scoreConversation({
        contactId,
        linkedTouchId: linkedTouchId ?? null,
        conversationDate: date,
        channel,
        durationMin: duration ? Math.max(0, Number(duration)) : null,
        warmth: scores.warmth!,
        patience: scores.patience!,
        adviceMode: scores.advice_mode!,
        twoReferralAsk: scores.two_referral_ask!,
        reciprocity: scores.reciprocity!,
        referralsReceived: referrals,
        thankYouSent: thankYou,
        whatWasHard: whatWasHard.trim() || undefined,
        whatToDoDifferently: whatToDo.trim() || undefined,
        producedLead,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Scored — keep it up.");
      onOpenChange(false);
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="flex max-h-[92vh] w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-5 py-4 pr-12">
            <DialogTitle>Score conversation with {contactName}</DialogTitle>
            <DialogDescription>
              60-second self-score. Captures how the conversation actually
              went — Warmth is the primary signal.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {/* Top metadata row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Date
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Channel
                </label>
                <Select
                  value={channel}
                  onValueChange={(v) => setChannel(v as BrowningChannel)}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {BROWNING_CHANNEL_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Duration (min, optional)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. 30"
                />
              </div>
            </div>

            {/* Score rows */}
            <div className="mt-5 space-y-3">
              {BROWNING_SCORE_KEYS.map((key) => {
                const meta = BROWNING_SCORE_LABELS[key];
                const isWarmth = key === "warmth";
                return (
                  <div
                    key={key}
                    className={cn(
                      "rounded-lg border bg-card/40 p-3 transition-colors",
                      isWarmth && "border-foreground/30 bg-foreground/[0.03]"
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-medium",
                              isWarmth ? "text-base" : "text-sm"
                            )}
                          >
                            {meta.label}
                          </span>
                          {isWarmth ? (
                            <span className="rounded-full border border-foreground/30 bg-foreground/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                              Primary signal
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {meta.hint}
                        </p>
                      </div>
                      <div
                        role="radiogroup"
                        aria-label={meta.label}
                        className="flex shrink-0 items-center gap-1"
                      >
                        {[1, 2, 3, 4, 5].map((value) => {
                          const active = scores[key] === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              autoFocus={isWarmth && value === 1 && open}
                              onClick={() => setScore(key, value)}
                              className={cn(
                                "h-9 w-9 rounded-md border text-sm font-semibold transition-colors",
                                scoreButtonClass(value, active)
                              )}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Structural follow-up rows */}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Referrals received
                </label>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    type="button"
                    onClick={() =>
                      setReferrals((n) => Math.max(0, n - 1))
                    }
                    aria-label="Decrease referrals"
                  >
                    −
                  </Button>
                  <span className="min-w-[2ch] text-center text-sm font-semibold">
                    {referrals}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    type="button"
                    onClick={() => setReferrals((n) => Math.min(20, n + 1))}
                    aria-label="Increase referrals"
                  >
                    +
                  </Button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Thank-you note sent
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(["yes", "no", "pending"] as ThankYouStatus[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setThankYou(v)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[11px] capitalize transition-colors",
                        thankYou === v
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  What was hard?
                </label>
                <Textarea
                  value={whatWasHard}
                  onChange={(e) => setWhatWasHard(e.target.value)}
                  rows={2}
                  className="text-xs"
                  placeholder="What did you avoid? What felt forced?"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  What to do differently next time?
                </label>
                <Textarea
                  value={whatToDo}
                  onChange={(e) => setWhatToDo(e.target.value)}
                  rows={2}
                  className="text-xs"
                  placeholder="One concrete adjustment for next conversation."
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={producedLead}
                  onCheckedChange={(v) => setProducedLead(Boolean(v))}
                />
                <span>Produced a lead (interview, intro, opportunity)</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => handleClose(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!allScored || pending}
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Save score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard confirmation — nested Dialog (still no Sheet/Drawer). */}
      <Dialog
        open={discardOpen}
        onOpenChange={(next) => setDiscardOpen(next)}
      >
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Discard your scoring?</DialogTitle>
            <DialogDescription>
              You&rsquo;ll lose the partial scores you&rsquo;ve entered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setDiscardOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              variant="destructive"
              type="button"
              onClick={() => {
                setDiscardOpen(false);
                onOpenChange(false);
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
