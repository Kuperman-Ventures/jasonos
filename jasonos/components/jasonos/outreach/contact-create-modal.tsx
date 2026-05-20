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

interface FormState {
  name: string;
  title: string;
  firm: string;
  email: string;
  linkedinUrl: string;
}

const INITIAL: FormState = {
  name: "",
  title: "",
  firm: "",
  email: "",
  linkedinUrl: "",
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
