"use client";

// Unified create modal — merges the legacy AddContactSheet (top-nav)
// and AddColdTargetDialog (/outreach/queue) into one component with two
// modes:
//   - "contact":         add a person you want to keep on cadence
//   - "outreach_target": add a cold target and start the First Contact
//                        Sequence (creates a recruiter pipeline card too)
//
// Mode is settable inline so the user can flip without closing the modal.
// Shared core fields are always visible; mode-specific fields appear in
// the relevant section.

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Sparkles, Star, Tag, UserPlus } from "lucide-react";
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
import { addCadenceContact } from "@/lib/server-actions/cadence";
import { addColdTarget } from "@/lib/server-actions/first-contact";
import {
  CADENCE_INTERVALS,
  CADENCE_LABELS,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LABELS,
  type CadenceInterval,
  type RelationshipType,
} from "@/lib/outreach/types";
import type { Intent } from "@/lib/triage/types";
import type { ReconnectContact } from "@/lib/reconnect/types";
import { cn } from "@/lib/utils";

export type CreateMode = "contact" | "outreach_target";
type Track = "advisors" | "job_search" | "venture" | "personal";

interface FormState {
  // Identity (shared)
  name: string;
  firm: string;
  title: string;
  linkedinUrl: string;
  email: string;
  // Classification (shared)
  relationshipType: RelationshipType | null;
  cadence: CadenceInterval;
  vip: boolean;
  // Notes (shared)
  notes: string;
  // Outreach-target only
  specialty: string;
  whyTarget: string;
  intent: Intent;
  personalGoal: string;
  track: Track;
}

const INITIAL: FormState = {
  name: "",
  firm: "",
  title: "",
  linkedinUrl: "",
  email: "",
  relationshipType: null,
  cadence: "monthly",
  vip: false,
  notes: "",
  specialty: "",
  whyTarget: "",
  intent: "door",
  personalGoal: "",
  track: "job_search",
};

export interface ContactCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial mode. Default "contact". */
  defaultMode?: CreateMode;
  /** Optional callback fired with the created contact id (and reconnect contact, when in outreach_target mode). */
  onCreated?: (payload: {
    contactId: string;
    cardId?: string;
    reconnectContact?: ReconnectContact;
  }) => void;
}

