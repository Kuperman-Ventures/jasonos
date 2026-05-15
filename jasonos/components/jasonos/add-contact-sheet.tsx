"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Tag } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addCadenceContact } from "@/lib/server-actions/cadence";
import {
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LABELS,
  type CadenceInterval,
  type RelationshipType,
} from "@/lib/outreach/types";
import { cn } from "@/lib/utils";

interface FormState {
  name: string;
  firm: string;
  title: string;
  linkedinUrl: string;
  email: string;
  cadence: CadenceInterval;
  relationshipType: RelationshipType | null;
  notes: string;
}

const INITIAL: FormState = {
  name: "",
  firm: "",
  title: "",
  linkedinUrl: "",
  email: "",
  cadence: "monthly",
  relationshipType: null,
  notes: "",
};

const CADENCE_CHOICES: { value: CadenceInterval; label: string; helper: string }[] = [
  { value: "weekly", label: "Weekly", helper: "every 7 days" },
  { value: "biweekly", label: "Biweekly", helper: "every 2 weeks" },
  { value: "monthly", label: "Monthly", helper: "every 30 days" },
  { value: "quarterly", label: "Quarterly", helper: "every 90 days" },
  { value: "none", label: "No cadence", helper: "I'll schedule manually" },
];

export function AddContactSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (contactId: string) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [isPending, startTransition] = useTransition();

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reset = () => setForm(INITIAL);

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }

    startTransition(async () => {
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
      onCreated?.(result.contactId);
      reset();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add contact</SheetTitle>
          <SheetDescription>
            Quick-add someone you want to stay in touch with. They&apos;ll show up
            in Communications on the cadence you pick.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4">
          <div className="grid gap-3 pb-4">
            <Field label="Name" required>
              <Input
                autoFocus
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                placeholder="Jane Doe"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Firm / Company">
                <Input
                  value={form.firm}
                  onChange={(event) => setField("firm", event.target.value)}
                  placeholder="Acme Co."
                />
              </Field>
              <Field label="Title">
                <Input
                  value={form.title}
                  onChange={(event) => setField("title", event.target.value)}
                  placeholder="Head of Product"
                />
              </Field>
            </div>
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
                placeholder="jane@acme.com"
              />
            </Field>

            <div className="mt-2 grid gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                Relationship
                <span className="ml-1 text-[10px] font-normal text-muted-foreground/60">
                  optional — you can classify later
                </span>
              </div>
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
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                Cadence <span className="text-foreground">*</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {CADENCE_CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => setField("cadence", choice.value)}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition-colors",
                      form.cadence === choice.value
                        ? "border-foreground/60 bg-foreground text-background"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div>{choice.label}</div>
                    <div
                      className={cn(
                        "text-[10px] font-normal",
                        form.cadence === choice.value
                          ? "text-background/70"
                          : "text-muted-foreground/70"
                      )}
                    >
                      {choice.helper}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Field label="Notes (optional)">
              <Textarea
                value={form.notes}
                onChange={(event) => setField("notes", event.target.value)}
                rows={3}
                placeholder="How you met, context, what you want to follow up on..."
              />
            </Field>
          </div>
        </div>

        <SheetFooter className="border-t bg-card/40">
          <div className="flex w-full items-center justify-end gap-2">
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
            <Button onClick={submit} disabled={isPending || !form.name.trim()}>
              {isPending ? "Adding…" : "Add contact"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
        {required ? <span className="text-foreground"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function cadenceLabel(cadence: CadenceInterval): string {
  const found = CADENCE_CHOICES.find((c) => c.value === cadence);
  return found ? found.label.toLowerCase() : cadence;
}
