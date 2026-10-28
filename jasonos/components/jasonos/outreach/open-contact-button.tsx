"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";

type Props = {
  contactId: string | null | undefined;
  contactName?: string | null;
  /** Match surrounding follow-up action sizes. */
  size?: "xs" | "sm";
  variant?: "outline" | "calendarGhost" | "emailGhost";
  disabled?: boolean;
};

/**
 * Opens the shared contact modal for a JasonOS People row. Hidden when no
 * contact is linked (guest not in the system yet).
 */
export function OpenContactButton({
  contactId,
  contactName,
  size = "sm",
  variant = "outline",
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  if (!contactId) return null;

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <User className="h-3.5 w-3.5" />
        Open
      </Button>
      <OutreachModal
        open={open}
        onOpenChange={setOpen}
        contactId={contactId}
        initialTab="contact"
        initialDisplay={{
          name: contactName?.trim() || "Contact",
        }}
      />
    </>
  );
}