export function ContactCreateModal({
  open,
  onOpenChange,
  defaultMode = "contact",
  onCreated,
}: ContactCreateModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<CreateMode>(defaultMode);
  const [form, setForm] = useState<FormState>(() => ({
    ...INITIAL,
    // Outreach targets typically don't have a cadence yet (they're not
    // a relationship until first response). Default to none in that mode.
    cadence: defaultMode === "outreach_target" ? "none" : "monthly",
    relationshipType:
      defaultMode === "outreach_target" ? "prospect" : null,
  }));
  const [isPending, startTransition] = useTransition();

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setForm({
      ...INITIAL,
      cadence: mode === "outreach_target" ? "none" : "monthly",
      relationshipType: mode === "outreach_target" ? "prospect" : null,
    });
  };

  const switchMode = (next: CreateMode) => {
    setMode(next);
    // Re-baseline a couple of fields so defaults match the new mode
    setForm((current) => ({
      ...current,
      cadence:
        current.cadence === "none" || current.cadence === "monthly"
          ? next === "outreach_target" ? "none" : "monthly"
          : current.cadence,
      relationshipType:
        current.relationshipType ??
        (next === "outreach_target" ? "prospect" : null),
    }));
  };

  const canSubmit = useMemo(() => {
    if (!form.name.trim()) return false;
    if (mode === "outreach_target") {
      if (!form.firm.trim() || !form.title.trim()) return false;
    }
    return true;
  }, [form.name, form.firm, form.title, mode]);

  const submit = () => {
    if (!canSubmit) {
      toast.error(
        mode === "outreach_target"
          ? "Name, firm, and title are required for an outreach target."
          : "Name is required."
      );
      return;
    }

    startTransition(async () => {
      if (mode === "contact") {
        const result = await addCadenceContact({
          name: form.name,
          firm: form.firm,
          title: form.title,
          linkedinUrl: form.linkedinUrl,
          email: form.email,
          cadence: form.cadence,
          relationshipType: form.relationshipType,
          notes: form.notes,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          form.cadence === "none"
            ? `${form.name.trim()} added.`
            : `${form.name.trim()} added · ${cadenceLabel(form.cadence)} cadence.`
        );
        onCreated?.({ contactId: result.contactId });
        reset();
        onOpenChange(false);
        router.refresh();
        return;
      }

      // outreach_target mode
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
        relationshipType: form.relationshipType ?? "prospect",
        cadence: form.cadence,
        vip: form.vip,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Outreach target added");
      onCreated?.({
        contactId: result.contactId,
        cardId: result.cardId,
        reconnectContact: toLocalReconnectContact(
          result.contactId,
          result.cardId,
          form
        ),
      });
      reset();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            {mode === "outreach_target" ? (
              <Sparkles className="h-4 w-4 text-amber-400" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {mode === "outreach_target" ? "Add outreach target" : "Add contact"}
          </DialogTitle>
          <DialogDescription>
            {mode === "outreach_target"
              ? "Cold target with staged First Contact Sequence — creates a recruiter pipeline card too."
              : "Add someone you want to stay in touch with on a regular cadence."}
          </DialogDescription>

          {/* Mode toggle */}
          <div className="mt-3 inline-flex w-full rounded-md border bg-muted/30 p-0.5">
            <ModePill
              active={mode === "contact"}
              onClick={() => switchMode("contact")}
              icon={<UserPlus className="h-3 w-3" />}
              label="Add contact"
              hint="warm or known"
            />
            <ModePill
              active={mode === "outreach_target"}
              onClick={() => switchMode("outreach_target")}
              icon={<Sparkles className="h-3 w-3" />}
              label="Outreach sequence"
              hint="cold + staged"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3">
            {/* Identity */}
            <Field label="Name" required>
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Jane Doe"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Firm / Company"
                required={mode === "outreach_target"}
              >
                <Input
                  value={form.firm}
                  onChange={(e) => setField("firm", e.target.value)}
                  placeholder="Acme Co."
                />
              </Field>
              <Field
                label="Title"
                required={mode === "outreach_target"}
              >
                <Input
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Head of Product"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="LinkedIn URL">
                <Input
                  value={form.linkedinUrl}
                  onChange={(e) => setField("linkedinUrl", e.target.value)}
                  placeholder="https://www.linkedin.com/in/..."
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="jane@acme.com"
                />
              </Field>
            </div>

            {/* Classification */}
            <div className="mt-1 grid gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                Classification
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
                      onClick={() =>
                        setField(
                          "relationshipType",
                          form.relationshipType === value ? null : value
                        )
                      }
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition-colors",
                        form.relationshipType === value
                          ? "border-foreground/60 bg-foreground text-background"
                          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {RELATIONSHIP_TYPE_LABELS[value]}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Cadence">
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    {CADENCE_INTERVALS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setField("cadence", value)}
                        className={cn(
                          "rounded-md border px-2 py-1.5 text-[11px] transition-colors",
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
                      className={cn(
                        "h-3.5 w-3.5",
                        form.vip && "fill-amber-500 text-amber-500"
                      )}
                    />
                    {form.vip ? "VIP" : "Flag as VIP"}
                  </button>
                </Field>
              </div>
            </div>

            {/* Outreach-target only fields */}
            {mode === "outreach_target" ? (
              <div className="mt-1 grid gap-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  First Contact Sequence
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground/60">
                    feeds the staged-outreach playbook
                  </span>
                </div>

                <Field label="Specialty">
                  <Input
                    value={form.specialty}
                    onChange={(e) => setField("specialty", e.target.value)}
                    placeholder="e.g. exec search, partnerships..."
                  />
                </Field>

                <Field label="Why this target">
                  <Textarea
                    value={form.whyTarget}
                    onChange={(e) => setField("whyTarget", e.target.value)}
                    rows={2}
                    placeholder="What signal made them stand out?"
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Intent" required>
                    <select
                      value={form.intent}
                      onChange={(e) => setField("intent", e.target.value as Intent)}
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
                      onChange={(e) => setField("track", e.target.value as Track)}
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
                      onChange={(e) => setField("personalGoal", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {/* Notes (contact mode) */}
            {mode === "contact" ? (
              <Field label="Notes (optional)">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  rows={3}
                  placeholder="How you met, context, what you want to follow up on..."
                />
              </Field>
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-5 py-3">
          <div className="flex w-full items-center gap-2">
            {mode === "outreach_target" ? (
              <p className="hidden text-[10px] text-muted-foreground sm:block">
                Creates a contact AND a recruiter pipeline card. Use plain
                &quot;Add contact&quot; for warm relationships you just want
                on a cadence.
              </p>
            ) : (
              <p className="hidden text-[10px] text-muted-foreground sm:block">
                <CalendarClock className="mr-1 inline h-3 w-3" />
                {form.cadence === "none"
                  ? "No cadence — won't appear in the queue."
                  : `Will surface on ${cadenceLabel(form.cadence)} cadence.`}
              </p>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={isPending || !canSubmit}>
                {isPending
                  ? "Adding…"
                  : mode === "outreach_target"
                    ? "Add outreach target"
                    : "Add contact"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
        {required ? <span className="text-foreground"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function ModePill({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span className="text-[10px] font-normal text-muted-foreground/70">
        {hint}
      </span>
    </button>
  );
}

function cadenceLabel(cadence: CadenceInterval): string {
  return CADENCE_LABELS[cadence]?.toLowerCase() ?? cadence;
}

function toLocalReconnectContact(
  id: string,
  cardId: string,
  form: FormState
): ReconnectContact {
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
      form.whyTarget ||
      "Outreach target added manually. Use First Contact Sequence for staged outreach.",
    linkedin_url: form.linkedinUrl || undefined,
    last_contact_date: now,
    state: {
      recruiter_id: id,
      status: "queue",
      starred: false,
      updated_at: now,
    },
    notes: form.whyTarget
      ? [
          {
            id: `local-why-${Date.now()}`,
            recruiter_id: id,
            body: form.whyTarget,
            created_at: now,
          },
        ]
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
