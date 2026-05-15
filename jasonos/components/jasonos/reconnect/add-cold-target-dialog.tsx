"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
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
import { addColdTarget } from "@/lib/server-actions/first-contact";
import {
  CADENCE_INTERVALS,
  CADENCE_LABELS,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LABELS,
  type CadenceInterval,
  type RelationshipType,
} from "@/lib/outreach/types";
import { cn } from "@/lib/utils";
import type { Intent } from "@/lib/triage/types";
import type { ReconnectContact } from "@/lib/reconnect/types";

type Track = "advisors" | "job_search" | "venture" | "personal";

interface FormState {
  name: string;
  firm: string;
  title: string;
  linkedinUrl: string;
  email: string;
  specialty: string;
  whyTarget: string;
  intent: Intent;
  personalGoal: string;
  track: Track;
  relationshipType: RelationshipType;
  cadence: CadenceInterval;
  vip: boolean;
}

const INITIAL: FormState = {
  name: "",
  firm: "",
  title: "",
  linkedinUrl: "",
  email: "",
  specialty: "",
  whyTarget: "",
  intent: "door",
  personalGoal: "",
  track: "job_search",
  relationshipType: "prospect",
  cadence: "none",
  vip: false,
};

export function AddColdTargetDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (contact: ReconnectContact) => void;
}) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [isPending, startTransition] = useTransition();

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = () => {
    startTransition(async () => {
      const result = await addColdTarget({
        name: form.name,
        firm: form.firm,
        title: form.title,
        linkedinUrl: form.linkedinUrl,
        email: form.email,
        specialty: form.specialty,
        whyTarget: form.whyTarget,
        intent: form.intent,
        personalGoal: form.personalGoal,
        track: form.track,
        relationshipType: form.relationshipType,
        cadence: form.cadence,
        vip: form.vip,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      onCreated(toLocalContact(result.contactId, result.cardId, form));
      toast.success("Outreach target added");
      setForm(INITIAL);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add outreach target</DialogTitle>
          <DialogDescription>
            Add a high-fit target and start the staged First Contact sequence.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={(event) => setField("name", event.target.value)} />
          </Field>
          <Field label="Firm" required>
            <Input value={form.firm} onChange={(event) => setField("firm", event.target.value)} />
          </Field>
          <Field label="Title" required>
            <Input value={form.title} onChange={(event) => setField("title", event.target.value)} />
          </Field>
          <Field label="LinkedIn URL">
            <Input
              value={form.linkedinUrl}
              onChange={(event) => setField("linkedinUrl", event.target.value)}
              placeholder="https://www.linkedin.com/in/..."
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
            />
          </Field>
          <Field label="Specialty">
            <Input
              value={form.specialty}
              onChange={(event) => setField("specialty", event.target.value)}
            />
          </Field>
          <Field label="Why this target">
            <Textarea
              value={form.whyTarget}
              onChange={(event) => setField("whyTarget", event.target.value)}
              rows={3}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Intent" required>
              <select
                value={form.intent}
                onChange={(event) => setField("intent", event.target.value as Intent)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
              >
                <option value="door">Door</option>
                <option value="pipeline">Pipeline</option>
                <option value="role_inquiry">Role inquiry</option>
                <option value="intel">Intel</option>
                <option value="warm">Warm</option>
              </select>
            </Field>
            <Field label="Track" required>
              <select
                value={form.track}
                onChange={(event) => setField("track", event.target.value as Track)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
              >
                <option value="job_search">Job search</option>
                <option value="advisors">Advisors</option>
                <option value="venture">Venture</option>
                <option value="personal">Personal</option>
              </select>
            </Field>
            <Field label="Personal goal">
              <Input
                value={form.personalGoal}
                onChange={(event) => setField("personalGoal", event.target.value)}
              />
            </Field>
          </div>

          <div className="mt-2 grid gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-3">
            <div className="text-xs font-medium text-muted-foreground">
              Outreach sorting
              <span className="ml-1 text-[10px] font-normal text-muted-foreground/60">
                shows up in People, Schedule, and filters
              </span>
            </div>

            <Field label="Relationship">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {RELATIONSHIP_TYPES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setField("relationshipType", value)}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-xs transition-colors",
                      form.relationshipType === value
                        ? "border-foreground bg-foreground text-background"
                        : "border-input bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {RELATIONSHIP_TYPE_LABELS[value]}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field label="Cadence">
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {CADENCE_INTERVALS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setField("cadence", value)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-xs transition-colors",
                        form.cadence === value
                          ? "border-foreground bg-foreground text-background"
                          : "border-input bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {CADENCE_LABELS[value]}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="VIP">
                <button
                  type="button"
                  onClick={() => setField("vip", !form.vip)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs transition-colors",
                    form.vip
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "border-input bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Star
                    className={cn("h-3.5 w-3.5", form.vip && "fill-amber-500 text-amber-500")}
                  />
                  {form.vip ? "VIP" : "Flag as VIP"}
                </button>
              </Field>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isPending || !form.name.trim() || !form.firm.trim() || !form.title.trim()}
          >
            {isPending ? "Adding..." : "Add outreach target"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function toLocalContact(id: string, cardId: string, form: FormState): ReconnectContact {
  const now = new Date().toISOString();
  return {
    id,
    name: form.name,
    firm: form.firm,
    firm_normalized: form.firm.toLowerCase(),
    title: form.title,
    specialty: form.specialty || undefined,
    source: "LeadDelta",
    tier: "TIER 1",
    strategic_score: 0,
    firm_fit_score: 0,
    practice_match_score: 0,
    recency_score: 0,
    signal_score: 0,
    strategic_recommended_approach:
      form.whyTarget || "Outreach target added manually. Use First Contact Sequence for staged outreach.",
    linkedin_url: form.linkedinUrl || undefined,
    last_contact_date: now,
    state: {
      recruiter_id: id,
      status: "queue",
      starred: false,
      updated_at: now,
    },
    notes: form.whyTarget
      ? [{ id: `local-why-${Date.now()}`, recruiter_id: id, body: form.whyTarget, created_at: now }]
      : [],
    touches: [],
    intent: form.intent,
    personal_goal: form.personalGoal || null,
    reconnect_object_type: "cold_target",
    has_open_reconnect_card: true,
    first_contact_card_id: cardId,
    first_contact: {
      stage: "identified",
      history: [{ stage: "identified", at: now }],
    },
    why_target: form.whyTarget || null,
  };
}
