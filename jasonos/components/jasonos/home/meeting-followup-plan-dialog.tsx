"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MeetingFollowupDraftPlan } from "@/lib/outreach/meeting-followup-draft-plan";
import {
  draftMeetingFollowupMailto,
  type MeetingFollowup,
} from "@/lib/server-actions/meeting-followups";

type Props = {
  row: MeetingFollowup | null;
  plan: MeetingFollowupDraftPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDrafted?: (result: {
    mailtoUrl: string;
    fromTranscript: boolean;
    granola: boolean;
    confirmFacts: string[];
  }) => void;
};

/**
 * Jason approves the Follow-up Plan before any email prose is generated.
 * Approve & draft → compose from this card only → Apple Mail.
 * Edits in this modal are what get sent to compose — not the original scan.
 */
export function MeetingFollowupPlanDialog({
  row,
  plan: initialPlan,
  open,
  onOpenChange,
  onDrafted,
}: Props) {
  const [plan, setPlan] = useState<MeetingFollowupDraftPlan | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open || !initialPlan) return;
    // Always keep at least one editable owe row so Jason can add one when scan found none.
    const owes =
      initialPlan.jasonOwes.length > 0 ? [...initialPlan.jasonOwes] : [""];
    setPlan({
      ...initialPlan,
      jasonOwes: owes,
      proposedSlots: [...initialPlan.proposedSlots],
      proposedSlotLabels: [...initialPlan.proposedSlotLabels],
    });
  }, [open, initialPlan]);

  if (!row || !plan) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Follow-up plan</DialogTitle>
            <DialogDescription>Loading plan…</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const approve = () => {
    const trimmedHook = plan.hook?.trim() || null;
    const owes = plan.jasonOwes.map((item) => item.trim()).filter(Boolean);
    const offer = plan.theirOffer?.trim() || null;
    const approved: MeetingFollowupDraftPlan = {
      ...plan,
      hook: trimmedHook,
      jasonOwes: owes,
      theirOffer: offer,
    };
    start(async () => {
      const result = await draftMeetingFollowupMailto(row.id, approved);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
      onDrafted?.({
        mailtoUrl: result.mailtoUrl,
        fromTranscript: result.fromTranscript,
        granola: result.granola,
        confirmFacts: result.confirmFacts,
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Follow-up plan</DialogTitle>
          <DialogDescription>
            Approve these facts before JasonOS drafts the email for{" "}
            {plan.recipientFirstName}. Edits here are what the draft uses.
            Nothing opens in Mail until you approve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-[11px] text-muted-foreground">
            {row.title} · meeting was {plan.whenPhrase}
            {plan.firstMeeting ? " · first meeting" : ""}
          </p>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Hook
            </span>
            <Textarea
              value={plan.hook ?? ""}
              onChange={(event) =>
                setPlan({ ...plan, hook: event.target.value || null })
              }
              rows={2}
              placeholder="One specific thing they said"
              className="text-sm"
            />
          </label>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                You owe
              </span>
              <button
                type="button"
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                onClick={() =>
                  setPlan({ ...plan, jasonOwes: [...plan.jasonOwes, ""] })
                }
              >
                Add
              </button>
            </div>
            {plan.jasonOwes.map((item, index) => (
              <div key={`owe-${index}`} className="flex gap-1">
                <Input
                  value={item}
                  onChange={(event) => {
                    const next = [...plan.jasonOwes];
                    next[index] = event.target.value;
                    setPlan({ ...plan, jasonOwes: next });
                  }}
                  placeholder="Deliverable you owe — leave blank if none"
                  className="text-sm"
                />
                {plan.jasonOwes.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 px-2 text-muted-foreground"
                    onClick={() => {
                      const next = plan.jasonOwes.filter((_, i) => i !== index);
                      setPlan({
                        ...plan,
                        jasonOwes: next.length > 0 ? next : [""],
                      });
                    }}
                    aria-label="Remove owe"
                  >
                    ×
                  </Button>
                ) : null}
              </div>
            ))}
            {plan.jasonOwes.every((item) => !item.trim()) ? (
              <p className="text-[11px] text-muted-foreground">
                Left blank → draft will not invent a deliverable.
              </p>
            ) : null}
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              They offered
            </span>
            <Input
              value={plan.theirOffer ?? ""}
              onChange={(event) =>
                setPlan({
                  ...plan,
                  theirOffer: event.target.value || null,
                })
              }
              placeholder="What they offered — leave blank if none"
              className="text-sm"
            />
          </label>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Next step
            </span>
            <p className="text-sm">{plan.nextStep.label}</p>
            {plan.nextStep.kind === "schedule_call" ? (
              plan.proposedSlotLabels.length > 0 ? (
                <ul className="mt-1 space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                  {plan.proposedSlotLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No free windows found — draft will propose a weekday in words.
                  It will not ask them for times.
                </p>
              )
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={approve}>
            {pending ? "Drafting…" : "Approve & draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
