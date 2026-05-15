"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, HelpCircle, Sparkles, Star } from "lucide-react";
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
  CLASSIFIER_START_STEP_ID,
  CLASSIFIER_STEPS,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_HELPERS,
  RELATIONSHIP_TYPE_LABELS,
  RELATIONSHIP_TYPE_META,
  type CadenceInterval,
  type ClassifierStep,
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

function findStep(id: string): ClassifierStep | null {
  return CLASSIFIER_STEPS.find((step) => step.id === id) ?? null;
}

export function ClassifyMenu({ open, onOpenChange, contact }: ClassifyMenuProps) {
  const router = useRouter();
  const initialType = contact.relationship_type ?? null;
  const [type, setType] = useState<RelationshipType | null>(initialType);
  const [cadence, setCadenceState] = useState<CadenceInterval>(
    contact.cadence_interval
  );
  const [vip, setVipState] = useState<boolean>(contact.vip);
  const [isPending, startTransition] = useTransition();

  // Decision-tree state
  const [walkerOpen, setWalkerOpen] = useState(false);
  const [walkerStepId, setWalkerStepId] = useState<string>(
    CLASSIFIER_START_STEP_ID
  );
  const [walkerBack, setWalkerBack] = useState<string[]>([]);

  // When changing relationship type, if user hasn't set a cadence yet,
  // pre-select the type's recommended default so they can see the rhythm
  // that will be applied. They can still override.
  const pickType = (next: RelationshipType | null) => {
    setType(next);
    if (next && cadence === "none") {
      const defaultCadence = RELATIONSHIP_TYPE_META[next].defaultCadence;
      if (defaultCadence !== "none") {
        setCadenceState(defaultCadence);
      }
    }
  };

  const meta = type ? RELATIONSHIP_TYPE_META[type] : null;

  const walkerStep = useMemo<ClassifierStep | null>(() => {
    if (!walkerOpen) return null;
    return findStep(walkerStepId);
  }, [walkerOpen, walkerStepId]);

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
      <DialogContent className="z-[60] max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Classify {contact.name}</DialogTitle>
          <DialogDescription>
            Set who this person is to you and how often you want to stay in touch.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {walkerStep ? (
            <WalkerStep
              step={walkerStep}
              backDisabled={walkerBack.length === 0}
              onBack={() => {
                const prev = walkerBack[walkerBack.length - 1];
                if (!prev) return;
                setWalkerBack((s) => s.slice(0, -1));
                setWalkerStepId(prev);
              }}
              onCancel={() => {
                setWalkerOpen(false);
                setWalkerStepId(CLASSIFIER_START_STEP_ID);
                setWalkerBack([]);
              }}
              onChoose={(option) => {
                if (option.result) {
                  pickType(option.result);
                  setWalkerOpen(false);
                  setWalkerStepId(CLASSIFIER_START_STEP_ID);
                  setWalkerBack([]);
                  toast.success(
                    `Suggested: ${RELATIONSHIP_TYPE_LABELS[option.result]}`
                  );
                  return;
                }
                if (option.next) {
                  setWalkerBack((s) => [...s, walkerStepId]);
                  setWalkerStepId(option.next);
                }
              }}
            />
          ) : (
            <>
              <Section
                title="Relationship"
                action={
                  <button
                    type="button"
                    onClick={() => setWalkerOpen(true)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="h-3 w-3" />
                    Help me classify
                  </button>
                }
              >
                <div className="grid grid-cols-2 gap-1.5">
                  {RELATIONSHIP_TYPES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => pickType(value)}
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
                    onClick={() => pickType(null)}
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

                {meta ? (
                  <div className="mt-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-2.5 text-[11px] leading-relaxed">
                    <div className="font-semibold text-foreground">
                      <Sparkles className="mr-1 inline h-3 w-3" />
                      What this relationship is for
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {meta.objective}
                    </div>
                    <div className="mt-2 grid gap-1">
                      <Meta label="Tone" value={meta.tone} />
                      <Meta label="Typical moves" value={meta.typicalActivities} />
                    </div>
                  </div>
                ) : null}
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
                {type && cadence === RELATIONSHIP_TYPE_META[type].defaultCadence ? (
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    Default for {RELATIONSHIP_TYPE_LABELS[type]}.
                  </p>
                ) : null}
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
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending || walkerOpen}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WalkerStep({
  step,
  backDisabled,
  onBack,
  onCancel,
  onChoose,
}: {
  step: ClassifierStep;
  backDisabled: boolean;
  onBack: () => void;
  onCancel: () => void;
  onChoose: (option: ClassifierStep["options"][number]) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Help me classify
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Skip
        </button>
      </div>
      <div className="text-sm font-medium leading-snug">{step.question}</div>
      {step.subtext ? (
        <div className="text-[11px] text-muted-foreground">{step.subtext}</div>
      ) : null}
      <div className="grid gap-1.5">
        {step.options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onChoose(option)}
            className={pillClass(false) + " w-full"}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onBack}
        disabled={backDisabled}
        className="inline-flex items-center gap-1 self-start text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <ArrowLeft className="h-3 w-3" />
        Back
      </button>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label}
      </span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {action}
      </div>
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
