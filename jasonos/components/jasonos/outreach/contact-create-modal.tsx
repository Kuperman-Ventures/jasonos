"use client";

// Identity-only Add Contact modal.
//
// Every contact created here starts unclassified — no relationship_type,
// no cadence, no VIP flag, no intent pin, no auto-enrolled First-Contact
// Sequence, no recruiter pipeline card. After the row is created, the
// OutreachModal opens for the freshly-created contact so the user can set
// Intent + Relationship from the contact card.
//
// Classification flows entirely through the contact card. The CSV importer
// is the only path that ships its own classification (handled separately
// in `bulkInsertContacts`).

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
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
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import { createContactUnclassified } from "@/lib/server-actions/contacts";
import type { BrowningSource } from "@/lib/browning/types";
import {
  NETWORK_DEGREES,
  NETWORK_DEGREE_LABELS,
  RELEVANCE_TIERS,
  RELEVANCE_TIER_LABELS,
  type NetworkDegree,
  type RelevanceTier,
} from "@/lib/outreach/types";

type BrowningChoice = "none" | BrowningSource;

interface FormState {
  name: string;
  title: string;
  firm: string;
  email: string;
  linkedinUrl: string;
  browning: BrowningChoice;
  relevance: RelevanceTier | "";
  degree: NetworkDegree | "";
}

const INITIAL: FormState = {
  name: "",
  title: "",
  firm: "",
  email: "",
  linkedinUrl: "",
  browning: "none",
  relevance: "",
  degree: "",
};

export interface ContactCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional callback fired with the created contact id. */
  onCreated?: (payload: { contactId: string }) => void;
}

interface CreatedContact {
  id: string;
  name: string;
  title: string | null;
  firm: string | null;
  primary_email: string | null;
  linkedin_url: string | null;
}

export function ContactCreateModal({
  open,
  onOpenChange,
  onCreated,
}: ContactCreateModalProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [isPending, startTransition] = useTransition();
  const [classifyTarget, setClassifyTarget] = useState<CreatedContact | null>(
    null
  );

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reset = () => setForm(INITIAL);

  const canSubmit = form.name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) {
      toast.error("Name is required.");
      return;
    }

    startTransition(async () => {
      const name = form.name.trim();
      const title = form.title.trim() || null;
      const firm = form.firm.trim() || null;
      const email = form.email.trim() || null;
      const linkedinUrl = form.linkedinUrl.trim() || null;

      const result = await createContactUnclassified({
        name,
        title,
        firm,
        email,
        linkedin_url: linkedinUrl,
        browning_source: form.browning === "none" ? null : form.browning,
        relevance_tier: form.relevance || null,
        network_degree: form.degree || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`${name} added — classify them in the contact card`);
      onCreated?.({ contactId: result.contactId });
      router.refresh();

      const created: CreatedContact = {
        id: result.contactId,
        name,
        title,
        firm,
        primary_email: email,
        linkedin_url: linkedinUrl,
      };
      reset();
      onOpenChange(false);
      setClassifyTarget(created);
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex max-h-[90vh] w-full max-w-lg flex-col gap-0 p-0 sm:max-w-lg"
        >
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add contact
            </DialogTitle>
            <DialogDescription>
              We won&rsquo;t classify them yet — open the contact to set
              intent and relationship after.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="grid gap-3">
              <Field label="Name" required>
                <Input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Jane Doe"
                />
              </Field>
              <Field label="Title">
                <Input
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Head of Product"
                />
              </Field>
              <Field label="Firm / Company">
                <Input
                  value={form.firm}
                  onChange={(e) => setField("firm", e.target.value)}
                  placeholder="Acme Co."
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
              <Field label="LinkedIn URL">
                <Input
                  value={form.linkedinUrl}
                  onChange={(e) => setField("linkedinUrl", e.target.value)}
                  placeholder="https://www.linkedin.com/in/..."
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Relevance (A/B/C)">
                  <div className="flex gap-1.5">
                    {(["", ...RELEVANCE_TIERS] as (RelevanceTier | "")[]).map(
                      (t) => {
                        const active = form.relevance === t;
                        return (
                          <button
                            key={t || "none"}
                            type="button"
                            title={t ? RELEVANCE_TIER_LABELS[t] : "Unset"}
                            onClick={() => setField("relevance", t)}
                            className={
                              "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors " +
                              (active
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")
                            }
                          >
                            {t || "—"}
                          </button>
                        );
                      }
                    )}
                  </div>
                </Field>
                <Field label="Network degree (1/2/3)">
                  <div className="flex gap-1.5">
                    {(["", ...NETWORK_DEGREES] as (NetworkDegree | "")[]).map(
                      (d) => {
                        const active = form.degree === d;
                        return (
                          <button
                            key={d || "none"}
                            type="button"
                            title={d ? NETWORK_DEGREE_LABELS[d] : "Unset"}
                            onClick={() => setField("degree", d)}
                            className={
                              "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors " +
                              (active
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")
                            }
                          >
                            {d || "—"}
                          </button>
                        );
                      }
                    )}
                  </div>
                </Field>
              </div>
              <Field label="Browning">
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { value: "none", label: "Not Browning" },
                      { value: "my_list", label: "My List" },
                      { value: "browning_referral", label: "Browning Referral" },
                    ] as { value: BrowningChoice; label: string }[]
                  ).map((opt) => {
                    const active = form.browning === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setField("browning", opt.value)}
                        className={
                          "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors " +
                          (active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")
                        }
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Is this someone from your own list, or a person Browning
                  connected you to? Choosing either enrolls them in Browning.
                </span>
              </Field>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-5 py-3">
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
                {isPending ? "Adding…" : "Add contact"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {classifyTarget ? (
        <OutreachModal
          open={Boolean(classifyTarget)}
          onOpenChange={(o) => {
            if (!o) {
              setClassifyTarget(null);
              router.refresh();
            }
          }}
          contactId={classifyTarget.id}
          initialDisplay={{
            name: classifyTarget.name,
            title: classifyTarget.title,
            firm: classifyTarget.firm,
          }}
        />
      ) : null}
    </>
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
