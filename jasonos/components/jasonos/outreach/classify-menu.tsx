"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CADENCE_HELPERS,
  CADENCE_INTERVALS,
  CADENCE_LABELS,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_HELPERS,
  RELATIONSHIP_TYPE_LABELS,
  type CadenceInterval,
  type RelationshipType,
} from "@/lib/outreach/types";
import {
  setCadence,
  setRelationshipType,
  toggleVip,
} from "@/lib/server-actions/outreach";

export interface ClassifyMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    name: string;
    relationship_type: RelationshipType | null | undefined;
    cadence_interval: CadenceInterval;
    vip: boolean;
  };
}

export function ClassifyMenu({ open, onOpenChange, contact }: ClassifyMenuProps) {
  const router = useRouter();
  const [type, setType] = useState<RelationshipType | null>(
    contact.relationship_type ?? null
  );
  const [cadence, setCadenceState] = useState<CadenceInterval>(
    contact.cadence_interval
  );
  const [vip, setVipState] = useState<boolean>(contact.vip);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const results = await Promise.all([
        type !== (contact.relationship_type ?? null)
          ? setRelationshipType(contact.id, type)
          : Promise.resolve({ ok: true as const }),
        cadence !== contact.cadence_interval
          ? setCadence(contact.id, cadence)
          : Promise.resolve({ ok: true as const }),
        vip !== contact.vip
          ? toggleVip(contact.id, vip)
          : Promise.resolve({ ok: true as const }),
      ]);
      const failure = results.find((r) => !r.ok);
      if (failure && "error" in failure) {
        toast.error(failure.error);
        return;
      }
      toast.success(`${contact.name} updated`);
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Classify {contact.name}</DialogTitle>
          <DialogDescription>
            Set who this person is to you and how often you want to stay in touch.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <Section title="Relationship">
            <div className="grid grid-cols-2 gap-1.5">
              {RELATIONSHIP_TYPES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={pillClass(type === value)}
                >
                  <div className="font-medium">{RELATIONSHIP_TYPE_LABELS[value]}</div>
                  <div
                    className={cn(
                      "text-[10px] font-normal",
                      type === value
                        ? "text-background/70"
                        : "text-muted-foreground/70"
                    )}
                  >
                    {RELATIONSHIP_TYPE_HELPERS[value]}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setType(null)}
                className={pillClass(type === null)}
              >
                <div className="font-medium">Unclassified</div>
                <div
                  className={cn(
                    "text-[10px] font-normal",
                    type === null
                      ? "text-background/70"
                      : "text-muted-foreground/70"
                  )}
                >
                  Decide later
                </div>
              </button>
            </div>
          </Section>

          <Section title="Cadence">
            <div className="grid grid-cols-3 gap-1.5">
              {CADENCE_INTERVALS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCadenceState(value)}
                  className={pillClass(cadence === value)}
                >
                  <div className="font-medium">{CADENCE_LABELS[value]}</div>
                  <div
                    className={cn(
                      "text-[10px] font-normal",
                      cadence === value
                        ? "text-background/70"
                        : "text-muted-foreground/70"
                    )}
                  >
                    {CADENCE_HELPERS[value]}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Flags">
            <button
              type="button"
              onClick={() => setVipState((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                vip
                  ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Star className={cn("h-3.5 w-3.5", vip ? "fill-amber-400" : "")} />
              {vip ? "VIP" : "Mark as VIP"}
            </button>
          </Section>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      {children}
    </div>
  );
}

function pillClass(selected: boolean) {
  return cn(
    "rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors",
    selected
      ? "border-foreground/60 bg-foreground text-background"
      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
  );
}
