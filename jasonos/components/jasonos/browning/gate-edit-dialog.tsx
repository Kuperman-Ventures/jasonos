"use client";

import { useEffect, useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateGate } from "@/lib/server-actions/browning";
import {
  BROWNING_GATE_STATUS_LABELS,
  type BrowningGate,
  type BrowningGateStatus,
} from "@/lib/browning/types";

const STATUSES: BrowningGateStatus[] = [
  "not_started",
  "in_progress",
  "blocked_browning",
  "blocked_me",
  "completed",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gate: BrowningGate | null;
}

export function GateEditDialog({ open, onOpenChange, gate }: Props) {
  const [status, setStatus] = useState<BrowningGateStatus>("not_started");
  const [target, setTarget] = useState<string>("");
  const [completed, setCompleted] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !gate) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setStatus(gate.status);
      setTarget(gate.target_date ?? "");
      setCompleted(gate.completed_date ?? "");
      setNotes(gate.notes ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [open, gate]);

  // Auto-fill completed_date with today when status flips to completed.
  // Inlined into the status setter rather than a derived effect to avoid
  // react-hooks/set-state-in-effect.
  const handleStatusChange = (next: BrowningGateStatus) => {
    setStatus(next);
    if (next === "completed" && !completed) {
      setCompleted(new Date().toISOString().slice(0, 10));
    }
  };

  if (!gate) return null;

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateGate({
        gateCode: gate.gate_code,
        status,
        targetDate: target || null,
        completedDate: completed || null,
        notes,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Gate updated.");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Gate {gate.gate_code} · {gate.description}
          </DialogTitle>
          <DialogDescription>
            {gate.browning_sla
              ? `SLA: ${gate.browning_sla}`
              : "Update status, dates, or notes."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </label>
            <Select
              value={status}
              onValueChange={(v) => handleStatusChange(v as BrowningGateStatus)}
            >
              <SelectTrigger size="default" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {BROWNING_GATE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Target date
              </label>
              <Input
                type="date"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Completed date
              </label>
              <Input
                type="date"
                value={completed}
                onChange={(e) => setCompleted(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-xs"
              placeholder="What's blocking? What landed? Any specifics."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
