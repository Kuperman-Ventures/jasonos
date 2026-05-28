"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Star, Trash2 } from "lucide-react";
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
import {
  upsertDeliverable,
  deleteDeliverable,
} from "@/lib/server-actions/browning";
import {
  BROWNING_DELIVERED_STATUS_LABELS,
  type BrowningDeliverable,
  type BrowningDeliveredStatus,
} from "@/lib/browning/types";
import { firstOfMonth } from "@/lib/browning/format";
import { cn } from "@/lib/utils";

const STATUSES: BrowningDeliveredStatus[] = [
  "yes_on_time",
  "yes_late",
  "partial",
  "no",
  "na",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliverable: BrowningDeliverable | null;
}

export function DeliverableDialog({ open, onOpenChange, deliverable }: Props) {
  const [month, setMonth] = useState<string>(firstOfMonth());
  const [promised, setPromised] = useState("");
  const [status, setStatus] = useState<BrowningDeliveredStatus | "unset">("unset");
  const [onTime, setOnTime] = useState<boolean>(false);
  const [quality, setQuality] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [escalate, setEscalate] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (deliverable) {
        setMonth(deliverable.month);
        setPromised(deliverable.promised);
        setStatus(deliverable.delivered_status ?? "unset");
        setOnTime(Boolean(deliverable.on_time));
        setQuality(deliverable.quality ?? null);
        setNotes(deliverable.notes ?? "");
        setEscalate(deliverable.escalate);
      } else {
        setMonth(firstOfMonth());
        setPromised("");
        setStatus("unset");
        setOnTime(false);
        setQuality(null);
        setNotes("");
        setEscalate(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, deliverable]);

  const handleSave = () => {
    if (!promised.trim()) {
      toast.error("Describe what Browning promised.");
      return;
    }
    startTransition(async () => {
      const result = await upsertDeliverable({
        id: deliverable?.id,
        month,
        promised,
        deliveredStatus: status === "unset" ? null : status,
        onTime,
        quality,
        notes,
        escalate,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(deliverable ? "Updated." : "Logged.");
      onOpenChange(false);
    });
  };

  const handleDelete = () => {
    if (!deliverable) return;
    startDeleteTransition(async () => {
      const result = await deleteDeliverable({ id: deliverable.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Deleted.");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {deliverable ? "Edit Browning deliverable" : "Log Browning deliverable"}
          </DialogTitle>
          <DialogDescription>
            What did Browning promise this month, and did they deliver?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Month
            </label>
            <Input
              type="month"
              value={month.slice(0, 7)}
              onChange={(e) => setMonth(`${e.target.value}-01`)}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Promised
            </label>
            <Textarea
              value={promised}
              onChange={(e) => setPromised(e.target.value)}
              rows={2}
              className="text-xs"
              placeholder='e.g. "Resume + executive bio delivered by mid-month"'
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Delivered status
              </label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setStatus(v as BrowningDeliveredStatus | "unset")
                }
              >
                <SelectTrigger size="default" className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">— Not yet</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {BROWNING_DELIVERED_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quality (1–5)
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-label={`${v} of 5`}
                    onClick={() =>
                      setQuality((cur) => (cur === v ? null : v))
                    }
                    className={cn(
                      "rounded-md p-1 transition-colors",
                      quality !== null && v <= quality
                        ? "text-amber-300"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        quality !== null && v <= quality
                          ? "fill-amber-300"
                          : ""
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={onTime}
                onCheckedChange={(v) => setOnTime(Boolean(v))}
              />
              <span>On time</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={escalate}
                onCheckedChange={(v) => setEscalate(Boolean(v))}
              />
              <span className="text-amber-300">Escalate</span>
            </label>
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
              placeholder="What was delivered? What was missing? What did you flag?"
            />
          </div>
        </div>

        <DialogFooter className="flex-row! justify-between!">
          {deliverable ? (
            <Button
              variant="destructive"
              type="button"
              size="sm"
              onClick={handleDelete}
              disabled={deletePending}
            >
              {deletePending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={pending}>
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
