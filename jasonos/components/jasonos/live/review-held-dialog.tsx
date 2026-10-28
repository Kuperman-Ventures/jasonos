"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DeckSummary } from "@/lib/server-actions/decks";
import {
  getDefaultRubric,
  getDeck,
  reviewRun,
  setDeckGoal,
  setRubric,
} from "@/lib/server-actions/decks";

export function ReviewHeldDialog({
  open,
  onOpenChange,
  deckId,
  title,
  initialGoal,
  playbooks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  title: string;
  initialGoal: string | null;
  playbooks: DeckSummary[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [goal, setGoal] = useState(initialGoal?.trim() ?? "");
  const [rubricSource, setRubricSource] = useState<string>("default");

  useEffect(() => {
    if (!open) return;
    setGoal(initialGoal?.trim() ?? "");
    setRubricSource("default");
    if (!initialGoal?.trim()) {
      void getDeck(deckId).then((result) => {
        if (result.ok && result.deck.goal?.trim()) {
          setGoal(result.deck.goal.trim());
        }
      });
    }
  }, [open, deckId, initialGoal]);

  const onReview = () => {
    start(async () => {
      const goalResult = await setDeckGoal(deckId, goal);
      if (!goalResult.ok) {
        toast.error(goalResult.error);
        return;
      }

      if (rubricSource === "default") {
        const defaultRubric = await getDefaultRubric();
        if (!defaultRubric.ok) {
          toast.error(defaultRubric.error);
          return;
        }
        const rubricResult = await setRubric(deckId, defaultRubric.rubric);
        if (!rubricResult.ok) {
          toast.error(rubricResult.error);
          return;
        }
      } else {
        const playbook = await getDeck(rubricSource);
        if (!playbook.ok) {
          toast.error(playbook.error);
          return;
        }
        const rubricResult = await setRubric(deckId, playbook.deck.rubric);
        if (!rubricResult.ok) {
          toast.error(rubricResult.error);
          return;
        }
      }

      const reviewed = await reviewRun(deckId);
      if (!reviewed.ok) {
        toast.error(reviewed.error);
        return;
      }
      toast.success("Review complete");
      onOpenChange(false);
      router.push(`/live/decks/${deckId}/review`);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2px] bg-[var(--jos-bg)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review {title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="review-held-goal" className="text-[13px] font-semibold">Goal</label>
            <Input
              id="review-held-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              className="mt-1.5 border-[var(--jos-line)] bg-[var(--jos-bg)]"
              placeholder="What you wanted from this call"
            />
          </div>

          <div>
            <p className="text-[13px] font-semibold">Rubric</p>
            <Select
              value={rubricSource}
              onValueChange={(value) => {
                if (value) setRubricSource(value);
              }}
            >
              <SelectTrigger className="mt-1.5 border-[var(--jos-line)] bg-[var(--jos-bg)]">
                <SelectValue placeholder="Default rubric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default rubric</SelectItem>
                {playbooks.map((playbook) => (
                  <SelectItem key={playbook.id} value={playbook.id}>
                    {playbook.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={() => onReview()}>
            {pending ? "Reviewing…" : "Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
